import { User, Role, Permission } from '../generated/prisma'
import { getPrisma } from '../config/database'
import { signJwt } from '../utils/jwt'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'

const db = getPrisma()

export interface IDMeUser {
  idme_id: string // ID.me subject identifier (OAuth2 'sub' field)
  email: string   // User's email from ID.me
  name: string    // User's full name from ID.me
}

// Mock ID.me user data - in production this would come from ID.me API
const MOCK_IDME_USERS: Record<string, {
  idme_id: string
  email: string
  name: string
  isInternal: boolean
}> = {
  'idme_admin_user': {
    idme_id: 'idme_admin_user',
    email: 'admin@foia.gov',
    name: 'Admin User',
    isInternal: true
  },
  'idme_clerk_user': {
    idme_id: 'idme_clerk_user',
    email: 'clerk@foia.gov',
    name: 'Clerk User',
    isInternal: true
  },
  'idme_public_user': {
    idme_id: 'idme_public_user',
    email: 'public@example.com',
    name: 'Public User',
    isInternal: false
  }
}

export interface UserWithRoles extends User {
  userRoles: {
    role: Role & {
      rolePermissions: {
        permission: Permission
      }[]
    }
  }[]
  userGroups: {
    group: {
      id: string
      name: string
      description: string
      groupPermissions: {
        permission: Permission
      }[]
    }
  }[]
}

// Mock agency users for demonstration (in production, add password fields to schema)
const MOCK_AGENCY_USERS: Record<string, { username: string, password: string, email: string }> = {
  'admin@foia.gov': {
    username: 'admin@foia.gov',
    password: 'admin123',
    email: 'admin@foia.gov'
  },
  'clerk@foia.gov': {
    username: 'clerk@foia.gov', 
    password: 'clerk123',
    email: 'clerk@foia.gov'
  }
}

