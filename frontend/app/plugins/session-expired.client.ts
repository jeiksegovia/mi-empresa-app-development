/**
 * session-expired.client.ts — listens for the `app:session-expired` DOM event
 * dispatched by `useApi` when a 401 is observed.
 *
 * Why a plugin instead of doing the work inside the interceptor?
 *   The `$fetch` `onResponseError` callback fires asynchronously, AFTER the
 *   Vue component's setup() has returned. Calling Nuxt auto-imported
 *   composables (useAuthStore, useToast, useRoute, navigateTo) inside that
 *   callback triggers a "Vue warn: inject() can only be used inside setup()"
 *   warning. Plugins run during app setup, so this side-effect code lives
 *   in a safe context.
 *
 * Note on toast: PrimeVue's `useToast()` requires a mounted `<Toast />`
 * component. /login (and some other pages) don't render one, so we render
 * a minimal toast HTML ourselves via the app's `.p-toast` container if
 * present; otherwise we skip the toast and rely on the redirect alone.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  function renderFallbackToast(summary: string, detail: string) {
    // Find or create a portal container.
    let host = document.querySelector('[data-session-toast]')
    if (!host) {
      host = document.createElement('div')
      host.setAttribute('data-session-toast', '1')
      host.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;max-width:360px;background:#fffbeb;border:1px solid #f59e0b;color:#78350f;padding:.75rem 1rem;border-radius:.5rem;box-shadow:0 10px 25px rgba(0,0,0,.1);font:14px/1.4 system-ui;'
      document.body.appendChild(host)
    }
    host.innerHTML = `<strong style="display:block;margin-bottom:2px">${summary}</strong><span>${detail}</span>`
    setTimeout(() => { host?.remove() }, 4500)
  }

  document.addEventListener('app:session-expired', () => {
    const authStore = useAuthStore()
    authStore.user = null
    authStore.isAuthenticated = false

    // Skip redirect + toast if the user is already on /login.
    const route = useRoute()
    if (route.path === '/login') return

    // Try the PrimeVue toast first; if it has no container mounted, fall back
    // to a tiny in-DOM banner.
    try {
      const toast = useToast()
      toast.add({
        severity: 'warn',
        summary: 'Sesión expirada',
        detail: 'Por favor inicia sesión nuevamente.',
        life: 4000,
      })
    } catch {
      renderFallbackToast('Sesión expirada', 'Por favor inicia sesión nuevamente.')
    }

    navigateTo('/login', { replace: true })
  })
})
