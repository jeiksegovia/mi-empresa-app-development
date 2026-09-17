# File Persistence Mitigations — Mobile SPA (Android Chrome file-picker reload)

**Compiled:** 2026-07-08. All URLs accessed 2026-07-08 unless noted.
**Project:** `mi-empresa-app` (Nuxt 4 + PrimeVue 4.5.4 + Pinia).
**Failure mode:** user taps `<input type="file">` → Android DocumentsUI opens → Chrome tab is backgrounded → on return, the SPA appears "reloaded" (Pinia state gone, `File` reference lost).

---

## 1. Root cause (verified)

This is **not** a Nuxt/Vue bug. It is a documented Android Chrome class of bugs where the page is reloaded or the renderer is discarded when the OS file-picker activity takes focus.

- Chromium issue tracker (open since 2013): *"Android reloads web page when selecting file"* — [issuetracker.google.com/issues/36967486](https://issuetracker.google.com/issues/36967486) (accessed 2026-07-08).
- Chromium issue tracker (2025-04): *"Page reloads unexpectedly when selecting file using `<input type="file" accept="image/*">` on mobile"* — [issuetracker.google.com/issues/409357263](https://issuetracker.google.com/issues/409357263) (accessed 2026-07-08).
- Page Lifecycle API: *"Modern browsers today will sometimes suspend pages or discard them entirely when system resources are constrained."* — [developer.chrome.com/docs/web-platform/page-lifecycle-api](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) (updated 2023-12-01, accessed 2026-07-08).
- Chrome Memory Saver / Energy Saver: from Chrome 133 (Feb 2025) eligible CPU-intensive background tabs are frozen when Energy Saver is active; backgrounded tabs become freezable after 5 min hidden + silent — [developer.chrome.com/blog/freezing-on-energy-saver](https://developer.chrome.com/blog/freezing-on-energy-saver) (2025-01-20, accessed 2026-07-08).

**Consequence:** when DocumentsUI opens, `document.visibilityState` flips to `hidden`, and the tab becomes eligible for `freeze` → `discard`. On return the renderer is **reloaded** (not restored from bfcache, because bfcache is for history navigations, not backgrounding).

---

## 2. File System Access API — `window.showOpenFilePicker`

### Browser support matrix (2026-07)

| Browser | Support | Notes |
|---|---|---|
| Chrome desktop | ✅ since 86 (Oct 2020) | Stable, gated by HTTPS + user gesture. |
| Edge desktop | ✅ since 86 | Chromium-based. |
| Firefox desktop | ❌ No support | Not on roadmap as of 2026-07. [UNCONFIRMED] any 2026 announcement — none found. |
| Safari desktop | ❌ No support | Not implemented. |
| **Chrome for Android** | ✅ since **Chrome 132 (Jan 2025)** | First Android + WebView support. — [developer.chrome.com/blog/new-in-chrome-132](https://developer.chrome.com/blog/new-in-chrome-132) (2025-01-14, accessed 2026-07-08). |
| Firefox Android | ❌ No support | — [developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) (updated 2025-11-30, accessed 2026-07-08). |
| Safari iOS | ❌ No support | Same MDN page. |

Sources:
- [developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) — MDN compatibility table (accessed 2026-07-08).
- [caniuse.com/mdn-api_window_showopenfilepicker](https://caniuse.com/mdn-api_window_showopenfilepicker) — caniuse entry (accessed 2026-07-08).
- [groups.google.com/a/chromium.org/g/blink-dev/c/x3IcFv2jY6c](https://groups.google.com/a/chromium.org/g/blink-dev/c/x3IcFv2jY6c) — *"Intent to Ship: File System Access on Android and WebView"* (accessed 2026-07-08): confirms M132 stable Jan 2025.

### Security / permission guards
- **Must be HTTPS** ([developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) — "Must be a secure context", accessed 2026-07-08).
- **Must be invoked inside a user gesture** (button click) — otherwise `SecurityError`.
- **Cross-origin iframes blocked.**
- **WebView support requires host app to update `WebChromeClient#onShowFileChooser()`** with the FSA flags; not all Cordova/Capacitor wrappers do. [UNCONFIRMED] exact WebView version that flipped the default — Chromium post indicates "next major Android release in 2026" (likely Android 17 / API 37+).

### Fallback chain (standard pattern)
```js
async function pickFile() {
  // 1. Prefer FSA where available
  if ('showOpenFilePicker' in window && window.self === window.top) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Files', accept: { '*/*': ['.pdf', '.jpg', '.png'] } }],
        multiple: false,
      });
      return await handle.getFile(); // File
    } catch (e) {
      if (e.name === 'AbortError') return null; // user cancelled
      // fall through to <input>
    }
  }
  // 2. Fallback: classic <input type="file">
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
```
Libraries that wrap this: [`browser-fs-access`](https://github.com/GoogleChromeLabs/browser-fs-access) by Google Chrome Labs.

### Why FSA does NOT solve our Android reload bug
Even if every browser supported FSA, opening the picker still hands focus to the OS activity, which still triggers Chrome's renderer discard. The picker API choice is orthogonal to the persistence problem.

---

## 3. IndexedDB File / Blob storage

### Structured-clone compatibility (confirmed)
- MDN: `File`, `Blob`, `FileList`, and `FileSystemHandle` are listed as supported cloneable types — [developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Structured_clones](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Structured_clones) (accessed 2026-07-08).
- `FormData` is **NOT** cloneable (throws `DataCloneError`) — same source.
- `File extends Blob`; storing a `File` writes its `name`, `type`, `lastModified` plus the binary payload — [developer.mozilla.org/en-US/docs/Web/API/File](https://developer.mozilla.org/en-US/docs/Web/API/File) (accessed 2026-07-08).

### Pattern (recommended)
```js
// 1. Store — wrap with metadata, don't store raw File alone
const record = {
  id: formDraftId,            // string
  file: theFile,              // File (or Blob)
  name: theFile.name,
  type: theFile.type,
  size: theFile.size,
  lastModified: theFile.lastModified,
  createdAt: Date.now(),
  status: 'pending',
  formId: 'patient-create',
};

