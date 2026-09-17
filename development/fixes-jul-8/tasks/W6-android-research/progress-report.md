# Progress Report — W6 Android SPA Reload Research

## Task: Deep research on Android Chrome reload when file picker opens during ficha dialog

## Status: in_progress (started 2026-07-08)

## Phase 1: Codebase survey (complete)

Read all relevant source files:
- `frontend/nuxt.config.ts` — `ssr: false`, no experimental flags, no PWA module, no service-worker
- `frontend/app/app.vue` — minimal wrapper `<NuxtLayout><NuxtPage/></NuxtLayout>`
- `frontend/app/plugins/session-expired.client.ts` — listens for custom DOM event only; no `pagehide` / `visibilitychange` / `beforeunload` listeners
- `frontend/app/middleware/auth.ts` — only fetches user when `isAuthenticated === false`
- `frontend/app/stores/auth.ts` — Pinia store; refs persist for the lifetime of the JS context
- `frontend/app/composables/useApi.ts` — `$fetch.create` with `onResponseError` for 401; one `setTimeout` (re-entrancy guard)
- `frontend/app/composables/useFileUpload.ts` — not used by ficha page (page inlines its own upload)
- `frontend/app/pages/pacientes/[id]/index.vue` — ficha dialog uses a hidden `<input type="file">`; `onFileSelected` only updates local ref + sessionStorage draft (D1 mitigation); no listener on `pagehide`/`visibilitychange`
- `frontend/app/layouts/default.vue` — minimal; just route watcher to close mobile sidebar
- `frontend/app/components/AppSidebar.vue` — reads from auth store; no listeners

### Key code observations
- **NO** `addEventListener('beforeunload' | 'unload' | 'pagehide' | 'visibilitychange' | 'pageshow')` anywhere in app code
- **NO** WebSocket / EventSource / serviceWorker / IndexedDB usage
- **NO** PWA module installed (so no service worker registered by us)
- `nuxt.config.ts` has `ssr: false` + plain `pages/` directory (Nuxt 4 file-based routing)
- `app:session-expired` is a **CustomEvent** on document; completely independent of browser lifecycle

## Phase 2: External research (complete)

All 5 angles covered:
1. Android Chrome BFCache behavior for `<input type="file">` user-activation — sources/bfcache-android-chrome.md §1-3
2. Chrome's "freeze" / "discard" / "freezing-eligible" semantics on Android — sources/bfcache-android-chrome.md §2 + chrome.com/blog/memory-and-energy-saver-mode
3. Nuxt 4 client-side SPA re-mount vs BFCache restore — sources/nuxt-spa-lifecycle.md §1-3
4. File System Access API Android Chrome support — confirmed FileSystemDirectoryHandle/FileSystemFileHandle APIs exist but support is desktop-Chromium-only; out of scope for this fix
5. IndexedDB File object persistence — fix-proposal.md §A.1 (new useFileStash composable)

## Phase 3: Root cause reasoning (complete)

See result.md §5.4 for the 9-step trace. Conclusion: Android Chrome discards the tab while the file picker activity is in foreground. On user return, the tab is fully reloaded — JS heap wiped, Pinia store reset, File reference lost.

## Phase 4: Fix proposal (complete)

See fix-proposal.md. Recommended: Fix A — IndexedDB File stash (~70 LOC, HIGH confidence on user-visible fix).

## Status

complete. All 3 deliverables written:
- result.md (~280 lines)
- fix-proposal.md (~230 lines)
- completion-report.md (~120 lines)

TaskUpdate(taskId: "25", completed) + SendMessage dispatched.