// Agency authentication with username/password
export async function authenticateAgencyUser(username: string, password: string, ipAddress: string, userAgent: string) {
  try {
    // Find user by email in database
    const user = await db.user.findUnique({
      where: { email: username },
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

    if (!user || !user.isInternal) {
      throw new Error('Invalid credentials or access denied')
    }

    // Verify password
    if (!user.passwordHash) {
      throw new Error('Invalid credentials')
    }

    // Verify password using bcrypt
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    // Create session
    const sessionCookie = uuidv4()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const session = await db.userSession.create({
      data: {
        sessionCookie,
        userId: user.id,
        ipAddress,
        userAgent,
        expiresAt
      }
    })

    // Generate JWT token for agency users
    let permissions = user.userRoles?.flatMap(ur => 
      ur.role.rolePermissions.map(rp => rp.permission.name)
    ) || []
    
    // If user has Administrator role, give them all permissions
    if (user.userRoles?.some(ur => ur.role.name === 'Administrator')) {
      try {
        const allPermissions = await db.permission.findMany({
          select: { name: true }
        })
        permissions = allPermissions.map(p => p.name)
      } catch (error) {
        // Fallback to default permissions if database query fails
        permissions = [
          'review_documents', 'release_documents', 'upload_documents', 'redact_documents',
          'assign_cases', 'reassign_cases', 'assign_cases_self', 'add_notes', 
          'respond_support', 'access_configuration'
        ]
      }
    }

    // Extract primary role (first role if multiple exist)
    const primaryRole = user.userRoles && user.userRoles.length > 0 ? user.userRoles[0].role.name : undefined
    
    const token = signJwt({ 
      id: user.id, 
      idmeId: user.idmeId || '',
      email: user.email,
      permissions,
      sessionId: session.id,
      name: user.name,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      username: user.username || undefined,
      isInternal: user.isInternal,
      isActive: user.isActive,
      role: primaryRole
    })

    return {
      user,
      token,
      sessionCookie
    }
  } catch (error) {
    throw new Error('Authentication failed')
  }
}

export async function authenticateWithIDMe(idmeUser: IDMeUser, ipAddress: string, userAgent: string) {
  // Get user data from mock ID.me (in production, this would be an API call to ID.me)
  let idmeUserData = MOCK_IDME_USERS[idmeUser.idme_id]
  
  // If not in predefined list, create dynamic user data
  if (!idmeUserData) {
    idmeUserData = {
      idme_id: idmeUser.idme_id,
      email: idmeUser.email,
      name: idmeUser.name,
      isInternal: false // Default to public user
    }
  }

  let user: UserWithRoles | null = null

  try {
    // Try to find existing user by ID.me ID
    user = await db.user.findUnique({
      where: { idmeId: idmeUser.idme_id },
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
  } catch (error) {
    console.warn('Database error when finding user, will attempt to create new user:', error)
    // Don't create mock user yet - try to create real user first
    user = null
  }

  if (!user) {
    try {
      // Before creating a new user, check if a user with this email already exists
      const existingUserByEmail = await db.user.findUnique({
        where: { email: idmeUserData.email },
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

      if (existingUserByEmail) {
        // User exists with this email, use the existing user without updating idmeId
        user = existingUserByEmail
      } else {
        // Create new user with data from ID.me
        const createdUser = await db.user.create({
          data: {
            idmeId: idmeUserData.idme_id,
            email: idmeUserData.email,
            name: idmeUserData.name,
            username: idmeUserData.email,
            firstName: idmeUserData.name.split(' ')[0] || '',
            lastName: idmeUserData.name.split(' ').slice(1).join(' ') || '',
            passwordHash: 'idme_user_no_password',
            isInternal: idmeUserData.isInternal,
            role: 'REQUESTOR'
          }
        })

        // Fetch user with roles and groups
        user = await db.user.findUnique({
          where: { id: createdUser.id },
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
      }

      // Always assign Requestor role to new public user
      if (!idmeUserData.isInternal && user) {
        try {
          // First try to find the Requestor role
          let requestorRole = await db.role.findUnique({
            where: { name: 'Requestor' }
          })
          
          // If Requestor role doesn't exist, try to create it
          if (!requestorRole) {
            console.log('Requestor role not found, attempting to create it...')
            try {
              requestorRole = await db.role.create({
                data: {
                  name: 'Requestor',
                  description: 'Portal access only; can see updates for their requests'
                }
              })
              console.log('Created Requestor role:', requestorRole.id)
            } catch (createRoleError) {
              console.warn('Could not create Requestor role:', createRoleError)
            }
          }
          
          if (requestorRole) {
            // Check if user already has this role
            const existingRole = await db.userRole.findUnique({
              where: {
                userId_roleId: {
                  userId: user.id,
                  roleId: requestorRole.id
                }
              }
            })
            
                         if (!existingRole) {
               await db.userRole.create({
                 data: {
                   userId: user.id,
                   roleId: requestorRole.id
                 }
               })
               console.log('Assigned Requestor role to user:', user.id)
             }
             
             // Ensure the Requestor role has basic permissions
             try {
               const basicPermissions = ['view_request', 'create_request']
               for (const permissionName of basicPermissions) {
                 // Check if permission exists
                 let permission = await db.permission.findUnique({
                   where: { name: permissionName }
                 })
                 
                 // Create permission if it doesn't exist
                 if (!permission) {
                   permission = await db.permission.create({
                     data: {
                       name: permissionName,
                       description: permissionName === 'view_request' 
                         ? 'Can view FOIA requests' 
                         : 'Can create new FOIA requests'
                     }
                   })
                   console.log('Created permission:', permissionName)
                 }
                 
                 // Check if role-permission relationship exists
                 const existingRolePermission = await db.rolePermission.findUnique({
                   where: {
                     roleId_permissionId: {
                       roleId: requestorRole.id,
                       permissionId: permission.id
                     }
                   }
                 })
                 
                 // Create role-permission relationship if it doesn't exist
                 if (!existingRolePermission) {
                   await db.rolePermission.create({
                     data: {
                       roleId: requestorRole.id,
                       permissionId: permission.id
                     }
                   })
                   console.log('Assigned permission', permissionName, 'to Requestor role')
                 }
               }
             } catch (permissionError) {
               console.warn('Error setting up permissions for Requestor role:', permissionError)
             }
            
            // Refresh user data to include the new role and groups
            const refreshedUser = await db.user.findUnique({
              where: { id: user.id },
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
            
            if (refreshedUser) {
              user = refreshedUser
            }
          }
        } catch (roleError) {
          console.warn('Error assigning role to user, continuing with basic user:', roleError)
          // Continue with user without role assignment
        }
      }
    } catch (createError) {
      console.warn('Database error when creating user, using mock user:', createError)
    }
  } else {
    try {
      // Update existing user
      user = await db.user.update({
        where: { id: user.id },
        data: {
          email: idmeUserData.email,
          name: idmeUserData.name
        },
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
    } catch (updateError) {
      console.warn('Database error when updating user, using existing data:', updateError)
    }
  }

      if (!user) {
      throw new Error('Failed to create or retrieve user')
    }

    // Create session
    const sessionCookie = uuidv4()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hour session

    let session
    try {
      session = await db.userSession.create({
        data: {
          userId: user.id,
          sessionCookie,
          expiresAt,
          ipAddress,
          userAgent
        }
      })
    } catch (sessionError) {
      console.warn('Database error when creating session, using mock session:', sessionError)
      // Create mock session for development
      session = {
        id: `mock-session-${sessionCookie}`,
        userId: user.id,
        sessionCookie,
        expiresAt,
        ipAddress,
        userAgent,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    // Generate JWT token
    let permissions = user.userRoles?.flatMap(ur => 
      ur.role.rolePermissions.map(rp => rp.permission.name)
    ) || []
    
    // If user has Administrator role, give them all permissions
    if (user.userRoles?.some(ur => ur.role.name === 'Administrator')) {
      try {
        const allPermissions = await db.permission.findMany({
          select: { name: true }
        })
        permissions = allPermissions.map(p => p.name)
      } catch (error) {
        // Fallback to default permissions if database query fails
        permissions = [
          'review_documents', 'release_documents', 'upload_documents', 'redact_documents',
          'assign_cases', 'reassign_cases', 'assign_cases_self', 'add_notes', 
          'respond_support', 'access_configuration'
        ]
      }
    }

    const token = signJwt({ 
      id: user.id, 
      idmeId: user.idmeId || '',
      email: user.email,
      permissions,
      sessionId: session.id,
      name: user.name,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      username: user.username || undefined,
      isInternal: user.isInternal,
      isActive: user.isActive,
      role: user.role || undefined
    })

  return { user, token, sessionCookie }
}

export async function invalidateSession(sessionCookie: string) {
  try {
    await db.userSession.delete({
      where: { sessionCookie }
    })
  } catch (error) {
    console.warn('Database error when invalidating session, session may not exist:', error)
    // Continue silently - session invalidation failure is not critical
  }
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
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
      return []
    }

    // Extract permissions from roles and groups
    let rolePermissions = user.userRoles.flatMap(ur => 
      ur.role.rolePermissions.map(rp => rp.permission.name)
    )
    
    let groupPermissions = user.userGroups.flatMap(ug => 
      ug.group.groupPermissions.map(gp => gp.permission.name)
    )
    
    // Combine role and group permissions, removing duplicates
    let permissions = [...new Set([...rolePermissions, ...groupPermissions])]
    
    // If user has Administrator role, give them all permissions
    if (user.userRoles?.some(ur => ur.role.name === 'Administrator')) {
      try {
        const allPermissions = await db.permission.findMany({
          select: { name: true }
        })
        permissions = allPermissions.map(p => p.name)
      } catch (error) {
        // Fallback to default permissions if database query fails
        permissions = [
          'review_documents', 'release_documents', 'upload_documents', 'redact_documents',
          'assign_cases', 'reassign_cases', 'assign_cases_self', 'add_notes', 
          'respond_support', 'access_configuration'
        ]
      }
    }

    return permissions
  } catch (error) {
    console.warn('Database error when getting user permissions, returning default permissions:', error)
    // Return default permissions for mock users
    if (userId.startsWith('mock-')) {
      return ['view_request', 'create_request']
    }
    return []
  }
}

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  return permissions.includes(permission)
}

export async function publicUser(u: UserWithRoles | User): Promise<any> {
  // Extract permissions from roles and groups
  let rolePermissions = 'userRoles' in u 
    ? u.userRoles.flatMap(ur => 
        ur.role.rolePermissions.map(rp => rp.permission.name)
      )
    : []

  let groupPermissions = 'userGroups' in u 
    ? u.userGroups.flatMap(ug => 
        ug.group.groupPermissions.map(gp => gp.permission.name)
      )
    : []

  // Combine role and group permissions, removing duplicates
  let permissions = [...new Set([...rolePermissions, ...groupPermissions])]

  const role = 'userRoles' in u && u.userRoles.length > 0 
    ? u.userRoles[0].role.name 
    : u.role

  // If user has Administrator role, give them all permissions
  if ('userRoles' in u && u.userRoles?.some(ur => ur.role.name === 'Administrator')) {
    try {
      const allPermissions = await db.permission.findMany({
        select: { name: true }
      })
      permissions = allPermissions.map(p => p.name)
    } catch (error) {
      // Fallback to default permissions if database query fails
        permissions = [
          'review_documents', 'release_documents', 'upload_documents', 'redact_documents',
          'assign_cases', 'reassign_cases', 'assign_cases_self', 'add_notes', 
          'respond_support', 'access_configuration'
        ]
    }
  }

  return {
    id: u.id,
    idmeId: u.idmeId,
    email: u.email,
    name: u.name,
    isInternal: u.isInternal,
    permissions,
    role
  }
}
