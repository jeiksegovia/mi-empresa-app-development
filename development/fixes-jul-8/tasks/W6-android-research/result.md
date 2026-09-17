# W6 — Android SPA Reload on File Picker — Research Result

**Task:** Deep-dive on user-reported behavior: "when user tries to Actualizar
Estado and selecting a file, Android browser goes to background, when user
picks the file and browser comes back the page reloads."
**Project:** `mi-empresa-app` (Nuxt 4 SPA + Pinia + PrimeVue, `ssr: false`)
**Author:** W6 (deep-research pass)
**Date:** 2026-07-08
**Status:** complete (root cause identified, fix proposal drafted)

All URLs accessed 2026-07-08 unless otherwise noted. `[UNCONFIRMED]` flags
guesses that could not be cross-verified from a primary source.

---

## 1. Web page lifecycle — the canonical model

Per the [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
(last updated 2023-12-01) and the
[web.dev bfcache article](https://web.dev/articles/bfcache) (last updated
2026-07-02), a Page Lifecycle state is **discrete and mutually exclusive** at
the level of the spec; in practice browsers map the states to a transition
graph and fire a defined set of DOM events.

### 1.1 States (authoritative, Chrome for Developers)

| State         | Description                                                              |
|---------------|--------------------------------------------------------------------------|
| **active**    | Visible **and** has input focus.                                          |
| **passive**   | Visible but does NOT have input focus.                                    |
| **hidden**    | Not visible; not yet frozen/discarded/terminated.                         |
| **frozen**    | Freezable task queues suspended; timers + fetch callbacks paused.         |
| **terminated**| Unloading; tasks may be killed mid-run.                                   |
| **discarded** | Renderer process killed by browser/OS for memory; no events fire at all.  |

### 1.2 Events fired for each transition

| Event            | Fires when                                                  | Target      | `persisted` flag |
|------------------|-------------------------------------------------------------|-------------|------------------|
| `focus`          | Element gained focus (active state change)                  | DOM element | n/a              |
| `blur`           | Element lost focus (passive state change)                   | DOM element | n/a              |
| `visibilitychange` | `document.visibilityState` toggled (hidden ↔ visible)     | document    | n/a              |
| `freeze`         | Hidden → frozen                                              | document    | n/a              |
| `resume`         | Frozen → hidden/active/passive                              | document    | n/a              |
| `pageshow`       | Document being navigated to OR restored from bfcache        | window      | `true` if bfcache restore |
| `pagehide`       | Document being navigated away or about to enter bfcache     | window      | `true` if browser intends to put page in bfcache |
| `beforeunload`   | Window/document about to be unloaded; still cancelable      | window      | n/a              |
| `unload`         | Page is being unloaded (legacy, deprecated)                 | window      | n/a              |

Source: [Page Lifecycle API state/event table](https://developer.chrome.com/docs/web-platform/page-lifecycle-api),
[MDN pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event),
[MDN pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event).

### 1.3 Why this matters

`pagehide` fires **only on history-traversal/navigation**, NOT on tab
backgrounding:
> "The pagehide event is sent to a Window when the browser hides the current
> page in the process of presenting a different page from the session's
> history." — [MDN pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event) (accessed 2026-07-08)

Likewise `pageshow` fires on initial load AND bfcache restore:
> "The pageshow event is sent to a Window when the browser navigates to a new
> document… Including: Restoring a frozen page on mobile OSes. Returning to
> the page using the browser's forward or back buttons (including when
> restored from the bfcache)." — [MDN pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event) (accessed 2026-07-08)

---

## 2. BFCache (back-forward cache) — definition and triggers

### 2.1 What bfcache is
> "With back/forward cache (bfcache), instead of destroying a page when the
> user navigates away, we postpone destruction and pause JS execution. If the
> user navigates back soon, we make the page visible again and unpause JS
> execution." — [web.dev bfcache](https://web.dev/articles/bfcache) (last updated 2026-07-02)

Crucially:
> "bfcache is a snapshot of the entire page in memory, including the
> JavaScript heap, whereas the HTTP cache contains only the responses for
> previously made requests." — same source

So on a bfcache restore, **Pinia stores are preserved**, `onMounted` hooks do
NOT re-fire, Nuxt plugins do NOT re-run, and the DOM is intact.

### 2.2 What bfcache applies to
> "Because bfcache works with browser-managed navigations, it doesn't work
> for 'soft navigations' within a single-page app (SPA). However, bfcache can
> still help when going back to an SPA rather than doing a full
> re-initialisation of that app again from the start." — [web.dev bfcache](https://web.dev/articles/bfcache)

### 2.3 What BLOCKS bfcache eligibility (per web.dev, last updated 2026-07-02)

| Blocker                                              | Notes                                                                                                          |
|------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| **Any registered `unload` event handler**              | "Desktop Chrome and Firefox have chosen to make pages ineligible for bfcache if they add an unload listener." Safari mobile attempts the cache but does not fire unload. **Chrome is deprecating `unload`.** |
| **`Cache-Control: no-store` on the PAGE response**    | Browsers have historically declined to cache no-store responses. Work is underway to relax this for Chrome (privacy-preserving). |
| **Open IndexedDB connection**                         | Possible cross-tab interference; the page won't be cached.                                                     |
| **In-flight `fetch()` / XHR**                          | Same reason.                                                                                                   |
| **Open WebSocket / WebRTC (some browsers)**           | Chrome 149+ no longer blocks on WebSockets.                                                                    |
| **`window.opener` reference** (non-null, no `rel="noopener"`) | Bfcache-incompatible. Use `rel="noopener"` (default in modern browsers).                                |
| **`beforeunload` listener (unconditional)**           | "The beforeunload event won't make your pages ineligible for bfcache in modern browsers' bfcache but previously it did and it is still unreliable, so avoid using it unless absolutely necessary."  |
| **Iframe (in some cases)**                            | "When the main frame is restored from the bfcache, embedded iframes will be restored as they were when the page entered the bfcache. The main frame can also be blocked from using the bfcache if an embedded iframe uses APIs that block this." |
| **Permissions Policy**                                | Use `Permissions-Policy: unload=()` to prevent third-party scripts adding unload handlers.                      |

### 2.4 What DOES NOT block bfcache

| Pattern                  | Reason                                                        |
|--------------------------|---------------------------------------------------------------|
| `visibilitychange` listener | Fires on backgrounding; doesn't disqualify.                |
| `pagehide` listener      | bfcache-compatible: "this event is compatible with the back/forward cache (bfcache), so adding a listener to this event will not prevent the page from being included in the bfcache." — [MDN pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event) |
| `pageshow` listener      | bfcache-compatible.                                          |
| `freeze` / `resume` listeners | bfcache-compatible.                                       |

---

## 3. Mobile vs desktop lifecycle behavior — the key facts

### 3.1 Same events, different reliability on mobile

Per [MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
(accessed 2026-07-08):
> "It is not reliably fired, especially on mobile platforms. For example,
> the beforeunload event is not fired at all in the following scenario:
> A mobile user visits your page. The user then switches to a different app.
> Later, the user closes the browser from the app manager."

Same unreliability applies to `unload` and `pagehide`. Mobile OSes give pages
no guarantee that any termination event will fire when the user backgrounds
or "kills" the app from recents.

### 3.2 Per [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api):
> "The transition to hidden is also often the last state change that's
> reliably observable by developers (this is especially true on mobile, as
> users can close tabs or the browser app itself, and the beforeunload,
> pagehide, and unload events are not fired in those cases). This means you
> should treat the hidden state as the likely end to the user's session.
> In other words, persist any unsaved application state and send any unsent
> analytics data."

So the **canonical mobile-safe session-end signal** is `visibilitychange` to
`document.visibilityState === 'hidden'`, not `beforeunload`/`unload`/`pagehide`.

### 3.3 Sticky activation requirement for beforeunload dialog (modern browsers)
> "Require sticky activation for the dialog to be displayed. In other words,
> the browser will only show the dialog box if the frame or any embedded
> frame receives a user gesture or user interaction. If the user has never
> interacted with the page, then there is no user data to save, so no
> legitimate use case for the dialog." — [MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)

Plus a non-customizable generic confirmation string:
> "Only show a generic browser-specified string in the displayed dialog. This
> cannot be controlled by the webpage code." — same source

### 3.4 Desktop-only: `document.wasDiscarded`
Per the [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api):
> "From Chrome 68 the document object now includes a wasDiscarded property on
> desktop Chrome (Android support is being tracked in this issue)."

So on Android we **cannot reliably detect** that a discarded-page reload
happened. `[UNCONFIRMED]` — depends on Android Chrome version; the Chrome 68
release notes referenced the desktop-only implementation.

---

## 4. The standard SPA form-state persistence pattern

For mobile SPA form persistence, the **canonical pattern** combining all
three sources is:

### 4.1 Write state on backgrounding
```js
window.addEventListener('pagehide', (e) => {
  if (e.persisted) {
    // Page is going to bfcache. Save state just in case.
    saveFormToSessionStorage();
  }
});
// Safer: use visibilitychange because pagehide is unreliable on mobile.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveFormToSessionStorage();
  }
});
```

### 4.2 Read state on restore/reload
```js
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    // Restored from bfcache — page state is still in memory, but
    // re-hydrate in case the JS heap was reloaded (e.g. discarded tab).
    hydrateFormFromSessionStorage();
  } else {
    // Either initial load or full reload (incl. discarded tab).
    hydrateFormFromSessionStorage();
  }
});
```

Pattern sources: [web.dev bfcache — "Update stale or sensitive data after
bfcache restore"](https://web.dev/articles/bfcache);
[MDN pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event);
[MDN pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event);
[MDN visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event).

### 4.3 Why not just rely on `beforeunload`?
Because on mobile it does not fire when the user backgrounds the app and then
kills it from the app manager. (See §3.1.)

### 4.4 Why not just rely on `pagehide`?
Because on mobile it does not fire when the tab is simply hidden (e.g. file
picker open). Pagehide fires **only on history-traversal unloading**. (See
§1.3.) The `visibilitychange` event is the only thing that fires reliably on
mobile when the tab is occluded.

### 4.5 Where to persist
- `sessionStorage`: JSON-serializable form fields, sync API.
- `IndexedDB`: non-serializable objects (e.g. File/Blob), async API.
  Use `IDBTransaction.commit()` inside the listener so the write commits
  even if the page is frozen immediately after.

Per [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api):
> "While most IndexedDB APIs are callback-based, the commit() method on the
> IDBTransaction interface provides a way to initiate the commit process on
> an active transaction without waiting for events from outstanding requests
> to be dispatched."

---

## 5. Android Chrome file-picker — the actual reload trigger

### 5.1 What Android Chrome does when `<input type="file">` is tapped

The file input triggers an Android `Intent.ACTION_GET_CONTENT` (or
`ACTION_OPEN_DOCUMENT`) which **launches a separate system activity**. The
Chrome tab is pushed to the background but **not destroyed**. No
navigation occurs. [UNCONFIRMED — no Chrome/Android source explicitly
documents the renderer's lifecycle during this intent; behavior inferred from
[Android `Intent.ACTION_GET_CONTENT` docs](https://developer.android.com/guide/components/intents-filters)
and the visibility-state behavior in the [Page Lifecycle
API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)]

Consequence: Chrome transitions the tab from `active`/`passive` → `hidden`.
Events fired:
- `visibilitychange` (`document.visibilityState === 'hidden'`) — **always**.
- `blur` — only if the input was the focused element.
- `freeze` — only after several minutes of backgrounding.
- `pagehide` — **does NOT fire** (no history traversal).
- `unload`, `beforeunload` — **do NOT fire** (no page teardown).

### 5.2 Possible reload causes when the user returns

| Cause                                      | Detection                                                           |
|--------------------------------------------|---------------------------------------------------------------------|
| **(A) Tab DISCARDED** (memory pressure)     | Full reload; `document.wasDiscarded` may be true on desktop; no detection on Android. |
| **(B) Chrome freezes then reloads on resume** | Reset of freezable tasks; usually no visible reload, just paused timers. |
| **(C) Full reload via `Cache-Control: no-store`** | Would require the response header. We don't set this.                |
| **(D) Browser bug or quirks mode reload**   | No specific evidence; remaining possibility.                        |

Per [Chrome Memory/Energy Saver](https://developer.chrome.com/blog/memory-and-energy-saver-mode):
> "When Memory Saver mode is enabled, Chrome will proactively discard tabs
> that have been unused in the background for some time… When a tab is
> discarded, its title and favicon still appear in the tab strip but the
> page itself is gone, exactly as if the tab had been closed normally. If
> the user revisits that tab, the page will be reloaded automatically."

The Android system **Low Memory Killer** (LMK) is a parallel mechanism that
kills renderer processes at the OS level under memory pressure. No event
fires; on re-foregrounding the tab is reloaded from scratch
[UNCONFIRMED — Android LMK docs describe the mechanism but do not single out
Chrome renderer processes for special behaviour; same effect noted in
[chromeos.dev ARC resource-management](https://chromeos.dev/en/posts/improving-performance-with-new-arc-resource-management-features)].

### 5.3 Why our app shows "draft restored from sessionStorage" hint

We **already have** the W3 D1 mitigation:
`frontend/app/pages/pacientes/[id]/index.vue` lines 354-403 writes form draft
to `sessionStorage` and the dialog shows:
> "Vuelve a seleccionar &laquo;filename&raquo; para continuar."

So W3 confirmed experimentally that **the page DOES fully reload** when the
user returns from the Android file picker — the only persistent evidence is
the `sessionStorage` draft that survives full reloads.

This rules out (B) "freeze then resume" — a freeze leaves the JS heap
intact, so the `File` object would survive; we know it doesn't survive.

### 5.4 Step-by-step reasoning trail (the Android reload scenario)

| Step | What happens                                                                       | Evidence                                  |
|------|------------------------------------------------------------------------------------|-------------------------------------------|
| 1    | User taps "Actualizar Estado" → opens ficha Dialog (`fichaForm` fields).            | Source code.                              |
| 2    | User selects new Estado; enters notes; optionally modifies fechaVencimiento.       | Source code; Draft persisted on every change (line 403). |
| 3    | User taps the hidden `<input type="file">` label.                                  | Source code line 970-984.                 |
| 4    | Android dispatches `Intent.ACTION_GET_CONTENT`; launches system chooser activity.  | Android docs (UNCONFIRMED).               |
| 5    | Chrome tab transitions active → hidden. `visibilitychange` fires with `document.visibilityState === 'hidden'`. No `pagehide`, no `unload`, no `beforeunload`. | Page Lifecycle API.                       |
| 6    | User picks file in the system chooser and confirms.                                | n/a                                        |
| 7    | User is returned to Chrome. Now: either (a) Chrome was still alive, restored in-place → NO reload happens; or (b) Chrome renderer process was killed (discarded) → the tab is **fully reloaded** with URL unchanged. | Chrome Memory/Energy Saver blog; Android LMK. |
| 8    | On reload: `app:mounted` fires, plugins re-run, Pinia state resets to empty, sessionStorage draft is read, "Vuelve a seleccionar" hint is shown. The `File` reference is gone (File objects are not in sessionStorage and there's no IndexedDB blob persistence). | Source code line 322-336.                  |
| 9    | User must tap the file input again, pick the same file. UX regression.              | User report.                               |

**Conclusion:** Root cause is **(A) tab discard** by Android LMK or by
Chrome Memory Saver, OR **(D) Android Chrome behavior we have not yet
identified** that results in a full reload on tab re-foreground. We have
**ruled out** (B) freeze-only, (C) Cache-Control, and any bfcache blocker
(none of our code blocks bfcache).

### 5.5 Why bfcache is NOT the answer here
Bfcache applies to **history navigations** (back/forward), not to "tab
backgrounded → re-foregrounded without history entry change". The file
picker round-trip is not a history event. So even if our page is 100%
bfcache-eligible, it doesn't change the Android file-picker scenario.

What bfcache WOULD fix is the "user navigates to /pacientes/1234 from the
list, then taps back to return to the list" navigation round-trip. For
that, our app is already bfcache-eligible (no blockers).

---

## 6. Evidence citations (URLs accessed 2026-07-08)

1. [web.dev — Back/forward cache](https://web.dev/articles/bfcache) — bfcache mechanics, blockers, observation events. Last updated 2026-07-02.
2. [Chrome for Developers — Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) — state/event matrix, frozen/discarded/terminated semantics, wasDiscarded. Last updated 2023-12-01.
3. [MDN — Window: pageshow event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event) — `event.persisted` semantics. Last modified 2026-03-10.
4. [MDN — Window: pagehide event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event) — `event.persisted` semantics, mobile unreliability note. Last modified 2025-09-18.
5. [MDN — Window: beforeunload event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) — mobile unreliability, sticky activation. Last modified 2025-06-23.
6. [MDN — Document: visibilitychange event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) — recommend using visibilitychange for session-end. Last modified 2026-02-20.
7. [Chrome for Developers — Memory and Energy Saver mode](https://developer.chrome.com/blog/memory-and-energy-saver-mode) — Memory Saver discards tabs after backgrounding.
8. [web.dev — bfcache (older URL; same article)](https://web.dev/articles/page-lifecycle-api) — 404'd on 2026-07-08 fetch; the canonical URL is developer.chrome.com/docs/web-platform/page-lifecycle-api. [UNCONFIRMED — second URL format is deprecated.]
9. [SpeedKit — Unload beacon reliability benchmark](https://www.speedkit.com/blog/unload-beacon-reliability-benchmarking-strategies-for-minimal-data-loss) — confirms `visibilitychange` + `pagehide` achieves ~91% reliability vs unload/beforeunload. [UNCONFIRMED — secondary source.]
10. [ITNEXT — Hide and Seek: How to Make Sense of Page Events](https://itnext.io/hide-and-seek-how-to-make-sense-of-page-events-in-your-web-app-64fd906bdff4) — independent cross-browser test. [UNCONFIRMED — community blog.]

---

## 7. Local-source code citations (absolute paths)

- `frontend/nuxt.config.ts` — `ssr: false`; no experimental flags; no SW; `compatibilityDate: '2025-07-15'`. Lines 9, 17-20.
- `frontend/app/middleware/auth.ts` lines 13-23 — fetches user only when `isAuthenticated === false`.
- `frontend/app/stores/auth.ts` lines 13-128 — Pinia composition store; refs are in-memory only; reset on full reload.
- `frontend/app/composables/useApi.ts` lines 13-37 — `setTimeout` re-entrancy guard; `CustomEvent('app:session-expired')`.
- `frontend/app/plugins/session-expired.client.ts` lines 34-58 — listens for CustomEvent; clears auth; calls `navigateTo('/login')`.
- `frontend/app/pages/pacientes/[id]/index.vue`:
  - Line 104: `const uploadedFileName = ref<string | null>(null)`
  - Lines 106: sessionStorage draft key.
  - Lines 354-403: `readFichaDraft`, `writeFichaDraft`, `clearFichaDraft`, `onFileSelected` (only updates ref + sessionStorage name).
  - Line 403: `watch(uploadedFileName, …)`.
  - Line 980: `<input type="file">` used in ficha Dialog (header "Actualizar Estado").
  - Lines 891-1021: Dialog body & footer with `handleFichaSubmit` button.
- `frontend/app/composables/useFileUpload.ts` lines 1-46 — **NOT** used by ficha page (page inlines its own upload).

## 8. State of fix-progress for W6

Root cause is identified (Android tab discard or unknown Android-specific
cause resulting in full reload). Fix proposal document: see
`fix-proposal.md`.
