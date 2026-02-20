import { getPrisma } from '../config/database'
import { 
  CreateUserRequest, 
  UpdateUserRequest, 
  UserFilterParams, 
  UserResponse, 
  UserListResponse,
  UserPermissionsResponse,
  RoleOptionsResponse,
  GroupOptionsResponse
} from '../types/user-management'
import { logger } from '../config/logger'
import bcrypt from 'bcryptjs'

const prisma = getPrisma()

export class UserManagementService {
  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    try {
      const userData: any = {
        email: data.email,
        name: data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        isInternal: data.isInternal || false,
        userRoles: data.roleId ? {
          create: [{ roleId: data.roleId }]
        } : undefined,
        userGroups: data.groupIds ? {
          create: data.groupIds.map(groupId => ({ groupId }))
        } : undefined
      }

      if (data.password) {
        userData.passwordHash = await bcrypt.hash(data.password, 10)
      }

      const user = await prisma.user.create({
        data: userData,
        include: {
          userRoles: {
            include: {
              role: true
            }
          },
          userGroups: {
            include: {
              group: true
            }
          }
        }
      })

      return this.mapUserToResponse(user)
    } catch (error) {
      logger.error('Error creating user:', error)
      throw error
    }
  }

  async getUsers(filters: UserFilterParams): Promise<UserListResponse> {
    try {
      const { 
        search, 
        roleId, 
        groupIds, 
        isActive, 
        isInternal, 
        page = 1, 
        limit = 10, 
        includeDeleted = false,
        sortBy = 'email',
        sortOrder = 'asc'
      } = filters
      const skip = (page - 1) * limit

      const where: any = {}
      
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      }

      if (roleId) {
        where.userRoles = {
          some: { roleId }
        }
      }

      if (groupIds && groupIds.length > 0) {
        where.userGroups = {
          some: { groupId: { in: groupIds } }
        }
      }

      if (isActive !== undefined) {
        where.isActive = isActive
      }

      if (isInternal !== undefined) {
        where.isInternal = isInternal
      }

      if (!includeDeleted) {
        where.isDeleted = false
      }

      const orderBy: any = {}
      switch (sortBy) {
        case 'email':
          orderBy.email = sortOrder
          break
        case 'name':
          orderBy.name = sortOrder
          break
        case 'role':
          orderBy.userRoles = { _count: sortOrder }
          break
        case 'group':
          orderBy.userGroups = { _count: sortOrder }
          break
        case 'createdAt':
          orderBy.createdAt = sortOrder
          break
        default:
          orderBy.email = 'asc'
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: {
            userRoles: {
              include: {
                role: true
              }
            },
            userGroups: {
              include: {
                group: true
              }
            }
          },
          orderBy
        }),
        prisma.user.count({ where })
      ])

      return {
        users: users.map(user => this.mapUserToResponse(user)),
        total,
        page,
        limit
      }
    } catch (error) {
      logger.error('Error fetching users:', error)
      throw error
    }
  }

  async getUserById(id: string): Promise<UserResponse | null> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          id,
          isDeleted: false
        },
        include: {
          userRoles: {
            include: {
              role: true
            }
          },
          userGroups: {
            include: {
              group: true
            }
          }
        }
      })

      return user ? this.mapUserToResponse(user) : null
    } catch (error) {
      logger.error('Error fetching user by ID:', error)
      throw error
    }
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<UserResponse | null> {
    try {
      // Check if user exists and is not deleted
      const existingUser = await prisma.user.findFirst({
        where: { id, isDeleted: false }
      })

      if (!existingUser) {
        return null
      }

      const updateData: any = {}
      
      if (data.name !== undefined) updateData.name = data.name
      if (data.firstName !== undefined) updateData.firstName = data.firstName
      if (data.lastName !== undefined) updateData.lastName = data.lastName
      if (data.username !== undefined) updateData.username = data.username
      if (data.isInternal !== undefined) updateData.isInternal = data.isInternal
      if (data.isActive !== undefined) updateData.isActive = data.isActive

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          ...(data.roleId && {
            userRoles: {
              deleteMany: {},
              create: [{ roleId: data.roleId }]
            }
          }),
          ...(data.groupIds && {
            userGroups: {
              deleteMany: {},
              create: data.groupIds.map(groupId => ({ groupId }))
            }
          })
        },
        include: {
          userRoles: {
            include: {
              role: true
            }
          },
          userGroups: {
            include: {
              group: true
            }
          }
        }
      })

      return this.mapUserToResponse(user)
    } catch (error) {
      logger.error('Error updating user:', error)
      throw error
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const user = await prisma.user.findFirst({
        where: { id, isDeleted: false }
      })

      if (!user) {
        return false
      }

      await prisma.user.update({
        where: { id },
        data: { isDeleted: true }
      })

      return true
    } catch (error) {
      logger.error('Error deleting user:', error)
      throw error
    }
  }

  async getUserPermissions(userId: string): Promise<UserPermissionsResponse> {
    try {
      const user = await prisma.user.findFirst({
        where: { id: userId, isDeleted: false },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true
                    }
                  }
                }
              }
            }
          },
          userGroups: {
            include: {
              group: {
                include: {
                  groupPermissions: {
                    include: {
                      permission: true
                    }
                  }
                }
              }
            }
          }
        }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Collect role permissions
      const rolePermissions = user.userRoles.flatMap(ur => 
        ur.role.rolePermissions.map(rp => ({
          id: rp.permission.id,
          name: rp.permission.name,
          description: rp.permission.description
        }))
      )

      // Collect group permissions
      const groupPermissions = user.userGroups.flatMap(ug => 
        ug.group.groupPermissions.map(gp => ({
          id: gp.permission.id,
          name: gp.permission.name,
          description: gp.permission.description
        }))
      )

      // Combine and deduplicate permissions
      const allPermissions = [...rolePermissions, ...groupPermissions]
      const uniquePermissions = allPermissions.filter((permission, index, self) => 
        index === self.findIndex(p => p.id === permission.id)
      )

      return {
        userId,
        permissions: uniquePermissions,
        rolePermissions,
        groupPermissions
      }
    } catch (error) {
      logger.error('Error fetching user permissions:', error)
      throw error
    }
  }

  async getAvailableRoles(): Promise<any[]> {
    try {
      const roles = await prisma.role.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          description: true
        },
        orderBy: { name: 'asc' }
      })

      return roles
    } catch (error) {
      logger.error('Error fetching available roles:', error)
      throw error
    }
  }

  async getAvailableGroups(): Promise<any[]> {
    try {
      const groups = await prisma.group.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          description: true
        },
        orderBy: { name: 'asc' }
      })

      return groups
    } catch (error) {
      logger.error('Error fetching available groups:', error)
      throw error
    }
  }

  private mapUserToResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      isInternal: user.isInternal,
      isActive: user.isActive,
      isDeleted: user.isDeleted,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.userRoles.length > 0 ? {
        id: user.userRoles[0].role.id,
        name: user.userRoles[0].role.name,
        description: user.userRoles[0].role.description
      } : undefined,
      groups: user.userGroups.map((ug: any) => ({
        id: ug.group.id,
        name: ug.group.name,
        description: ug.group.description
      }))
    }
  }
}

export const userManagementService = new UserManagementService()
