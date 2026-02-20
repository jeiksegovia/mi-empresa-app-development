import { NextFunction, Request, Response } from 'express'
import { verifyJwt } from '../utils/jwt'
import { getPrisma as prisma } from '../config/database'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    idmeId: string
    email: string
    permissions: string[]
    sessionId: string
    name: string
    firstName?: string
    lastName?: string
    username?: string
    isInternal: boolean
    isActive: boolean
    role?: string
  }
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const sessionCookie = req.cookies.session
  if (!sessionCookie) {
    return res.status(401).json({ error: 'Session cookie required' })
  }
  
  try {
    // Verify session and get user data
    const session = await prisma().userSession.findUnique({
      where: { sessionCookie },
      include: {
        user: {
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
        }
      }
    })

    if (!session) {
      return res.status(401).json({ error: 'Invalid session' })
    }
    
    if (session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' })
    }
    
    // Extract user permissions from roles and groups
    let rolePermissions = session.user.userRoles.flatMap((ur: any) => 
      ur.role.rolePermissions.map((rp: any) => rp.permission.name)
    )
    
    let groupPermissions = session.user.userGroups.flatMap((ug: any) => 
      ug.group.groupPermissions.map((gp: any) => gp.permission.name)
    )
    
    // Combine role and group permissions, removing duplicates
    let permissions = [...new Set([...rolePermissions, ...groupPermissions])]
    
    // If user has Administrator role, give them all permissions
    if (session.user.role === 'ADMINISTRATOR' || 
        session.user.userRoles.some((ur: any) => ur.role.name === 'Administrator')) {
      // Get all available permissions from the database
      try {
        const allPermissions = await prisma().permission.findMany({
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
    
    req.user = {
      id: session.user.id,
      idmeId: session.user.idmeId || '',
      email: session.user.email,
      permissions,
      sessionId: session.id,
      name: session.user.name,
      firstName: session.user.firstName || undefined,
      lastName: session.user.lastName || undefined,
      username: session.user.username || undefined,
      isInternal: session.user.isInternal,
      isActive: session.user.isActive,
      role: session.user.role || undefined
    }
    
    next()
  } catch (error: any) {
    return res.status(401).json({ error: 'Session validation failed' })
  }
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}

export function requireAnyPermission(permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const hasAnyPermission = permissions.some(permission => 
      req.user!.permissions.includes(permission)
    )

    if (!hasAnyPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}

export function requireAllPermissions(permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const hasAllPermissions = permissions.every(permission => 
      req.user!.permissions.includes(permission)
    )

    if (!hasAllPermissions) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}

// Optional authentication middleware for public routes
export async function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const sessionCookie = req.cookies.session
  if (!sessionCookie) {
    // No session cookie - continue without authentication
    req.user = undefined
    return next()
  }
  
  try {
    // Verify session and get user data if cookie exists
    const session = await prisma().userSession.findUnique({
      where: { sessionCookie },
      include: {
        user: {
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
        }
      }
    })

    if (!session || session.expiresAt < new Date()) {
      // Invalid or expired session - continue without authentication
      req.user = undefined
      return next()
    }
    
    // Extract user permissions from roles and groups
    let rolePermissions = session.user.userRoles.flatMap((ur: any) => 
      ur.role.rolePermissions.map((rp: any) => rp.permission.name)
    )
    
    let groupPermissions = session.user.userGroups.flatMap((ug: any) => 
      ug.group.groupPermissions.map((gp: any) => gp.permission.name)
    )
    
    // Combine role and group permissions, removing duplicates
    let permissions = [...new Set([...rolePermissions, ...groupPermissions])]
    
    // If user has Administrator role, give them all permissions
    if (session.user.userRoles.some((ur: any) => ur.role.name === 'Administrator')) {
      // Get all available permissions from the database
      try {
        const allPermissions = await prisma().permission.findMany({
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
    
    req.user = {
      id: session.user.id,
      idmeId: session.user.idmeId || '',
      email: session.user.email,
      permissions,
      sessionId: session.id,
      name: session.user.name,
      firstName: session.user.firstName || undefined,
      lastName: session.user.lastName || undefined,
      username: session.user.username || undefined,
      isInternal: session.user.isInternal,
      isActive: session.user.isActive,
      role: session.user.role || undefined
    }
    
    next()
  } catch (error: any) {
    // Session validation failed - continue without authentication
    req.user = undefined
    next()
  }
}

// Optional permission check - only checks if user is authenticated
export function optionalRequirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      // No user - allow access (public read access)
      return next()
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}
