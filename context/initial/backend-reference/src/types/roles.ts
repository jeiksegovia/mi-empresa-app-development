export interface CreateRoleRequest {
  name: string
  description: string
  permissionIds?: string[]
}

export interface UpdateRoleRequest {
  name?: string
  description?: string
  permissionIds?: string[]
}

export interface RoleResponse {
  id: string
  name: string
  description: string
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  permissions: PermissionResponse[]
  userCount: number
}

export interface PermissionResponse {
  id: string
  name: string
  description: string
}

export interface RoleListResponse {
  roles: RoleResponse[]
  total: number
  page: number
  limit: number
}

export interface RoleFilterParams {
  search?: string
  page?: number
  limit?: number
  includeDeleted?: boolean
}
