import type { User, LoginResponse, LogoutResponse, MeResponse } from '~/shared/types/api'

interface EmpresaData {
  id: number
  nombre: string
  nit: string
  direccion: string | null
  telefono: string | null
  email: string | null
  activa: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const empresa = ref<EmpresaData | null>(null)

  const fullName = computed(() => {
    if (!user.value) return ''
    return `${user.value.nombre} ${user.value.apellido}`
  })

  const role = computed(() => user.value?.rol || '')

  // Role-based helpers
  const isAdmin = computed(() => role.value === 'ADMIN')
  const isEmpleado = computed(() => role.value === 'EMPLEADO')
  const isAuditor = computed(() => role.value === 'AUDITOR')
  const isOperador = computed(() => role.value === 'OPERADOR')

  async function fetchEmpresa() {
    try {
      const config = useRuntimeConfig()
      const baseURL = config.public.apiBase

      // W6: GET /empresa is now normalized to 200 { data: null } on empty DB.
      // We coerce null/undefined to null explicitly so consumers can rely on
      // `auth.empresa === null` as the "create mode" signal without surprises.
      const response = await $fetch<{ success: boolean; data: EmpresaData | null }>(`${baseURL}/empresa`, {
        credentials: 'include',
      })
      empresa.value = response?.data ?? null
    } catch {
      // Silently fail - empresa data is optional and shouldn't affect login flow
      empresa.value = null
    }
  }

  async function login(email: string, password: string) {
    isLoading.value = true
    error.value = null
    // Flush any stale identity BEFORE authenticating a new user. The RBAC route
    // gate (domain-access.global.ts) reads this in-memory identity; a leftover
    // profile from a prior session (e.g. GERONTOLOGA) would otherwise gate the
    // new user off /empleados until a second login. Resetting here guarantees
    // the fresh login response is the only identity in the store.
    user.value = null
    empresa.value = null
    isAuthenticated.value = false
    try {
      const { apiFetch } = useApi()
      const response = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })

      user.value = response.user
      isAuthenticated.value = true
      await fetchEmpresa()

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
      empresa.value = null
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
      await fetchEmpresa()
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
    empresa,
    fullName,
    role,
    isAdmin,
    isEmpleado,
    isAuditor,
    isOperador,
    login,
    logout,
    fetchUser,
    fetchEmpresa,
  }
})
