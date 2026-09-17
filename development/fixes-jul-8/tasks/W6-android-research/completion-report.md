# W6 — Completion Report: Android SPA Reload Research

**Task:** `[25]` W6 — Deep research: Android SPA reload on file picker
**Type:** research-only (no production code changes)
**Date:** 2026-07-08
**Status:** complete

---

## Summary

**Root cause (one-liner):** Android Chrome **discards the tab's renderer
process** (Memory Saver mode or OS-level LMK) when the file picker activity
takes focus, causing a **full page reload on re-foreground** — the JS heap
is wiped, Pinia store resets, and the `File` reference held in the ficha
component is lost.

**Confidence:** MEDIUM-HIGH. W3's existing D1 mitigation (sessionStorage
draft persistence) **survives** full reload, proving the reload is real.
The discarded-tab hypothesis is consistent with Chrome Memory Saver
behaviour documented by Google; the OS-level LMK path is `[UNCONFIRMED]`
but consistent with general Android memory management.

**Why bfcache is NOT the fix:** bfcache applies to history-navigation
round-trips (back/forward), not to "tab backgrounded → file picker →
tab re-foregrounded". The file picker round-trip is not a navigation.
Our app is already fully bfcache-eligible (audited).

---

## What was researched

1. **Web page lifecycle background** — states (active/passive/hidden/frozen/
   terminated/discarded) and events (focus/blur/visibilitychange/freeze/
   resume/pageshow/pagehide/beforeunload/unload). Authoritative source:
   [Chrome Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
   + [MDN specs](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event).
2. **BFCache mechanics + eligibility blockers** — what blocks (unload handlers,
   no-store headers, open IndexedDB connections, WebSockets, window.opener),
   what does NOT block (pagehide/pageshow/visibilitychange listeners). Source:
   [web.dev bfcache](https://web.dev/articles/bfcache).
3. **Mobile vs desktop lifecycle behavior** — why `beforeunload`/`unload`/
   `pagehide` are unreliable on mobile, why `visibilitychange` is the
   canonical mobile-safe session-end signal. Source: MDN beforeunload &
   Page Lifecycle API.
4. **Android file picker → tab behavior** — Android dispatches
   `Intent.ACTION_GET_CONTENT` which launches a separate system activity; the
   Chrome tab transitions active → hidden; no `pagehide` fires.
5. **SPA + Nuxt 4 interaction** — `ssr: false` means no hydration, so a full
   reload re-runs all plugins, `app:created`, `app:beforeMount`,
   `app:mounted`, and per-component `onMounted`. Pinia store resets to
   initial defaults unless externalized.
6. **Standard form-state persistence pattern** — write on `visibilitychange
   === 'hidden'` (or `pagehide`), read on `pageshow` regardless of
   `event.persisted` (since full reload does not yield `persisted === true`).
7. **File/Blob persistence in IndexedDB** — `File` cannot be JSON-serialized
   but `Blob` can; `new File([blob], name, { type })` reconstructs it.

## What was confirmed in the codebase

- `frontend/nuxt.config.ts` → `ssr: false`; no experimental flags, no SW.
- `frontend/app/pages/pacientes/[id]/index.vue`:
  - Line 980: the `<input type="file">` used in Actualizar Estado dialog.
  - Lines 354-403: D1 mitigation — writes form draft to `sessionStorage`.
  - W3's draft restores **file NAME only**, prompts user to re-pick.
- **NO** listener on `pagehide`/`pageshow`/`visibilitychange`/
  `beforeunload`/`unload`/`freeze`/`resume` anywhere in the app
  (verified by grep).
- **NO** IndexedDB usage anywhere in the app (verified by grep).
- **NO** WebSocket / EventSource / ServiceWorker.
- **NO** `Cache-Control: no-store` (verified).

## Deliverables

1. **`result.md`** — Full research document with state/event matrix, mobile
   vs desktop lifecycle behavior, standard persistence pattern, step-by-step
   reasoning trail, evidence citations with access dates.
2. **`fix-proposal.md`** — Four fix options (A/B/C/D) with confidence levels,
   concrete code-level diffs for Fix A (IndexedDB File stash) including
   exact file paths, before/after excerpts, risk assessment, and QA plan.
3. **`completion-report.md`** — this file.

## Key decisions / deviations / issues encountered

- **Deviation:** This task was originally scoped as "file-picker Android
  reload" research only. The fix-proposal IS provided (the task explicitly
  asks for it), but the production code change is deferred to W7.
- **Issue:** The Android-specific reload trigger is **inferred** from
  documented Chrome Memory Saver behaviour + Android LMK + the fact that
  D1's sessionStorage draft persists. No definitive Chrome-on-Android
  documentation explicitly states "file picker round-trip discards tab in
  Memory Saver mode". This is flagged `[UNCONFIRMED]` in `result.md` §5.1.
- **Issue:** `[UNCONFIRMED]` flag on web.dev bfcache where the older URL
  `https://web.dev/articles/page-lifecycle-api` returns 404; canonical URL
  is the developer.chrome.com version.

## Hand-off to W7 (frontend fixes)

- **Recommended:** implement Fix A from `fix-proposal.md` (~70 LOC new
  composable + 4 small edits in the ficha page).
- **Optional defense-in-depth:** Fix B (title-updater) in the ficha Dialog.
- **NO action needed** on Fix C (bfcache eligibility audit — already
  eligible).
- **Verification:** re-test the Android file-picker round-trip after
  applying Fix A. The sessionStorage "Vuelve a seleccionar" hint should
  NOT show if Fix A works.

## Acceptance criteria check (per task assignment)

| AC                                                                | Status |
|-------------------------------------------------------------------|--------|
| 1. Root cause named specifically                                  | DONE   — Android Chrome tab discard (Memory Saver / LMK)                          |
| 2. Step-by-step reasoning traceable from evidence                 | DONE   — `result.md` §5.4 with 9-step trace                                       |
| 3. At least 2 fix options proposed                               | DONE   — A, B, C, D in `fix-proposal.md`                                          |
| 4. Each fix has confidence level + code-level detail             | DONE   — confidence levels + diffs in `fix-proposal.md`                            |
| 5. Report ≤ 500 lines                                             | DONE   — `result.md` ~280 lines                                                   |

## Links (all accessed 2026-07-08)

- web.dev bfcache: https://web.dev/articles/bfcache
- Chrome Page Lifecycle API: https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- MDN pageshow: https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event
- MDN pagehide: https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event
- MDN beforeunload: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
- MDN visibilitychange: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
- Chrome Memory/Energy Saver: https://developer.chrome.com/blog/memory-and-energy-saver-mode
- SpeedKit unload-beacon benchmark (secondary): https://www.speedkit.com/blog/unload-beacon-reliability-benchmarking-strategies-for-minimal-data-loss
- ITNEXT — Hide and Seek (secondary): https://itnext.io/hide-and-seek-how-to-make-sense-of-page-events-in-your-web-app-64fd906bdff4

---
