export interface CreateUserRequest {
  email: string
  name: string
  firstName?: string
  lastName?: string
  username?: string
  roleId?: string
  groupIds?: string[]
  isInternal?: boolean
  password?: string
}

export interface UpdateUserRequest {
  name?: string
  firstName?: string
  lastName?: string
  username?: string
  roleId?: string
  groupIds?: string[]
  isInternal?: boolean
  isActive?: boolean
}

export interface UserResponse {
  id: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  username?: string
  isInternal: boolean
  isActive: boolean
  isDeleted: boolean
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
  role?: RoleResponse
  groups: GroupResponse[]
}

export interface RoleResponse {
  id: string
  name: string
  description: string
}

export interface GroupResponse {
  id: string
  name: string
  description: string
}

export interface UserListResponse {
  users: UserResponse[]
  total: number
  page: number
  limit: number
}

export interface UserFilterParams {
  search?: string
  roleId?: string
  groupIds?: string[]
  isActive?: boolean
  isInternal?: boolean
  page?: number
  limit?: number
  includeDeleted?: boolean
  sortBy?: 'email' | 'name' | 'role' | 'group' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface PermissionResponse {
  id: string
  name: string
  description: string
}

export interface UserPermissionsResponse {
  userId: string
  permissions: PermissionResponse[]
  rolePermissions: PermissionResponse[]
  groupPermissions: PermissionResponse[]
}

export interface RoleOption {
  id: string
  name: string
  description: string
}

export interface GroupOption {
  id: string
  name: string
  description: string
}

export interface RoleOptionsResponse {
  success: boolean
  data: RoleOption[]
}

export interface GroupOptionsResponse {
  success: boolean
  data: GroupOption[]
}
