import { getPrisma } from '../config/database'
import { CreateGroupRequest, UpdateGroupRequest, GroupFilterParams, GroupResponse, GroupListResponse } from '../types/groups'
import { logger } from '../config/logger'

const prisma = getPrisma()

export class GroupsService {
  async createGroup(data: CreateGroupRequest): Promise<GroupResponse> {
    try {
      const group = await prisma.group.create({
        data: {
          name: data.name,
          description: data.description,
          groupPermissions: data.permissionIds ? {
            create: data.permissionIds.map(permissionId => ({
              permissionId
            }))
          } : undefined
        },
        include: {
          groupPermissions: {
            include: {
              permission: true
            }
          },
          userGroups: true
        }
      })

      return this.mapGroupToResponse(group)
    } catch (error) {
      logger.error('Error creating group:', error)
      throw error
    }
  }

  async getGroups(filters: GroupFilterParams): Promise<GroupListResponse> {
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

      const [groups, total] = await Promise.all([
        prisma.group.findMany({
          where,
          skip,
          take: limit,
          include: {
            groupPermissions: {
              include: {
                permission: true
              }
            },
            userGroups: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.group.count({ where })
      ])

      return {
        groups: groups.map(group => this.mapGroupToResponse(group)),
        total,
        page,
        limit
      }
    } catch (error) {
      logger.error('Error fetching groups:', error)
      throw error
    }
  }

  async getGroupById(id: string): Promise<GroupResponse | null> {
    try {
      const group = await prisma.group.findFirst({
        where: {
          id,
          isDeleted: false
        },
        include: {
          groupPermissions: {
            include: {
              permission: true
            }
          },
          userGroups: true
        }
      })

      return group ? this.mapGroupToResponse(group) : null
    } catch (error) {
      logger.error('Error fetching group by ID:', error)
      throw error
    }
  }

  async updateGroup(id: string, data: UpdateGroupRequest): Promise<GroupResponse | null> {
    try {
      // Check if group exists and is not deleted
      const existingGroup = await prisma.group.findFirst({
        where: { id, isDeleted: false }
      })

      if (!existingGroup) {
        return null
      }

      const updateData: any = {}
      
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description

      const group = await prisma.group.update({
        where: { id },
        data: {
          ...updateData,
          ...(data.permissionIds && {
            groupPermissions: {
              deleteMany: {},
              create: data.permissionIds.map(permissionId => ({
                permissionId
              }))
            }
          })
        },
        include: {
          groupPermissions: {
            include: {
              permission: true
            }
          },
          userGroups: true
        }
      })

      return this.mapGroupToResponse(group)
    } catch (error) {
      logger.error('Error updating group:', error)
      throw error
    }
  }

  async deleteGroup(id: string): Promise<boolean> {
    try {
      const group = await prisma.group.findFirst({
        where: { id, isDeleted: false },
        include: {
          userGroups: true
        }
      })

      if (!group) {
        return false
      }

      // Check if any users are associated with this group
      if (group.userGroups.length > 0) {
        throw new Error(`Cannot delete group "${group.name}" because ${group.userGroups.length} user(s) are assigned to it. Please reassign users to other groups first.`)
      }

      await prisma.group.update({
        where: { id },
        data: { isDeleted: true }
      })

      return true
    } catch (error) {
      logger.error('Error deleting group:', error)
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

  private mapGroupToResponse(group: any): GroupResponse {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      isDeleted: group.isDeleted,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      permissions: group.groupPermissions.map((gp: any) => ({
        id: gp.permission.id,
        name: gp.permission.name,
        description: gp.permission.description
      })),
      userCount: group.userGroups.length
    }
  }
}

export const groupsService = new GroupsService()
