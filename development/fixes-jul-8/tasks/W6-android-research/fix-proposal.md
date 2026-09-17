# W6 — Fix Proposal: Android SPA Reload on File Picker

**Companion to:** `result.md` (the root-cause research)
**Goal:** Restore the user's previously selected file after the Android
file-picker round-trip, OR prevent the reload entirely.
**Status:** proposal only — W6 does not write production code.

Confidence levels follow these definitions:
- **HIGH** — strong primary-source support and the fix addresses the specific
  mechanism named in research.
- **MED** — supported by primary sources but only addresses a subset of causes
  or depends on user-agent behavior under our control.
- **LOW** — best-effort, partial, or relies on unconfirmed assumptions.

---

## TL;DR

The Android "page reloads after file picker" symptom has two root causes in
play, and we need to address **both** to fully fix it:

1. **(Primary)** The tab is **discarded** by Chrome Memory Saver / Android
   LMK → full reload occurs → Pinia refs reset → `File` reference is gone.
   Fix: persist the `File` to IndexedDB (which survives full reload), and
   re-hydrate on `pageshow`.
2. **(Secondary, defense in depth)** Even if we never get a discard, we should
   **prevent unnecessary reloads** wherever possible — our app is already
   bfcache-eligible, but mobile Chrome may still evict processes.

The minimal fix that **guarantees** the user-visible bug is gone is to
**persist the File object to IndexedDB on `visibilitychange === 'hidden'`**
and re-hydrate on `pageshow` (or initial load).

---

## Fix Option A — IndexedDB File persistence (RECOMMENDED)

**Confidence: HIGH for fixing the user-visible bug.**
**Files changed:** 1 new composable + 1 edit in ficha page.
**Risk:** LOW. IndexedDB on Android Chrome is well-supported. Async commit
pattern means no race with the (rapidly-quitting) page.

### A.1 New file: `frontend/app/composables/useFileStash.ts`

```ts
/**
 * useFileStash — stash a File/Blob in IndexedDB, retrieve later.
 *
 * Why: sessionStorage can hold the file NAME but not the File itself.
 * On Android Chrome, when the file picker round-trips, the tab may be
 * discarded (full reload) — the JS heap (and any in-memory File refs)
 * are wiped. IndexedDB persists across reloads, so we stash the blob
 * there on `visibilitychange === 'hidden'` and re-hydrate on `pageshow`.
 *
 * Storage shape:
 *   db: "mi-empresa-file-stash", store: "files", key: <fichaId>-<field>
 *   value: { blob: Blob, name: string, type: string, size: number,
 *            ts: number }
 *
 * Stale entries expire after 24h (cleared on read).
 */

const DB_NAME = 'mi-empresa-file-stash'
const STORE = 'files'
const TTL_MS = 24 * 60 * 60 * 1000

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
  })
}

export function useFileStash() {
  async function stash(key: string, file: File): Promise<void> {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({
        blob: file,
        name: file.name,
        type: file.type,
        size: file.size,
        ts: Date.now(),
        key, // Indexed by 'key' field, not the keyPath
      }, key)
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res()
        tx.onerror = () => rej(tx.error)
        // commit() ensures the write commits before the page may freeze.
        ;(tx as any).commit?.()
      })
      db.close()
    } catch {
      /* IDB may be disabled in some browser modes — silently noop */
    }
  }

  async function restore(key: string): Promise<File | null> {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readonly')
      const entry: any = await new Promise((res, rej) => {
        const req = tx.objectStore(STORE).get(key)
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
      db.close()
      if (!entry || Date.now() - entry.ts > TTL_MS) return null
      // Re-construct File from Blob (IDB stores as Blob, but File API
      // methods are needed downstream in our component).
      return new File([entry.blob], entry.name, { type: entry.type })
    } catch {
      return null
    }
  }

  async function clear(key: string): Promise<void> {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      await new Promise<void>((res) => { tx.oncomplete = () => res() })
      db.close()
    } catch { /* noop */ }
  }

  return { stash, restore, clear }
}
```

### A.2 Edit: `frontend/app/pages/pacientes/[id]/index.vue`

