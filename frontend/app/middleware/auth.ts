export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()

  // If going to login page and already authenticated, redirect to dashboard
  if (to.path === '/login') {
    if (authStore.isAuthenticated) {
      return navigateTo('/')
    }
    return
  }

  // If not authenticated, try to fetch user data
  if (!authStore.isAuthenticated) {
    const result = await authStore.fetchUser()
    
    // If fetch failed, redirect to login
    if (!result.success) {
      return navigateTo('/login')
    }
  }

  // If authenticated, allow access
  if (authStore.isAuthenticated) {
    return
  }

  // Fallback: redirect to login
  return navigateTo('/login')
})
