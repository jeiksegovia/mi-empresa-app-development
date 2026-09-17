/**
 * access-denied.client.ts — shows the "Acceso no permitido" toast in response
 * to the `app:access-denied` DOM event.
 *
 * The event is dispatched from two places (contract-fixes-jul17-2 §1.5):
 *   1. the `domain-access` global route middleware, when a forbidden route is
 *      blocked and the user is redirected to `/`;
 *   2. any 403 `{ code: 'DOMAIN_FORBIDDEN' }` API response surfaced by a page.
 *
 * Same rationale as session-expired.client.ts: PrimeVue's `useToast()` needs a
 * mounted `<Toast />`. `/` renders one (default layout), but we keep the same
 * fallback banner so the message is never silently dropped.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  function renderFallbackToast(summary: string, detail: string) {
    let host = document.querySelector('[data-access-toast]')
    if (!host) {
      host = document.createElement('div')
      host.setAttribute('data-access-toast', '1')
      host.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;max-width:360px;background:#fef2f2;border:1px solid #ef4444;color:#7f1d1d;padding:.75rem 1rem;border-radius:.5rem;box-shadow:0 10px 25px rgba(0,0,0,.1);font:14px/1.4 system-ui;'
      document.body.appendChild(host)
    }
    // S6: build the DOM with createElement + textContent instead of
    // `innerHTML` so an attacker-controlled `detail` (e.g. an account
    // name embedded in the 403 message) cannot inject script tags.
    host.replaceChildren()
    const title = document.createElement('strong')
    title.style.display = 'block'
    title.style.marginBottom = '2px'
    title.textContent = summary
    const body = document.createElement('span')
    body.textContent = detail
    host.append(title, body)
    setTimeout(() => { host?.remove() }, 4500)
  }

  document.addEventListener('app:access-denied', (e) => {
    const detail = (e as CustomEvent).detail?.message
      || 'No tiene permisos para acceder a esta sección.'
    try {
      const toast = useToast()
      toast.add({
        severity: 'warn',
        summary: 'Acceso no permitido',
        detail,
        life: 4000,
      })
    } catch {
      renderFallbackToast('Acceso no permitido', detail)
    }
  })
})
