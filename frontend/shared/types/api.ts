export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface User {
  id: number
  email: string
  nombre: string
  apellido: string
  rol: string
  activo?: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
}

export interface LogoutResponse {
  message: string
}

export interface MeResponse {
  user: User
}

export interface ApiError {
  message: string
  statusCode?: number
  errors?: Record<string, string[]>
}
