export type ISODateString = string
export type YMDDateString = string

export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
}

export interface UserTokenPayload {
  id: number
  email: string
  nombre: string
  apellido: string
  rol: string
  permisos: string[]
  sessionId: string
}
