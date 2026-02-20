export interface CreateGroupRequest {
  name: string
  description: string
  permissionIds?: string[]
}

export interface UpdateGroupRequest {
  name?: string
  description?: string
  permissionIds?: string[]
}

export interface GroupResponse {
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

export interface GroupListResponse {
  groups: GroupResponse[]
  total: number
  page: number
  limit: number
}

export interface GroupFilterParams {
  search?: string
  page?: number
  limit?: number
  includeDeleted?: boolean
}