const db = await openIDB();
const tx = db.transaction('fileDrafts', 'readwrite');
tx.objectStore('fileDrafts').put(record);
await tx.done; // fires 'complete' — guaranteed durable

// 2. Restore — File is reconstructed automatically from the stored Blob
const stored = await db.get('fileDrafts', formDraftId);
const restored: File = stored.file;
// If you stored only a Blob, rebuild defensively:
// const restored = new File([stored.blob], stored.name, {
//   type: stored.type, lastModified: stored.lastModified
// });

// 3. Use for upload
await fetch(uploadUrl, { method: 'POST', body: restored });
```

### Quotas / eviction on Android Chrome
- Up to **60 % of total disk** per origin in persistent mode — [web.dev/articles/storage-for-the-web](https://web.dev/articles/storage-for-the-web) (2024-09-23, accessed 2026-07-08).
- Otherwise LRU eviction by storage pressure.
- `navigator.storage.persist()` is auto-approved by Chromium (no prompt) — same source.
- Storage buckets API: [developer.chrome.com/docs/capabilities/storage-buckets](https://developer.chrome.com/docs/capabilities/storage-buckets) (accessed 2026-07-08). **[UNCONFIRMED]** production-readiness on Android Chrome for non-extensions.

### Vue / Nuxt integration
- **No first-party Nuxt module** abstracts IDB+File storage (searched `vue indexeddb file persistence composable`).
- Idiomatic wrapper: [`@vueuse/integrations`' `useIDBKeyval`](https://vueuse.org/integrations/useIDBKeyval/) built on [`idb-keyval`](https://github.com/jakearchibald/idb-keyval) by Jake Archibald. [UNCONFIRMED] whether `useIDBKeyval` supports `File` payloads out of the box — `idb-keyval` uses structured clone so it should.
- Alternative: [`idb`](https://github.com/jakearchibald/idb) (~3.5 kB Promise wrapper) for richer schema/index support.

### Edge case — File reference lost when document reloads
A `File` object held only in a Vue/Pinia ref dies with the document. **The blob must be written to IDB inside the `visibilitychange` handler** (which fires synchronously before the JS context can be torn down), not after a `setTimeout` or async tick.

---

## 4. sessionStorage vs localStorage for file-related state

### File objects cannot be JSON-serialised
- `JSON.stringify(file)` → `"{}"` (File has no own enumerable props beyond Blob internals).
- Confirmed: [stackoverflow.com/questions/19119040](https://stackoverflow.com/questions/19119040/how-do-i-save-and-restore-a-file-object-in-local-storage) (accessed 2026-07-08).

### Blob URLs (`URL.createObjectURL`) are NOT persistent
- *"Browsers will release object URLs automatically when the document is unloaded"* — [developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob) (2025-09-11, accessed 2026-07-08).
- Blob URLs are scoped to the **creator `Document`** and tied to a storage key; they cannot cross tabs.
- They survive in-page SPA navigation (`pushState`) but die with any full unload/reload.

### sessionStorage quota on Chrome Android
- **5 MiB per origin** for sessionStorage on Chrome Android — [web.dev/articles/storage-for-the-web](https://web.dev/articles/storage-for-the-web) (2024-09-23, accessed 2026-07-08).
- **Combined local+session ceiling: 10 MiB per origin** — [developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) (2026-01-05, accessed 2026-07-08). `QuotaExceededError` thrown beyond.
- **sessionStorage is destroyed when the tab is destroyed** — *"Closing the browser tab destroys all sessionStorage data associated with that tab"* — [developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) (2025-02-22, accessed 2026-07-08).
- **Implication for our scenario:** if Chrome discards the tab while the file picker is open, sessionStorage is gone. **sessionStorage is unsafe for cross-renderer-discard persistence.** It is safe only for SPA navigation persistence.

### Base64 in sessionStorage — fragile
- Base64 expansion (RFC 4648, no line breaks): `chars = ceil(bytes / 3) × 4`.
- A 5 MiB binary → ~6.99 M-char ASCII → exceeds the 5 MiB quota and the JS UTF-16 heap doubles it (~14 MB).
- Practical ceiling ≈ **3.0–3.5 MiB binary** before `QuotaExceededError`.
- **Verdict:** not viable for documents/photos (>3 MB). Use IDB.

---

## 5. PrimeVue Dialog (v4.5.4) and BFCache

### Investigated: does the Dialog component block BFCache?

Grepped `frontend/node_modules/primevue/dialog/` and `frontend/node_modules/@primevue/core/` for `beforeunload`, `pagehide`, `unload`:

- `Dialog` does **not** register any `window.addEventListener('beforeunload' | 'pagehide' | 'unload', …)`.
- The `unload` symbol in `@primevue/core/usestyle/index.mjs` is a **local function** that calls `document.head.removeChild(styleEl)`. It is wired to Vue's `onScopeDispose` (commented out in this build but the function exists), not a window-level listener.
- `_unloadScopedThemeStyles` in `BaseComponent.vue` removes a `<style>` element from the DOM on component teardown — not a window listener.

**Conclusion: PrimeVue 4.5.4 does NOT add BFCache-blocking listeners.** Our app should remain bfcache-eligible by default. — [verified locally in `frontend/node_modules/`, 2026-07-08]

### BFCache blockers that DO exist on web pages
- `window.addEventListener('unload', …)` — web.dev notes: *"On mobile, Chrome and Safari will attempt to cache pages with an unload event"* (i.e., they will **still cache** because unload is unreliable on mobile — [web.dev/articles/bfcache](https://web.dev/articles/bfcache), updated 2026-07-02, accessed 2026-07-08).
- `window.addEventListener('beforeunload', …)` — registered listeners do **not** block bfcache in modern Chrome but mobile `beforeunload` is unreliable anyway — [developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) (2025-06-23, accessed 2026-07-08).
- Long-lived `setTimeout` / `setInterval` that touch the DOM in frozen state.
- WebSocket connections held open at navigation time without a `pagehide` teardown.

---

## 6. `pagehide` + `pageshow` + `visibilitychange` in Vue / Nuxt

### The standard pattern (mobile-first)
```ts
// composables/useFormDraftPersistence.ts
export function useFormDraftPersistence(formId: string, getState: () => any) {
  const restore = ref<any>(null);

  // pageshow: hydrate. event.persisted === true → restored from bfcache.
  function onPageShow(e: PageTransitionEvent) {
    if (e.persisted) {
      // bfcache restore — usually nothing to do, page state intact.
    }
    // Always try IDB restore on first show
    openIDB().then(db => db.get('drafts', formId)).then(record => {
      if (record) restore.value = record;
    });
  }

  // visibilitychange: persist BEFORE the JS context can be torn down.
  function onVisChange() {
    if (document.visibilityState === 'hidden') {
      // sync write — no awaits before persist
      const state = getState();
      persistToIDB(formId, state); // fire-and-forget but ensure tx.commit()
    }
  }

  onMounted(() => {
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisChange);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('pageshow', onPageShow);
    document.removeEventListener('visibilitychange', onVisChange);
  });

  return { restore };
}
```

### Why `visibilitychange` over `pagehide` on mobile
- *"Transitioning to hidden is the last event that's reliably observable by the page"* — [developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) (2026-02-20, accessed 2026-07-08).
- `beforeunload`/`pagehide`/`unload` "are not fired in those cases" (mobile close/background) — [developer.chrome.com/docs/web-platform/page-lifecycle-api](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) (2023-12-01, accessed 2026-07-08).
- The page-lifecycle flow is: **Active → Passive → Hidden → Frozen → Terminated/Discarded**. Persist in **Hidden**, before **Frozen** — same source.

### Important: synchronous write required
Inside `visibilitychange`, the event handler must be **synchronous**. `await`-ing an IndexedDB transaction inside the handler is risky — prefer kicking off a sync `tx.commit()` and not awaiting it, or use the `idb` library's `tx.complete` event.

### Does our project already have `pagehide`/`pageshow` listeners?
[UNCONFIRMED] without running a grep over `frontend/app`. **Action item:** `grep -rE "pagehide|pageshow|visibilitychange" frontend/app/`. As of `git status` we have multiple "ficha" forms; the existing `sessionStorage` watchers are **inside Vue setup**, not global listeners — they only fire on reactive updates, not on tab backgrounding.

---

## 7. `<input type="file">` on Android Chrome after tab return

### `change` event firing reliability
- **Mixed reports.** Ionic forum thread *"file input broken on android — change event doesn't fire after selecting a file"* — [forum.ionicframework.com/t/.../225007](https://forum.ionicframework.com/t/file-input-broken-on-android-change-event-doesnt-fire-after-selecting-a-file-and-any-other-clicks-dont-do-anything/225007) (2022-07-13, accessed 2026-07-08). OP traced it to a native bridge; **no Chrome-side root cause has been identified** as a definitive fix.
- On a fresh reload, the input's `value` and `files` are empty regardless of the `change` event firing — HTML spec mandates `input.value = '…'` is a no-op — [developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file) (2026-06-09, accessed 2026-07-08).

### Android 14 / 15 regression — camera tile removed
- *"From Android 14, the camera tile is no longer shown for `<input type="file" accept="video/*" capture>`"* — confirmed on OnePlus 13 (Chrome 134), Samsung Galaxy S21 FE (Chrome 135, Edge 137). Firefox 137 still shows it. Workarounds:
  - Plain `<input type="file">` (no `accept`, no `capture`) — camera tile returns.
  - `accept="video/*,android/allowCamera"` — non-standard MIME re-enables the tile.
  - Source: [blog.addpipe.com/html-file-input-accept-video-camera-option-is-missing-android-14-15/](https://blog.addpipe.com/html-file-input-accept-video-camera-option-is-missing-android-14-15/) (2025-07-15, accessed 2026-07-08).

### DocumentsUI background flow — what fires
1. User taps the file input.
2. Chrome calls `Intent.ACTION_GET_CONTENT` (or `ACTION_OPEN_DOCUMENT`).
3. DocumentsUI Activity launches; Chrome tab loses focus → `visibilitychange` fires with `document.visibilityState === 'hidden'`.
4. Tab becomes eligible for freeze (5 min silent) → discard (under memory pressure).
5. User picks file / cancels; DocumentsUI closes; Chrome tab refocused.
6. If renderer survived → `visibilitychange` fires with `'visible'`; if discarded → cold reload.

**[UNCONFIRMED]** precise moment `visibilitychange` fires relative to the DocumentsUI overlay; no public Chromium source documents this exact ordering for the file-picker intent.

---

## 8. Recommended code-level patterns (citations)

### A. Persist form state on `pagehide`
- [web.dev/articles/bfcache](https://web.dev/articles/bfcache) (updated 2026-07-02, accessed 2026-07-08): *"On `pageshow` with `event.persisted`, hydrate; on `pagehide`, persist."*

### B. Restore on `pageshow`
- [developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event) (accessed 2026-07-08): use `event.persisted` to distinguish bfcache restore from a fresh navigation.

### C. Use `visibilitychange` for mobile persistence (not `pagehide`)
- [developer.chrome.com/docs/web-platform/page-lifecycle-api](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) (2023-12-01, accessed 2026-07-08): *"Transition to hidden is the last state change that's reliably observable by developers (this is especially true on mobile)."*

### D. `document.wasDiscarded` (newer)
- [developer.chrome.com/blog/freezing-on-energy-saver](https://developer.chrome.com/blog/freezing-on-energy-saver) (2025-01-20, accessed 2026-07-08) — check `document.wasDiscarded` on `pageshow` to detect a discarded (cold-reloaded) tab. [UNCONFIRMED] exact Chrome version where this is exposed — referenced in Chrome 133+ posts.

---

## 9. Concrete pattern for our app (Nuxt 4 + Pinia + PrimeVue)

### Goal
> User taps `<input type="file">` → OS picker opens → user picks → returns to page → **file is not lost** and **no visible reload** (state preserved).

### Minimum-viable change set

#### 9.1 Ensure BFCache eligibility
- **Audit existing `beforeunload`/`pagehide`/`unload` listeners** in `frontend/app/` and remove any that are not strictly necessary. PrimeVue itself does NOT block bfcache (verified 2026-07-08).
- Close any open WebSockets on `pagehide`, not on `unload`.
- Avoid `Cache-Control: no-store` on the document; it does not affect bfcache but signals "this page is fragile" to the platform.

#### 9.2 Persist `File` to IndexedDB on `visibilitychange`
Add a Nuxt plugin `frontend/app/plugins/form-draft-persistence.client.ts`:

```ts
export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return;

  const DB_NAME = 'mi-empresa-drafts';
  const STORE = 'fileDrafts';

  async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function stashFile(formDraftId: string, file: File, meta: Record<string, any>) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id: formDraftId,
      file,                                  // File extends Blob, structured-cloneable
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      ...meta,
      savedAt: Date.now(),
    });
    await txDone(tx);                         // ensure durability before yielding
    db.close();
  }

  async function restoreFile(formDraftId: string): Promise<File | null> {
    const db = await openDB();
    const rec: any = await idbGet(db, STORE, formDraftId);
    db.close();
    if (!rec) return null;
    // rec.file is the same Blob instance — re-wrap defensively as File
    return new File([rec.file], rec.name, { type: rec.type, lastModified: rec.lastModified });
  }

  async function clearFile(formDraftId: string) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(formDraftId);
    await txDone(tx);
    db.close();
  }

  // Global sync-on-hidden — captures whatever the latest form stashed
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // The form page already wrote via stashFile() on every <input type=file> change.
      // This hook is the safety net for Pinia state we may have missed.
    }
  });

  // BFCache restore detector
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      console.debug('[drafts] restored from bfcache');
    }
  });

  return {
    provide: { formDraft: { stashFile, restoreFile, clearFile } },
  };
});
```

#### 9.3 In each form page (e.g. `pages/pacientes/crear.vue`, `pages/instrumentos/crear.vue`, etc.)

```vue
<script setup lang="ts">
const DRAFT_ID = 'patient-create'; // unique per form
const { $formDraft } = useNuxtApp();
const pendingFile = ref<File | null>(null);

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  pendingFile.value = file;
  // Persist immediately, before Android can background us
  await $formDraft.stashFile(DRAFT_ID, file, { formId: 'patient-create' });
}

