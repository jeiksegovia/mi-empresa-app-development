import type { User, LoginResponse, LogoutResponse, MeResponse } from '~/shared/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fullName = computed(() => {
    if (!user.value) return ''
    return `${user.value.nombre} ${user.value.apellido}`
  })

  const role = computed(() => user.value?.rol || '')

  async function login(email: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      const { apiFetch } = useApi()
      const response = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      
      user.value = response.user
      isAuthenticated.value = true
      return { success: true }
    } catch (err: any) {
      error.value = err?.data?.message || 'Error al iniciar sesión. Por favor, intenta nuevamente.'
      user.value = null
      isAuthenticated.value = false
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    isLoading.value = true
    try {
      const { apiFetch } = useApi()
      await apiFetch<LogoutResponse>('/auth/logout', { 
        method: 'POST' 
      })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      user.value = null
      isAuthenticated.value = false
      isLoading.value = false
      navigateTo('/login')
    }
  }

  async function fetchUser() {
    isLoading.value = true
    error.value = null
    try {
      const { apiFetch } = useApi()
      const response = await apiFetch<MeResponse>('/auth/me')
      user.value = response.user
      isAuthenticated.value = true
      return { success: true }
    } catch (err: any) {
      user.value = null
      isAuthenticated.value = false
      return { success: false }
    } finally {
      isLoading.value = false
    }
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    fullName,
    role,
    login,
    logout,
    fetchUser,
  }
})