Three diffs:

#### Diff 1 — at the top of `<script setup>` (~line 104, after
`uploadedFileName`)

```ts
import { useFileStash } from '~/composables/useFileStash'
const { stash: stashFile, restore: restoreFile, clear: clearFile } = useFileStash()
const stashKey = computed(() => `ficha:${route.params.id}:file`)
```

#### Diff 2 — in `onFileSelected` (~line 344)

```ts
async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadedFile.value = file
  uploadedFileName.value = file.name
  // Persist to IndexedDB so Android Chrome can re-hydrate after a discard.
  await stashFile(stashKey.value, file)
  writeFichaDraft() // keep sessionStorage draft in sync (existing line)
}
```

#### Diff 3 — after auth resolves and dialog opens, hydrate (~around line 322,
inside the existing draft-restoration block)

```ts
// Attempt File re-hydration from IndexedDB. If found, populate uploadedFile
// directly so the user sees the file is "still there" — no re-pick needed.
const restoredFile = await restoreFile(stashKey.value)
if (restoredFile && !uploadedFile.value) {
  uploadedFile.value = restoredFile
  uploadedFileName.value = restoredFile.name
}
```

#### Diff 4 — in `handleFichaSubmit` / dialog close, clear on success

```ts
async function handleFichaSubmit() {
  // ... existing submit code ...
  if (success) {
    await clearFile(stashKey.value)
    clearFichaDraft()
  }
}
```