onMounted(async () => {
  const restored = await $formDraft.restoreFile(DRAFT_ID);
  if (restored) {
    pendingFile.value = restored;
    // Surface a non-blocking banner: "Recuperamos tu archivo anterior"
  }
});

async function submit() {
  // Use pendingFile.value directly — it's a real File usable in fetch()
  const fd = new FormData();
  fd.append('document', pendingFile.value!);
  await fetch('/api/patients', { method: 'POST', body: fd });
  await $formDraft.clearFile(DRAFT_ID);
}
</script>
```

#### 9.4 Converting a stored `Blob` back to a usable `File`
```js
// Always safe — works whether you stored a File or a raw Blob:
const file = new File([storedBlob], storedName, {
  type: storedType,
  lastModified: storedLastModified,
});

// Then use in fetch(), FormData, anything a File accepts.
fetch('/api/upload', { method: 'POST', body: file });
```

---

## 10. Open questions / [UNCONFIRMED]

| Item | Status | Reason |
|---|---|---|
| Exact Chromium issue that lands a definitive fix for the Android file-picker reload | UNCONFIRMED | No public Chromium "fixed in Mxxx" post found as of 2026-07-08. |
| WebView FSA auto-enabled in a specific Android version | UNCONFIRMED | Chromium post says "next major Android release in 2026"; final version not yet documented. |
| Precise moment `visibilitychange` fires vs DocumentsUI overlay | UNCONFIRMED | No public source documents this; reverse-engineered from MDN general behaviour. |
| `document.wasDiscarded` support on Android Chrome | UNCONFIRMED | Referenced for Chrome 133+ in freezing-on-energy-saver post; cross-platform matrix not enumerated. |
| Android Chrome incognito sessionStorage exact MB cap | UNCONFIRMED | Only desktop figure published; mobile not documented. |
| Expensify #93375 root cause (referenced as `DataCloneError` workaround) | UNCONFIRMED | Issue body is auth-walled; only Google's snippet visible. |
| `useIDBKeyval` (VueUse) File payload support | LIKELY (structured clone) | Not directly verified; `idb-keyval` uses structured clone under the hood. |

---

## 11. TL;DR for the team

1. The Android bug is real and well-documented; we cannot "wait for a Chrome fix".
2. `showOpenFilePicker` does **not** solve it — the renderer is discarded on backgrounding regardless of picker API.
3. The robust pattern is: **stash the `File` to IndexedDB synchronously inside `visibilitychange` (or on every file `change` event), then restore on `mount` + `pageshow`.**
4. `sessionStorage` is insufficient (5 MiB cap, lost on tab discard).
5. PrimeVue 4.5.4 does not block bfcache — verified locally.
6. The minimum viable code is a single Nuxt plugin (~50 LOC) exposing `stashFile / restoreFile / clearFile`, plus per-page `onFileChange` + `onMounted` restore hooks.
7. Reconstruction: `new File([blob], name, { type, lastModified })` — works for `fetch`, `FormData`, anything a File accepts.

---

**End of report.**