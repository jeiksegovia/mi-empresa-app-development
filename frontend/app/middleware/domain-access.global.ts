import { domainForPath, useDomainAccess } from '~/composables/useDomainAccess'

/**
 * domain-access.global.ts — RBAC route gating (contract-fixes-jul17-2 §1.5).
 *
 * Maps the destination path to its guarding domain (prefix map) and, for
 * EMPLEADO sub-profiles, blocks forbidden routes: redirect to `/` and fire the
 * `app:access-denied` DOM event so the shared toast surfaces. Unguarded routes
 * (`/`, `/reportes`, `/configuracion`, `/login`, …) pass through untouched.
 *
 * Runs before the named `auth` middleware, so we make sure the session is
 * loaded for guarded routes; if there is no session we bail and let `auth`
 * handle the /login redirect (no double fetch — fetchUser sets isAuthenticated).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const domain = domainForPath(to.path)
  if (!domain) return

  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) {
    await authStore.fetchUser()
  }
  // Unauthenticated → defer to the auth middleware (redirect to /login).
  if (!authStore.isAuthenticated) return

  const { can } = useDomainAccess()
  if (can(domain)) return

  // Forbidden: surface the toast, then redirect home.
  if (import.meta.client) {
    // Defer so the destination page (which mounts <Toast />) is ready.
    setTimeout(() => {
      document.dispatchEvent(
        new CustomEvent('app:access-denied', {
          detail: { message: 'No tiene permisos para acceder a esta sección.' },
        }),
      )
    }, 0)
  }
  return navigateTo('/')
})