### Why this works
- `sessionStorage` survives full reloads (we already use it for the draft).
- **`File` is not JSON-serializable**, so sessionStorage cannot hold the blob.
- **IndexedDB can store `Blob`** — per [MDN File](https://developer.mozilla.org/en-US/docs/Web/API/File)
  & [IndexedDB storing files/blobs](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Structured_clones)
  (accessed 2026-07-08).
- We re-construct the `File` object via `new File([blob], name, { type })`
  on restore so downstream code that calls `.name`, `.type`, `.size`
  works identically.
- If the user is ALSO already logged-in via the persistent Pinia
  `isAuthenticated` flag (set by session cookie), the auth middleware
  short-circuits and does NOT re-fetch the user after reload.

### Edge cases handled
- **No IDB support** — try/catch silently no-ops; user falls back to
  re-selecting file (current behavior).
- **Stale stash from a different ficha** — namespaced by `ficha:<id>:file`.
- **Stale stash > 24h** — silently discarded on `restore`.
- **Two windows open same ficha** — last-write-wins; acceptable.

---

## Fix Option B — Disable Android Chrome Memory Saver / optimize for BFCache
**Confidence: MED that this REDUCES reload frequency. Does NOT fully fix.**
**Files changed:** none (this is mostly a user-side instruction or Chrome flag).
**Recommendation:** **Address user education only as defense-in-depth.**
**Hard-block recommendation:** do not rely on this alone.

### B.1 Chrome's "discard eligible?" heuristics
Per [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api):
> "Chrome is going to be conservative when discarding pages and only do so
> when it's confident it won't affect users. For example, pages that have been
> observed to do any of the following while in the hidden state won't be
> discarded unless under extreme resource constraints: Playing audio, Using
> WebRTC, Updating the table title or favicon, Showing alerts, Sending push
> notifications."

Our app does **none** of these, so we are **discard-eligible**.

### B.2 To make the page less discard-eligible (LOW impact on this app)

We could **begin a heartbeat** during the file-picker round-trip — but that
defeats the purpose. A better marker: have the dialog show a "do not close"
indicator using the page title.

```ts
// In onFileSelected or when picker is open:
const originalTitle = document.title
document.title = '⚠ Selecciona un archivo - ' + originalTitle

// When picker returns (change event fires):
nextTick(() => { document.title = originalTitle })
```

This makes Chrome consider the tab as "actively updating its UI" while the
picker is open, **reducing the chance of being discarded** during the picker
round-trip.

**Confidence: MED** — this is an undocumented Chromium behavior pattern;
not officially endorsed as a discard-blocker.

---

## Fix Option C — Prevent the reload by removing bfcache blockers
**Confidence: HIGH for "no regressions", but does NOT fix Android file-picker symptom.**

### C.1 Audit confirms app is already bfcache-eligible

We have already verified (in `progress-report.md` and §2.3 of `result.md`)
that our app adds **none** of:
- `unload` listeners
- `beforeunload` listeners (unconditional)
- WebSocket connections
- IndexedDB open connections (until we add them in Fix A)
- `Cache-Control: no-store` on app shell
- `window.opener` references

So bfcache eligibility is already maximally permissive. This fix is a
**no-op** in our codebase, but it is the right audit step before any future
change.

### C.2 Add Permissions-Policy header to declare no-unload
**[UNCONFIRMED header name correctness]** — from
[web.dev bfcache](https://web.dev/articles/bfcache):
> "Use Permission Policy to prevent unload handlers being used on a page
> Permissions-Policy: unload=()"

`[UNCONFIRMED — this header is scoped to specific origins; verify against
the Chrome Permissions Policy docs before deploying.]`

Not actionable from the frontend; would need a backend/edge change if we
later add 3rd-party scripts that might attach unload.

---

## Fix Option D — Address `Cache-Control: no-store` if any
**Confidence: HIGH — but no current usage to fix.**

Verified: no `Cache-Control: no-store` header is set on the SPA shell in
`nuxt.config.ts`. SPA shells are served by Amplify as static files; default
is `Cache-Control: public, max-age=...`. No action.

---

## Implementation order (priority list)

1. **Implement Fix Option A** (IndexedDB file stash) — HIGH confidence, fixes
   the user-reported bug.
2. **Add Fix Option B's title-updater** as a small defense-in-depth — MED
   confidence.
3. **Add a `pageshow` listener at app level** (e.g. in
   `frontend/app/plugins/session-expired.client.ts`) to opportunistically
   re-sync auth if `event.persisted === true` and stale data is detected —
   LOW risk, optional.
4. **NO-OP on Fix Option C** — already eligible; document in
   `CLAUDE.md` so future contributors don't accidentally add blockers.
5. **NO-OP on Fix Option D** — no current usage; document.

---

## Risk assessment per fix

| Fix   | User-visible impact       | Risk of regression             | Effort |
|-------|---------------------------|--------------------------------|--------|
| A     | File auto-restored        | Low (try/catch on IDB)         | ~70 LOC |
| B     | Slightly less reloads     | Low (cosmetic title change)    | ~5 LOC  |
| C     | None (audit)              | None                           | ~5 LOC  |
| D     | None (none to fix)        | None                           | 0 LOC   |

---

## Verification (QA) plan after applying Fix A

On real Android Chrome:
1. Open ficha Dialog, select new Estado, type in notes, attach a file.
2. Verify `sessionStorage` key written + IDB entry written (DevTools →
   Application → IndexedDB → `mi-empresa-file-stash`).
3. Background the tab (open file picker).
4. Pick a file → verify dialog header still shows the original filename
   with check mark, NOT the "Vuelve a seleccionar" hint.
5. Submit → verify file uploads correctly + IDB entry cleared.

Synthetic test in DevTools:
- Application → Back-forward Cache → Run Test → expect "Restored from
  back-forward cache".
- `chrome://discards` → manually discard → reopen → verify fix still works.

Bypass with DevTools "Disable cache" → re-test file-picker round-trip.

---

## Open questions for orchestrator

1. Should we ship Fix A + Fix B together, or A only, then measure?
   Recommendation: ship together — combined ~75 LOC change.
2. Should we localize the title-warning text? It's UI-visible. (Yes, Spanish
   per project standard.)
3. The store namespace `mi-empresa-file-stash` collides only with future
   use of the same DB. Acceptable? (Yes, but document in `CLAUDE.md`.)
4. Do we want a `pageshow` global hook for stale-data invalidation? Currently
   no draft data crosses that boundary since sessionStorage is canonical.
   Probably defer.

---

## Reference

- Root cause: `result.md` §5
- Evidence: `result.md` §6
- Local code: `result.md` §7
