export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()

  // If going to login page and already authenticated, redirect to dashboard
  if (to.path === '/login') {
    if (authStore.isAuthenticated) {
      return navigateTo('/')
    }
    return
  }

  // If authenticated, allow access (no need to fetch again)
  if (authStore.isAuthenticated) {
    return
  }

  // Not authenticated - try to fetch user data from session
  const result = await authStore.fetchUser()

  // If fetch succeeded, allow access
  if (result.success) {
    return
  }

  // No valid session - redirect to login
  return navigateTo('/login')
})
