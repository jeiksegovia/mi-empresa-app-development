import { getPrisma } from '../config/database'
import { CreateRoleRequest, UpdateRoleRequest, RoleFilterParams, RoleResponse, RoleListResponse } from '../types/roles'
import { logger } from '../config/logger'

const prisma = getPrisma()

export class RolesService {
  async createRole(data: CreateRoleRequest): Promise<RoleResponse> {
    try {
      const role = await prisma.role.create({
        data: {
          name: data.name,
          description: data.description,
          rolePermissions: data.permissionIds ? {
            create: data.permissionIds.map(permissionId => ({
              permissionId
            }))
          } : undefined
        },
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          },
          userRoles: true
        }
      })

      return this.mapRoleToResponse(role)
    } catch (error) {
      logger.error('Error creating role:', error)
      throw error
    }
  }

  async getRoles(filters: RoleFilterParams): Promise<RoleListResponse> {
    try {
      const { search, page = 1, limit = 10, includeDeleted = false } = filters
      const skip = (page - 1) * limit

      const where: any = {}
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      }

      if (!includeDeleted) {
        where.isDeleted = false
      }

      const [roles, total] = await Promise.all([
        prisma.role.findMany({
          where,
          skip,
          take: limit,
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            },
            userRoles: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.role.count({ where })
      ])

      return {
        roles: roles.map(role => this.mapRoleToResponse(role)),
        total,
        page,
        limit
      }
    } catch (error) {
      logger.error('Error fetching roles:', error)
      throw error
    }
  }

  async getRoleById(id: string): Promise<RoleResponse | null> {
    try {
      const role = await prisma.role.findFirst({
        where: {
          id,
          isDeleted: false
        },
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          },
          userRoles: true
        }
      })

      return role ? this.mapRoleToResponse(role) : null
    } catch (error) {
      logger.error('Error fetching role by ID:', error)
      throw error
    }
  }

  async updateRole(id: string, data: UpdateRoleRequest): Promise<RoleResponse | null> {
    try {
      // Check if role exists and is not deleted
      const existingRole = await prisma.role.findFirst({
        where: { id, isDeleted: false }
      })

      if (!existingRole) {
        return null
      }

      const updateData: any = {}
      
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description

      const role = await prisma.role.update({
        where: { id },
        data: {
          ...updateData,
          ...(data.permissionIds && {
            rolePermissions: {
              deleteMany: {},
              create: data.permissionIds.map(permissionId => ({
                permissionId
              }))
            }
          })
        },
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          },
          userRoles: true
        }
      })

      return this.mapRoleToResponse(role)
    } catch (error) {
      logger.error('Error updating role:', error)
      throw error
    }
  }

  async deleteRole(id: string): Promise<boolean> {
    try {
      const role = await prisma.role.findFirst({
        where: { id, isDeleted: false },
        include: {
          userRoles: true
        }
      })

      if (!role) {
        return false
      }

      // Check if any users are associated with this role
      if (role.userRoles.length > 0) {
        throw new Error(`Cannot delete role "${role.name}" because ${role.userRoles.length} user(s) are assigned to it. Please reassign users to other roles first.`)
      }

      await prisma.role.update({
        where: { id },
        data: { isDeleted: true }
      })

      return true
    } catch (error) {
      logger.error('Error deleting role:', error)
      throw error
    }
  }

  async getAvailablePermissions(): Promise<any[]> {
    try {
      const permissions = await prisma.permission.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          description: true
        },
        orderBy: { name: 'asc' }
      })

      return permissions
    } catch (error) {
      logger.error('Error fetching available permissions:', error)
      throw error
    }
  }

  private mapRoleToResponse(role: any): RoleResponse {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isDeleted: role.isDeleted,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissions: role.rolePermissions.map((rp: any) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        description: rp.permission.description
      })),
      userCount: role.userRoles.length
    }
  }
}

export const rolesService = new RolesService()
