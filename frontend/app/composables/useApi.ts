export const useApi = () => {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase

  const apiFetch = $fetch.create({
    baseURL,
    credentials: 'include',
    onResponseError({ response }) {
      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        const authStore = useAuthStore()
        authStore.user = null
        authStore.isAuthenticated = false
        navigateTo('/login')
      }
    },
  })

  return {
    apiFetch,
    baseURL,
  }
}
