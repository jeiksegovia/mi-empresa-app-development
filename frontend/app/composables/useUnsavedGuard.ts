/**
 * useUnsavedGuard — guard for forms with unsaved local changes.
 *
 * Wires up TWO leave paths:
 *
 *  1) SPA navigation (Nuxt router → `onBeforeRouteLeave`). When the route is
 *     about to change AND the form is dirty, the user is shown a confirm()
 *     dialog. Returning false from the leave callback aborts navigation.
 *
 *  2) Browser-level unload (tab close / reload / external nav) via the native
 *     `beforeunload` event. We set `event.returnValue = ''` per the WHATWG
 *     spec so the browser shows its own "Leave site?" prompt.
 *
 * Usage (auto-imported as a Nuxt composable):
 *
 *   const form = reactive({...})
 *   const dirty = ref(false)
 *   const { markDirty, markClean } = useUnsavedGuard(() => dirty.value)
 *
 *   // user types → markDirty()
 *   // successful save → markClean() (then navigateTo)
 *
 * The composable is SSR-safe: the beforeunload listener is only attached when
 * `import.meta.client` is true. Cleanup happens on scope dispose (component
 * unmount), so navigating away automatically removes the listeners.
 */

import { onBeforeRouteLeave } from '#imports'
import { onScopeDispose } from 'vue'

export interface UseUnsavedGuardOptions {
  /** Confirm message shown by both the SPA prompt and (browsers will override
   *  this string) the native beforeunload dialog. Defaults to a Spanish
   *  message matching the rest of the UI. */
  message?: string
}

export interface UseUnsavedGuardReturn {
  /** Mark the form dirty. Equivalent to setting the underlying ref directly,
   *  but exposed for symmetry with markClean. */
  markDirty: () => void
  /** Mark the form clean — call after a successful save so the guard stops
   *  blocking navigation. */
  markClean: () => void
  /** Current dirty state — useful for the page's own UI (e.g. an asterisk on
   *  the title, a warning chip next to the Save button). */
  isDirty: () => boolean
}

const DEFAULT_MESSAGE =
  'Tienes cambios sin guardar. ¿Seguro que quieres salir de esta página?'

export function useUnsavedGuard(
  dirtyGetter: (() => boolean) | { value: boolean },
  opts: UseUnsavedGuardOptions = {},
): UseUnsavedGuardReturn {
  const message = opts.message ?? DEFAULT_MESSAGE

  // Normalize the input so callers can pass either a ref, a reactive getter,
  // or a plain ref/reactive object.
  const getDirty = (): boolean => {
    if (typeof dirtyGetter === 'function') return !!dirtyGetter()
    return !!(dirtyGetter as { value: boolean }).value
  }

  // ─── 1) SPA route guard ──────────────────────────────────────────────────
  // `onBeforeRouteLeave` is vue-router's per-component leave hook. Returning
  // false cancels the navigation; here we cancel ONLY when dirty.
  onBeforeRouteLeave((_to, _from) => {
    if (!getDirty()) return true
    // eslint-disable-next-line no-alert
    const ok = window.confirm(message)
    return ok
  })

  // ─── 2) Browser-level unload (tab close, reload, external nav) ──────────
  // The browser shows its own prompt; per the spec the message text is ignored
  // by most browsers (they use a fixed string). Setting returnValue is the
  // canonical trigger.
  function beforeUnloadHandler(e: BeforeUnloadEvent) {
    if (!getDirty()) return undefined
    e.preventDefault()
    e.returnValue = '' as unknown as string
    return '' as unknown as string
  }

  if (import.meta.client) {
    window.addEventListener('beforeunload', beforeUnloadHandler)
  }

  // ─── 3) Cleanup on scope dispose ────────────────────────────────────────
  // Removing the beforeunload listener when the component unmounts avoids
  // leaks across page navigations (Nuxt may keep the SPA instance mounted).
  onScopeDispose(() => {
    if (import.meta.client) {
      window.removeEventListener('beforeunload', beforeUnloadHandler)
    }
  })

  return {
    markDirty: () => {
      if (typeof dirtyGetter !== 'function') {
        ;(dirtyGetter as { value: boolean }).value = true
      }
      // For function getters, the caller owns the dirty state — this method
      // is a no-op. Documented so callers don't get surprised.
    },
    markClean: () => {
      if (typeof dirtyGetter !== 'function') {
        ;(dirtyGetter as { value: boolean }).value = false
      }
    },
    isDirty: getDirty,
  }
}