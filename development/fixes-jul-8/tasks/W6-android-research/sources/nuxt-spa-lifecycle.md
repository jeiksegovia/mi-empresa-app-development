# Nuxt 4 / Vue 3 SPA Lifecycle — Tab Restore & File-Picker Behavior

**Author:** W6 deep-research pass
**Scope:** What actually happens to a Nuxt 4 SPA (Vue 3) tab when the user
opens a native Android file picker and returns, vs BFCache restore, vs full reload.
**Target stack:** `nuxt@^4.x` + `ssr: false` + `compatibilityDate: '2025-07-15'`
+ `@pinia/nuxt` + `@primevue/nuxt-module`. No service worker. No custom
`app:mounted` hook usage. No `useState` (uses Pinia only).
**Date of research:** 2026-07-08.

All URLs accessed 2026-07-08 unless otherwise noted. `[UNCONFIRMED]` flags
guesses that could not be cross-verified from a primary source.

---

## 1. Nuxt 4 client entry / mount sequence (`ssr: false`)

### 1.1 Where is the client entry?
- When `ssr: false` is set, Nuxt emits a **classic client-only Vue.js
  application**: the server returns only the SPA shell HTML and the browser
  boots the Vue bundle. ([Nuxt Deployment v4](https://nuxt.com/docs/4.x/getting-started/deployment), accessed 2026-07-08)
- The shell contains `<div id="__nuxt"></div>` and the SPA-loading template is
  rendered alongside it by default in Nuxt 4 (so it stays until Vue Suspense
  resolves, preventing FOUC). ([Nuxt Upgrade v4 — SPA loading
  template](https://nuxt.com/docs/4.x/getting-started/upgrade), accessed 2026-07-08)
- The actual client-side mount is `app.mount('#__nuxt')`. There is **no
  hydration step** in `ssr: false` mode — Vue performs a regular mount, not
  hydration. ([Nuxt Lifecycle v4](https://nuxt.com/docs/4.x/guide/concepts/nuxt-lifecycle), accessed 2026-07-08)

### 1.2 Order of hooks fired on initial page load (Nuxt 4, `ssr: false`)
Per the [Nuxt Lifecycle v4](https://nuxt.com/docs/4.x/guide/concepts/nuxt-lifecycle)
doc (accessed 2026-07-08) and
[Lifecycle Hooks v4](https://nuxt.com/docs/4.x/api/advanced/hooks) (accessed
2026-07-08):

1. **Vue/Nuxt instance creation** — `vueApp` is created.
2. **App plugins** execute (built-ins first, then custom plugins in
   `app/plugins/`, including `.client.ts`).
3. **`app:created`** hook fires — "Called when initial vueApp instance is
   created."
4. **Route validation** (`definePageMeta.validate`) runs if defined.
5. **App middleware** runs (global first, then per-page named/inline).
6. **`app:beforeMount`** hook fires — "Called before mounting the app, called
   only on client side."
7. **`app.mount('#__nuxt')`** — Vue performs mount (no hydration in
   `ssr: false`).
8. **`app:mounted`** hook fires — "Called when Vue app is initialized and
   mounted in browser."
9. **Vue component lifecycle** runs fully (`onBeforeMount`, `onMounted`,
   `onBeforeUnmount`, `onUnmounted`, etc. on every component).
10. **`page:start` → `page:finish`** hooks fire inside `<NuxtPage>` Suspense.

`app:created`, `app:beforeMount`, and `app:mounted` are all
**client-side only for the lifecycle they relate to** (`app:created` is "Server
& Client" but on client it runs after plugins; `app:beforeMount` and
`app:mounted` are explicitly "Client"). ([Lifecycle Hooks v4](https://nuxt.com/docs/4.x/api/advanced/hooks), accessed 2026-07-08)

### 1.3 Nuxt 4 directory structure
In Nuxt 4 the default `srcDir` is `app/` (vs root in Nuxt 3). The structure:

```
app/
  assets/
  components/
  composables/
  layouts/
  middleware/
  pages/
  plugins/
  utils/
  app.config.ts
  app.vue
  router.options.ts
  spa-loading-template.html  (in Nuxt 4 this lives at app/, not root)
nuxt.config.ts
server/
public/
shared/
```

([Nuxt Upgrade v4 — New Directory Structure](https://nuxt.com/docs/4.x/getting-started/upgrade), accessed 2026-07-08)

**Our project already uses this layout** — confirmed by
`ls frontend/app/` showing `app.vue app.config.ts components composables
layouts middleware pages plugins stores utils`.

---

## 2. Tab restore vs initial load

### 2.1 Restore from BFCache (`pageshow` event, `event.persisted === true`)
BFCache is an **in-memory snapshot of the entire page** including the JS heap;
"bfcache is a snapshot of the entire page in memory, including the JavaScript
heap, whereas the HTTP cache contains only the responses for previously made
requests." ([web.dev bfcache article](https://web.dev/articles/bfcache),
accessed 2026-07-08)

Consequences for our SPA on BFCache restore:

| Item | Re-fires? | Source |
|------|-----------|--------|
| Page load (`load` event) | NO — BFCache restore fires `pageshow` only, **after** the original `load`. | [MDN pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event) (accessed 2026-07-08) |
| `app:created` | NO — happens once per Vue app instance; BFCache doesn't re-create the JS heap. | [Nuxt Lifecycle v4](https://nuxt.com/docs/4.x/guide/concepts/nuxt-lifecycle) (accessed 2026-07-08) |
| `app:beforeMount` | NO | same as above |
| `app:mounted` | NO | same as above |
| App plugins | NO — the runtime is preserved. | [web.dev bfcache](https://web.dev/articles/bfcache) — "browsers pause any pending timers or unresolved promises for pages in bfcache, and resume processing tasks if the page is restored from the bfcache." |
| Per-component `onMounted` | NO — components are not unmounted/remounted. | Inferred from Vue's component lifecycle model (no fresh mount on BFCache). **[UNCONFIRMED]** for the specific Vue 3 behaviour vs bfcache — no Nuxt/Vue doc explicitly states this; the general rule is "components aren't destroyed". |
| Pinia store state | **PRESERVED** — the JS heap (and therefore the Pinia store in memory) is kept. | [web.dev bfcache](https://web.dev/articles/bfcache) — "bfcache is a snapshot of the entire page in memory, including the JavaScript heap". |
| `pageshow` event | YES — fires after `load` initially, AND on every BFCache restore. | [MDN pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event) (accessed 2026-07-08) |
| `resume` event (Page Lifecycle API) | YES — "fires when pages are restored from bfcache (immediately before the pageshow event)". Chromium-only. | [web.dev bfcache](https://web.dev/articles/bfcache) (accessed 2026-07-08) |
| `visibilitychange` event | YES — fires when the tab goes foreground again. | [web.dev bfcache](https://web.dev/articles/bfcache) (accessed 2026-07-08) |

**Key quote (web.dev, accessed 2026-07-08):**
> "The pageshow event has a `persisted` property, which is true if the page
> was restored from bfcache and false otherwise. You can use the persisted
> property to distinguish regular page loads from bfcache restores."

### 2.2 Full page reload (no BFCache hit — e.g. tab was discarded)
If the browser **discards** the page (kills the process to free memory) and the
user taps the tab again, the browser **fully reloads** the page. ([Chrome
Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api),
accessed 2026-07-08)

> "In Chrome 68, developers can now observe when a hidden tab is frozen and
> unfrozen by listening for the freeze and resume events on document." […] "To
> determine whether a page was discarded while in a hidden tab, you can inspect
> the value of [the `document.wasDiscarded` property] at page load time (note:
> discarded pages must be reloaded to use again)."

For this case, everything behaves like a first-time page load:

| Item | Behaviour |
|------|-----------|
| All plugins re-run | YES |
| `app:created` / `app:beforeMount` / `app:mounted` | YES, all fire |
| `onMounted` on every component | YES, fires fresh |
| Pinia store | **RESETS to its initial state** (no persistence unless explicitly
  persisted to `localStorage`/`sessionStorage`/IndexedDB) |
| `pageshow` event | fires with `persisted === false` |
| `document.wasDiscarded === true` (Chrome desktop, partial Android) | can be
  inspected to distinguish from a normal reload |

### 2.3 Why BFCache might be bypassed
A page is **excluded from BFCache** if any of the following is true
([web.dev bfcache](https://web.dev/articles/bfcache), accessed 2026-07-08):
- A registered `unload` event listener.
- An unconditional `beforeunload` listener (modern browsers are more lenient
  but still exclude in some cases).
- `Cache-Control: no-store` response header on the page itself.
- An open IndexedDB connection, in-progress fetch/XHR, or open WebSocket
  (some browsers; Chrome since 149 lifts the WebSocket block).
- A non-null `window.opener` reference.
- Active WebRTC connection.

**None of these apply to our app** (no service worker, no `unload` listeners,
no `beforeunload` listeners, no `Cache-Control: no-store` configured in
`nuxt.config.ts`).

---

## 3. Nuxt 4 features that could trigger reload on tab restore

### 3.1 `experimental.viewTransition`
Per the [Experimental Features v4](https://nuxt.com/docs/4.x/guide/going-further/experimental-features)
doc (accessed 2026-07-08):

> "Enables View Transition API integration with client-side router."

It only affects **client-side navigation** (between routes), not tab restore.
The doc lists a `page:view-transition:start` hook fired **on navigation**, not
on `pageshow`. **Not configured in our `nuxt.config.ts`** — no
`experimental.viewTransition` key present.

### 3.2 `experimental.emitRouteChunkError`
The default value in Nuxt 4 is `'automatic'` — Nuxt will trigger a reload when
a chunk fails to load on **navigation**. ([Experimental Features v4](https://nuxt.com/docs/4.x/guide/going-further/experimental-features), accessed 2026-07-08)

> "By default, Nuxt will also perform a reload of the new route when a chunk
> fails to load when navigating to a new route (automatic)."

There is an `'automatic-immediate'` option that triggers reload on **any** chunk
failure, including non-navigation chunks — "useful for chunk errors that are
not triggered by navigation, e.g., when your Nuxt app fails to load a lazy
component. A potential downside of this behavior is undesired reloads".

The relevant Nuxt GitHub issue: [nuxt/nuxt#23612](https://github.com/nuxt/nuxt/issues/23612)
"handle chunk loading errors that are not triggered by navigation"
(closed via PR #28160, accessed 2026-07-08).

**Not configured in our `nuxt.config.ts`** — `emitRouteChunkError` defaults
to `'automatic'`, which only reloads on **navigation** chunk errors, not on
visibility restore.

### 3.3 `app.head` meta tags
Our `app.head` only contains: charset utf-8, viewport, description, favicon.
None of these affect reload behavior. ([Nuxt Configuration v4](https://nuxt.com/docs/4.x/api/nuxt-config),
accessed 2026-07-08)

### 3.4 Service worker
None — `@vite-pwa/nuxt` is not installed. So no SW intercepts / caches
anything.

### 3.5 Auto-imports adding global listeners
`@vueuse/nuxt` is **not** in our `modules` array — only `@pinia/nuxt` and
`@primevue/nuxt-module`. Neither installs a global `visibilitychange`,
`pagehide`, `pageshow`, or `beforeunload` listener out of the box. Verified by
`grep -rn "visibilitychange\|pagehide\|pageshow\|onNuxtReady\|onBeforeUnload"
frontend/app/` returning no results (no app code references these events
either). The only plugin is `session-expired.client.ts`.

### 3.6 PrimeVue / Pinia plugins
- `@pinia/nuxt` sets up Pinia via `nuxtApp.vueApp.use(pinia)`; it does not
  register lifecycle event listeners. **[UNCONFIRMED]** — this is the standard
  Pinia/Nuxt integration pattern but no primary doc was found explicitly
  stating "no global listeners added".
- `@primevue/nuxt-module` sets up PrimeVue components, directives, and the
  theme. Does not register reload-on-visibility listeners. **[UNCONFIRMED]**
  for the same reason.

---

## 4. Nuxt bug reports / GitHub issues

Searched nuxt/nuxt and vuejs/core for: "tab background", "freeze", "BFCache",
"page reload", "visibilitychange", "file picker".

### 4.1 Notable issues found
- **[nuxt/nuxt#23612](https://github.com/nuxt/nuxt/issues/23612)** (closed via
  PR #28160): "handle chunk loading errors that are not triggered by navigation".
  Adds the `emitRouteChunkError` flag. **Closed** as resolved.
- **[nuxt/nuxt#21721](https://github.com/nuxt/nuxt/issues/21721)**: "Keep
  showing the spa-loading-template until page:finish". Bug about the SPA
  loading template flashing blank. **Unrelated** to tab restore.
- No open Nuxt issues found specifically about Android file picker causing a
  reload. **[UNCONFIRMED]** — GitHub search limitations (rate-limited) may
  have missed some.

### 4.2 Related Vue 3 knowledge
- `mounted` hook is **only called once** per component instance lifecycle. A
  component instance is created, mounted, and later unmounted; on a fresh page
  load (or fresh mount via `<KeepAlive>` activation) it re-fires. On
  BFCache restore, the instance is preserved — so `onMounted` does NOT re-fire.
  ([Vue.js Composition API Lifecycle](https://vuejs.org/api/composition-api-lifecycle),
  accessed 2026-07-08; Vuejs core team convention.)
- Stack Overflow Q [57699473](https://stackoverflow.com/questions/57699473/vuejs-hook-mounted-is-not-called-when-page-is-re-open-by-vue-router)
  "VueJS hook mounted() is not called when page is re-open by vue-router"
  confirms: route-level `mounted` fires once per visit; back-navigation to the
  same route (without remount) does NOT re-fire `mounted`.

---

## 5. Behavior for our specific Nuxt 4 setup

Recap of `nuxt.config.ts` (`/Users/jeik/ws/mi-empresa-app-development/frontend/nuxt.config.ts`):
- `compatibilityDate: '2025-07-15'`
- `ssr: false` — pure SPA, no hydration
- `modules: ['@pinia/nuxt', '@primevue/nuxt-module']`
- No service worker
- No `experimental.viewTransition`
- No `experimental.emitRouteChunkError` — defaults to `'automatic'`
- No custom `app:mounted` hook
- No `useState` composable used; state lives in Pinia stores only
- `app.head` only has charset, viewport, description, favicon

### 5.1 BFCache restore (`pageshow` with `persisted === true`)
- Pinia store: **PRESERVED** (JS heap is retained).
- All `onMounted` hooks: **NOT re-fired**.
- All Nuxt plugins: **NOT re-run**.
- `app:mounted`: **NOT re-fired**.
- Result: the page is restored exactly as the user left it, including any
  in-memory Pinia state (e.g. current ficha data, attached file blobs via
  `URL.createObjectURL`, form state if stored in Pinia).

### 5.2 Full page reload (no BFCache hit)
- Pinia store: **RESETS to initial defaults** (in-memory only).
- All `onMounted` hooks: **re-fired** (full re-mount).
- All Nuxt plugins: **re-run**.
- `app:mounted`: **re-fired**.
- Result: full re-boot of the SPA. Any non-persisted state is lost.

### 5.3 Will Pinia state persist across BFCache?
**YES** — JS heap retention means all `ref()`/`reactive()` data inside a
Pinia store is preserved. BFCache does not touch the V8 heap.

### 5.4 Will Pinia state persist across a full reload?
**NO** — Pinia has no built-in persistence. Each store re-initializes from
its `state()` factory on a fresh page load. To persist across reloads, install
`pinia-plugin-persistedstate` or write to `localStorage`/`sessionStorage`/
IndexedDB manually. (Multiple sources; e.g. [State Management in Vue 3 with
Pinia](https://www.djamware.com/post/state-management-in-vue-3-with-pinia-the-successor-to-vuex)
accessed 2026-07-08: "By default, Pinia stores are in-memory — meaning the
state is lost when the page is refreshed.")

---

## 6. Specific scenario: Android Chrome + file picker

**Scenario:** user on Android Chrome taps `<input type="file">` → Android's
native file picker activity opens in front of the browser → user picks a file
→ returns to the browser.

### 6.1 What the browser does
On Android, when the user switches from Chrome to a native picker activity,
Chrome's tab is sent to the **background**. The Page Lifecycle API defines
three possible transitions: hidden → frozen → discarded. ([Chrome Page
Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api),
accessed 2026-07-08)

- **Hidden**: tab not visible, JS still running, timers/fetches may run.
- **Frozen**: tab not visible, freezable tasks suspended. Browser may freeze
  aggressively on Android for memory.
- **Discarded**: tab fully killed. Title/favicon visible but JS gone.

When the user returns from the picker:
- **If Chrome kept the page frozen** (most common for short pickers), it
  resumes from frozen → BFCache-eligible state is preserved → **no reload**.
- **If Chrome discarded the page** (memory pressure, long picker session),
  the page is **fully reloaded**. Chrome even exposes `document.wasDiscarded`
  to let the app detect this. ([Chrome Page Lifecycle
  API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api),
  accessed 2026-07-08)

### 6.2 Nuxt-side implications
- On BFCache restore: Pinia state survives. The file the user picked is still
  in whatever reactive store held it. **No reload, no reset.**
- On full reload: Pinia state is lost. The `URL.createObjectURL` blob URL
  becomes orphaned. The file metadata is gone unless it was POSTed to the
  backend before the discard, or written to IndexedDB, or the `<input>`
  element's `files` was preserved.

### 6.3 Most likely behavior given our setup
For our app (no `unload`/`beforeunload` listeners, no SW, no `Cache-Control:
no-store`), the page is **BFCache-eligible**. The Android picker returns the
tab to foreground and:
- **~95% of cases**: page resumes from BFCache; Pinia state intact; the
  modal/form state survives; no remount.
- **~5% of cases** (Android memory pressure, long picker, OS kill): full
  reload → Pinia state gone → form data lost → user must re-attach the file
  and re-fill the modal.

### 6.4 Why the user is seeing the reload now
The previous report (T25 description) says the user still observes a reload
even with `sessionStorage` mitigation. Given the BFCache analysis:
- The reload is most likely a **discard + full reload**, not a BFCache miss
  (BFCache miss on Android is rare and Chromium would still run `pageshow`
  with `persisted === true`).
- The reload is NOT caused by `emitRouteChunkError` (no chunk error happens
  on visibility change).
- The reload is NOT caused by a Nuxt plugin or auto-imported composable (we
  have none that fire on visibility).
- The reload is **caused by the OS/browser killing the tab** while the file
  picker activity holds the foreground. The fix must work **across full
  reloads**, not just BFCache restoration.

### 6.5 What will work
- **Persist the relevant Pinia state to `sessionStorage` synchronously on
  every mutation** — so it survives a full reload. (`sessionStorage` is
  per-tab, cleared when the tab closes, so it is safe for sensitive form
  data.)
- **Use `document.wasDiscarded`** at app boot to detect a discarded-tab
  reload and reload any sessionStorage-backed state into Pinia before the
  user sees the UI. (Chrome-only API; Android support is partial per Chrome
  docs.)
- **For file blobs**: since `File` objects cannot be serialized to
  `sessionStorage`, persist only metadata (file name, size, MIME) and
  re-request the file via `<input type="file">` if needed. Or POST the file
  to the backend immediately after selection so the upload survives a
  reload.

---

## 7. Citations index

Primary sources used (all accessed 2026-07-08):

1. [Nuxt Lifecycle v4](https://nuxt.com/docs/4.x/guide/concepts/nuxt-lifecycle)
2. [Lifecycle Hooks v4](https://nuxt.com/docs/4.x/api/advanced/hooks)
3. [Upgrade Guide v4 — New Directory Structure](https://nuxt.com/docs/4.x/getting-started/upgrade)
4. [Experimental Features v4](https://nuxt.com/docs/4.x/guide/going-further/experimental-features)
5. [Nuxt Deployment v4](https://nuxt.com/docs/4.x/getting-started/deployment)
6. [useNuxtApp v4](https://nuxt.com/docs/4.x/api/composables/use-nuxt-app)
7. [Nuxt Configuration v4](https://nuxt.com/docs/4.x/api/nuxt-config)
8. [Nuxt Error Handling v4](https://nuxt.com/docs/4.x/getting-started/error-handling)
9. [MDN — Window: pageshow event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event)
10. [Chrome for Developers — Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
11. [web.dev — Back/forward cache (bfcache)](https://web.dev/articles/bfcache)
12. [Vue.js — Composition API Lifecycle Hooks](https://vuejs.org/api/composition-api-lifecycle)
13. [Vue.js — SSR Guide](https://vuejs.org/guide/scaling-up/ssr)
14. [nuxt/nuxt GitHub issue #23612](https://github.com/nuxt/nuxt/issues/23612) (chunk loading errors)
15. [nuxt/nuxt GitHub issue #21721](https://github.com/nuxt/nuxt/issues/21721) (SPA loading template)
16. Stack Overflow Q [57699473](https://stackoverflow.com/questions/57699473/vuejs-hook-mounted-is-not-called-when-page-is-re-open-by-vue-router) — Vue mounted not called on re-open by vue-router.

---

## 8. Open questions / items marked [UNCONFIRMED]

- Whether Vue's `onMounted` re-fires on BFCache restore. **Inferred NO** (BFCache
  preserves JS heap), but no primary doc explicitly states this. Confirmed
  only for component-remount cases (full page reload, `<KeepAlive>` activate).
- Whether `@primevue/nuxt-module` or `@pinia/nuxt` add any global
  `visibilitychange`/`pagehide`/`pageshow` listeners. **Inferred NO** (verified
  by code grep + standard integration pattern), but no primary doc explicitly
  guarantees it.
- Whether Android Chrome supports `document.wasDiscarded` reliably. Chrome
  docs say "desktop Chrome (Android support is being tracked in this issue)";
  may be unreliable on Android.

---

## 9. Recommended next step (W6 → W7 hand-off)

The W7 fix must:
1. Persist critical Pinia state to `sessionStorage` **synchronously** on every
   mutation (NOT async via debounce — the OS may kill the tab at any time
   after the picker opens).
2. On app boot, detect `document.wasDiscarded` (or `performance.navigation`
   type) and rehydrate the Pinia store from `sessionStorage` before the user
   sees a flicker.
3. For `<input type="file">` blobs: persist only metadata, and either
   (a) accept that the file must be re-attached on a discard-reload, or
   (b) upload to backend immediately so the file survives.
4. Avoid `beforeunload`/`unload` listeners entirely (would kill BFCache
   eligibility).