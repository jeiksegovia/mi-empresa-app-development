import { getPrisma as prisma } from '../config/database'

export function listUsers() {
  return prisma().user.findMany({
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
      }
    }
  })
}

export function getUserById(id: string) {
  return prisma().user.findUnique({
    where: { id },
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
      }
    }
  })
}

export function getUserByIDMeId(idmeId: string) {
  return prisma().user.findUnique({
    where: { idmeId },
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
      }
    }
  })
}

export async function assignRoleToUser(userId: string, roleId: string) {
  // First check if the user role already exists
  const existingUserRole = await prisma().userRole.findUnique({
    where: {
      userId_roleId: {
        userId,
        roleId
      }
    }
  })

  if (existingUserRole) {
    throw new Error('User already has this role')
  }

  return prisma().userRole.create({
    data: {
      userId,
      roleId
    },
    include: {
      role: true
    }
  })
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  // First check if the user role exists
  const existingUserRole = await prisma().userRole.findUnique({
    where: {
      userId_roleId: {
        userId,
        roleId
      }
    }
  })

  if (!existingUserRole) {
    throw new Error('User role not found')
  }

  return prisma().userRole.delete({
    where: {
      userId_roleId: {
        userId,
        roleId
      }
    }
  })
}

export function listRoles() {
  return prisma().role.findMany({
    include: {
      rolePermissions: {
        include: {
          permission: true
        }
      }
    }
  })
}

export function listPermissions() {
  return prisma().permission.findMany()
}

export async function updateUserInternalStatus(userId: string, isInternal: boolean) {
  return prisma().user.update({
    where: { id: userId },
    data: { isInternal }
  })
}
