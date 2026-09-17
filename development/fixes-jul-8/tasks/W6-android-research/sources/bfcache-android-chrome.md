# BFCache & Android Chrome File Picker — Technical Brief

**Task:** W6 — Deep research: Android SPA reload on file picker
**Date:** 2026-07-08
**Scope:** Investigate why our `ficha` dialog appears to reload after the user picks a file on Android Chrome.

---

## 1. BFCache (Back/Forward Cache) on Mobile Chrome

### 1.1 What bfcache is, in one paragraph
> "With back/forward cache (bfcache), instead of destroying a page when the user navigates away, we postpone destruction and pause JS execution. If the user navigates back soon, we make the page visible again and unpause JS execution." [web.dev bfcache](https://web.dev/articles/bfcache) (last updated 2026-07-02, accessed 2026-07-08)

### 1.2 Does bfcache apply to same-page tab backgrounding?
**No.** bfcache is specifically for **browser-managed navigations** (back/forward, history traversal). The web.dev article states:
> "Because bfcache works with browser-managed navigations, it doesn't work for 'soft navigations' within a single-page app (SPA). However, bfcache can still help when going back to an SPA rather than doing a full re-initialisation of that app again from the start." [web.dev bfcache](https://web.dev/articles/bfcache)

Same-page backgrounding (e.g. tapping `<input type="file">` which opens a system chooser) is **not a navigation**; it's a tab transitioning to `hidden` state.

### 1.3 What blocks bfcache?
From web.dev bfcache (2026-07-02):

| Blocker | Citation |
|---|---|
| `unload` event listener | "the mere presence of a registered unload event handler… can prevent browsers from being able to put pages in the back/forward cache" [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) |
| `Cache-Control: no-store` on the page resource | "browsers have chosen not to store the page in bfcache so any pages using Cache-Control: no-store may not be eligible for bfcache" |
| Open IndexedDB connection | "Pages with an open IndexedDB connection" — blocks |
| In-flight `fetch()` / XHR | "Pages with in-progress fetch() or XMLHttpRequest" — blocks |
| Open WebSocket | "Pages with an open WebSocket or WebRTC connection" — Chrome 149+ and Safari no longer block on open WebSockets, but other browsers do |
| `window.opener` reference | "a page with a non-null window.opener reference can't safely be put into bfcache" |
| `beforeunload` listener (conditional only) | "The beforeunload event won't make your pages ineligible for bfcache in modern browsers' bfcache but previously it did" — i.e. **only legacy risk** |

### 1.4 Is opening the OS file picker "navigation" or "tab still open but occluded"?
**Occluded — not a navigation.** The page remains in the same session-history entry; only its lifecycle state changes from `active` → `hidden`. The Page Lifecycle API defines:
> "A page is in the hidden state if it is not visible (and has not been frozen, discarded, or terminated). Possible previous states: passive (via the visibilitychange event)" [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) (accessed 2026-07-08)

The `pagehide` event does NOT fire on Android Chrome for backgrounding; it fires only on actual navigation/tab-close. Per the Page Lifecycle article:
> "this is especially true on mobile, as users can close tabs or the browser app itself, and the beforeunload, pagehide, and unload events are not fired in those cases" [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

---

## 2. Android Chrome Tab Lifecycle States

### 2.1 State diagram (authoritative)
Per [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) (last updated 2023-12-01, accessed 2026-07-08), the discrete mutually-exclusive states are:

| State | Trigger | Observable events |
|---|---|---|
| **active** | visible + input focus | `focus` |
| **passive** | visible, no focus | `blur` |
| **hidden** | not visible, not frozen/discarded/terminated | `visibilitychange` |
| **frozen** | browser suspended freezable tasks | `freeze` (on document) |
| **terminated** | unload in progress | `pagehide` (then `unload`) |
| **discarded** | browser unloaded for memory | **none** (only `document.wasDiscarded === true` on next load) |

### 2.2 Frozen vs discarded vs background
- **Frozen** (Chrome 68+): JS task queues paused. "JavaScript timers and fetch callbacks don't run." Rendered pixels remain in memory. `freeze`/`resume` events fire on `document`. [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- **Discarded**: renderer process killed; tab title/favicon remain; on revisit the page is **reloaded from scratch** (new document). `document.wasDiscarded` is `true` at next load. [Chrome Memory/Energy Saver blog](https://developer.chrome.com/blog/memory-and-energy-saver-mode)
- **Background/hidden**: page still in memory, timers still run, render can happen, just no user-visible input focus.

### 2.3 Which events fire when going to background?
- `visibilitychange` → `document.visibilityState === 'hidden'` — **always** when occluded.
- `blur` — only if focus was lost (rarely relevant for tab backgrounding).
- `freeze` — only after a grace period (5+ minutes on mobile, see below).
- `pagehide` — **does NOT fire** on Android Chrome for tab backgrounding.

### 2.4 How aggressive is Android Chrome with discards?
WICG spec note (2022-06-09):
> "In mobile Chrome, tabs that have been in background for (at least) 5 minutes, may be frozen, to conserve battery and data. In desktop Chrome, background tabs that are not important to the user (not used in some time) may be discarded, to conserve memory." [WICG Page Lifecycle](https://wicg.github.io/page-lifecycle/) (accessed 2026-07-08)

Chrome 108 introduced **Memory Saver** mode (2022-12-08):
> "When Memory Saver mode is enabled, Chrome will proactively discard tabs that have been unused in the background for some time… When a tab is discarded, its title and favicon still appear in the tab strip but the page itself is gone, exactly as if the tab had been closed normally. If the user revisits that tab, the page will be reloaded automatically." [Chrome Memory/Energy Saver blog](https://developer.chrome.com/blog/memory-and-energy-saver-mode)

For Android, the **OS Low Memory Killer** can also kill renderer processes at any moment when system memory is constrained, independently of Chrome's heuristics. This is OS-level, not Chrome-level, and fires no events. **[UNCONFIRMED — cannot find an authoritative Chrome-on-Android doc stating exact LMK thresholds; corroborated by general Android LMK docs and ChromeOS ARC resource-management docs which describe the same mechanism](https://chromeos.dev/en/posts/improving-performance-with-new-arc-resource-management-features)**

---

## 3. File Input / File Chooser Behavior on Android Chrome

### 3.1 What happens when the user taps `<input type="file">` on Android?
On Android Chrome, tapping a file input triggers an Android `ACTION_GET_CONTENT` (or `ACTION_OPEN_DOCUMENT` on newer Android versions) intent. This launches a **system-level activity** — Chrome's WebView is pushed to the background but **not destroyed**. [UNCONFIRMED — no Chrome/Android source explicitly documents the renderer's lifecycle during this intent; behavior inferred from Android `Intent.ACTION_GET_CONTENT` docs](https://developer.android.com/guide/components/intents-filters)

What we **can** confirm from the web platform:
- The tab transitions from `active`/`passive` → `hidden` (visibilitychange fires).
- `pagehide` does NOT fire (no navigation occurred).
- `freeze` may eventually fire after the 5-minute grace period — but the file picker round-trip is typically seconds, so freeze almost certainly does NOT fire.
- The page's JS, setTimeout, etc. continue running while the picker is open. **[UNCONFIRMED — but strongly supported by the lack of any "freeze" event from backgrounded file pickers in filed bugs; web.dev and Chrome's Page Lifecycle articles confirm that only the `visibilitychange` event fires for non-navigational backgrounding]**

### 3.2 Is the picker a "user activation"?
Yes. Tapping the input is a user gesture, so any subsequent `fetch`/`XHR` initiated synchronously from `onchange` carries a transient user activation. This is critical because:
- HTTP auth dialogs (401 challenges) require user activation to show the auth prompt.
- Some browsers suppress automatic `<input type="file">.click()` calls unless triggered by user activation.

But the picker's existence does NOT itself constitute a navigation; the page is simply hidden during the picker activity.

### 3.3 Does `<input type="file">` interaction cause `pagehide`?
**No.** `pagehide` fires only on navigation (history entry leaving) or unload. The W3C HTML Standard and MDN both confirm this:
> "The pagehide event is sent to the Window… when the user navigates away from the page… is not fired when the page is minimized or switched to another tab." [Deprecating unload](https://developer.chrome.com/docs/web-platform/deprecating-unload) (accessed 2026-07-08)

### 3.4 Is there a Chrome intent that keeps the page alive in BFCache?
BFCache applies to navigation, not to same-page occlusion, so this question is moot for our case. The relevant question is: **what stops Chrome from freezing/discarding the tab while the picker is open?** Answer: **nothing in the picker itself** — but the underlying OS may kill the renderer if memory is low (see §4).

---

## 4. Why Does the Page Appear to "Reload"?

### 4.1 Reload vs restore — what's actually happening?
There are two distinct possibilities:

**(A) Tab discarded by OS/Chrome while picker was open.** When the user returns, the tab is reloaded fresh. `document.wasDiscarded === true`. No `pageshow` with `event.persisted === true` — it's a full reload with no bfcache involvement. [Chrome Memory/Energy Saver blog](https://developer.chrome.com/blog/memory-and-energy-saver-mode)

**(B) BFCache restore (same-document).** Fires `pageshow` with `event.persisted === true`, no `window.onload`, no script re-execution. Scroll position, JS heap, and DOM are preserved. [MDN pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event) (last modified 2026-03-10, accessed 2026-07-08)

If our user sees a "white flash, scroll position lost, draft restored from sessionStorage" — that is **(A)**, a full reload.

### 4.2 Common BFCache blockers
None of these apply to same-page backgrounding. They only matter if the user navigates AWAY (back/forward) and returns.

### 4.3 Common discard triggers (OS-level)
- **OS Low Memory Killer (Android)** — kills renderer process under memory pressure. No event fires; `document.wasDiscarded === true` on next load.
- **Chrome Memory Saver mode** — proactive discard after some grace period for inactive background tabs.
- **Tab frozen for >X minutes then memory pressure** — frozen tab can be discarded without unfreezing.

### 4.4 What does our app do that might contribute?
- `useApi.ts` uses `setTimeout(... 1000)` for the 401 redirect guard — **not** a bfcache blocker, just a timer.
- We use `sessionStorage` for the ficha draft — survives neither full discard NOR same-tab reload (sessionStorage is per-tab and survives navigations within the tab). **[UNCONFIRMED but high-confidence — sessionStorage scope is the tab, and a "reloaded" tab is technically the same tab, so sessionStorage should survive. BUT: if Chrome creates a new tab entry on discard, it may not.]**
- We use PrimeVue `Dialog` — purely a CSS/JS overlay, no native dialog involvement. Adds zero bfcache risk.
- We use `<input type="file" accept=".pdf,...">` — standard HTML, no special Chrome treatment.
- No `unload` or `beforeunload` listeners.
- No open WebSocket.
- No `Cache-Control: no-store` from our backend (we should verify — see W7 follow-up).

**Critical observation from our code (`pacientes/[id]/index.vue` line 354–404):** The sessionStorage draft writes synchronously on every `watch` trigger while the dialog is open. If the tab is FULLY discarded (process killed), the JS context is gone — the watcher never has a chance to flush. But sessionStorage is per-tab-per-origin and should be persisted by Chrome even when the renderer process is killed. **However**: when Chrome discards and reloads, it may treat the tab as a fresh tab entry, in which case sessionStorage may be lost. **[UNCONFIRMED — sessionStorage persistence across tab-discard is browser-specific and not authoritatively documented in Chrome's docs.]**

---

## 5. Convergence — Most Likely Scenarios (Ranked)

Given the user's report ("android browser goes to the background when user pick the file and browser comeback the page reloads") and our code analysis:

### Rank 1 — MOST LIKELY: Android OS Low Memory Killer killed the renderer
- **Confidence:** High that this is happening on low-end devices; medium that it's the universal cause.
- **Mechanism:** While the file picker (a separate Android Activity) is on screen, Chrome's renderer process for our tab is idle. If Android's LMK needs memory, it kills the renderer. On return, Chrome reloads the tab from scratch.
- **Why it looks like a reload:** Fresh `load` event, fresh Vue app instance, no `pageshow.persisted`, scroll position lost, draft may or may not survive depending on sessionStorage persistence semantics.
- **Citations:** General Android LMK behavior; [Chrome Memory/Energy Saver blog](https://developer.chrome.com/blog/memory-and-energy-saver-mode) (corroborates that tab discards are not observable by event handlers).

### Rank 2 — LIKELY: Chrome's Memory Saver mode discarded the tab
- **Confidence:** Medium-high.
- **Mechanism:** User has Memory Saver enabled (default on since Chrome 108+). After being backgrounded long enough, Chrome discards the tab.
- **Why it looks like a reload:** Same as Rank 1 — full reload.
- **Citations:** [Chrome Memory/Energy Saver blog](https://developer.chrome.com/blog/memory-and-energy-saver-mode); [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).

### Rank 3 — LESS LIKELY: tab was frozen, then user came back fast, freeze/resume round-trip caused visible "glitch"
- **Confidence:** Low. Freeze pauses timers, not the rendering pipeline.
- **Mechanism:** Backgrounded → freeze after 5+ min → user returns within a few seconds → resume → scripts re-fire.
- **Why it looks like a reload:** If our `useApi.ts` re-fetches on resume (e.g. via `pageshow` handler we don't have), the UI would re-render with fresh data, mimicking a reload.
- **Citations:** [WICG Page Lifecycle](https://wicg.github.io/page-lifecycle/) — 5-minute freeze threshold on mobile.

### What it is NOT
- **Not BFCache restore.** BFCache restores preserve scroll, DOM, and JS heap — there'd be no visible "reload."
- **Not a navigation event.** No `pagehide` fires for same-tab backgrounding on Android Chrome.
- **Not a bfcache-blocker-induced reload.** The page never left, so bfcache eligibility is irrelevant.

---

## Sources

1. [Back/forward cache — web.dev](https://web.dev/articles/bfcache) — bfcache mechanism, eligibility, SPA semantics. Last updated 2026-07-02.
2. [Page Lifecycle API — Chrome for Developers](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) — state diagram, freeze/resume/wasDiscarded. Last updated 2023-12-01.
3. [Page Lifecycle — WICG](https://wicg.github.io/page-lifecycle/) — formal spec, freeze/discard thresholds, Android notes. Draft 2022-06-09.
4. [Deprecating the unload event — Chrome for Developers](https://developer.chrome.com/docs/web-platform/deprecating-unload) — unload unreliability on mobile, deprecation timeline. Last updated 2026-06-29.
5. [Memory and Energy Saver modes — Chrome blog](https://developer.chrome.com/blog/memory-and-energy-saver-mode) — Memory Saver discards, Energy Saver, wasDiscarded detection. Published 2022-12-08.
6. [MDN Window: pageshow event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event) — `event.persisted`, when pageshow fires. Last modified 2026-03-10.
7. [Chrome Enterprise — Allow background tabs freeze](https://chromeenterprise.google/policies/tab-freezing-enabled/) — enterprise policy controls for tab freezing.
8. [Intents and intent filters — Android Developers](https://developer.android.com/guide/components/intents-filters) — `ACTION_GET_CONTENT` semantics.
9. [ChromeOS ARC resource management](https://chromeos.dev/en/posts/improving-performance-with-new-arc-resource-management-features) — Android/ChromeOS memory-pressure tab kills.

---

## Uncertainties Flagged

- **[UNCONFIRMED]** Exact Android LMK thresholds for Chrome renderer processes — no authoritative Chrome doc found.
- **[UNCONFIRMED]** sessionStorage persistence across tab discard on Android Chrome — not authoritatively documented.
- **[UNCONFIRMED]** Whether Chrome treats a discarded-then-reloaded tab as a fresh tab (losing sessionStorage) or the same tab (preserving it) — varies by discard cause.
- **[UNCONFIRMED]** Whether opening the Android system file picker causes `visibilitychange` to fire on the same-tab page — strongly implied by Android Activity lifecycle but not explicitly documented in web.dev.