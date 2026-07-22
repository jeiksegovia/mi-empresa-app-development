/**
 * useApi — composable that wraps `$fetch` with:
 *  - Base URL from runtime config
 *  - Cookie credentials (httpOnly session cookie)
 *  - Global 401 handler: dispatches a DOM event (consumed by the
 *    `app:session-expired.client.ts` plugin) so all side-effects
 *    (state clear, toast, navigation) run inside a valid setup() context.
 *    On non-client (SSR), the event is a no-op anyway because the whole app
 *    is `ssr: false`.
 *  - Tiny re-entrancy guard so a burst of 401s can't dispatch twice.
 *  @todo: evaluate if its truly necesary, and this artifact could be simplified
 */

const FIRED_FLAG = '__apiRedirecting401'

export const useApi = () => {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase

  const apiFetch = $fetch.create({
    baseURL,
    credentials: 'include',
    onResponseError({ response }) {
      if (!import.meta.client) return

      // §1.5 (fixes-jul17-2): 403 DOMAIN_FORBIDDEN → surface the shared
      // "Acceso no permitido" toast so a denied API call is never a silent
      // failure. Handled here so every page gets it uniformly.
      if (response.status === 403 && (response._data as any)?.code === 'DOMAIN_FORBIDDEN') {
        try {
          document.dispatchEvent(new CustomEvent('app:access-denied', {
            detail: { message: (response._data as any)?.message || 'Acceso no permitido para su perfil.' },
          }))
        } catch { /* noop */ }
        return
      }

      if (response.status !== 401) return
      if ((window as any)[FIRED_FLAG]) return
      ;(window as any)[FIRED_FLAG] = true
      setTimeout(() => { (window as any)[FIRED_FLAG] = false }, 1000)

      // Hand off to the plugin; do not touch useAuthStore / useToast /
      // navigateTo here — this callback runs after the calling setup() has
      // returned, so Vue's inject() would throw a "can only be used inside
      // setup()" warning.
      try {
        document.dispatchEvent(new CustomEvent('app:session-expired'))
      } catch { /* noop */ }
    },
  })

  return {
    apiFetch,
    baseURL,
  }
}

