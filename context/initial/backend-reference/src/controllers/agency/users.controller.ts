import { Request, Response, NextFunction } from 'express'
import { 
  listUsers, 
  getUserById, 
  getUserByIDMeId,
  assignRoleToUser, 
  removeRoleFromUser, 
  listRoles, 
  listPermissions,
  updateUserInternalStatus 
} from '../../services/users.service'
import { publicUser } from '../../services/auth.service'

export async function getAll(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await listUsers()
    const publicUsers = await Promise.all(users.map(user => publicUser(user)))
    res.json(publicUsers)
  } catch (error) {
    next(error)
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const user = await getUserById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(await publicUser(user))
  } catch (error) {
    next(error)
  }
}

export async function getByIDMeId(req: Request, res: Response, next: NextFunction) {
  try {
    const { idmeId } = req.params
    const user = await getUserByIDMeId(idmeId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(await publicUser(user))
  } catch (error) {
    next(error)
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, roleId } = req.body
    if (!userId || !roleId) {
      return res.status(400).json({ error: 'User ID and Role ID are required' })
    }
    
    const userRole = await assignRoleToUser(userId, roleId)
    res.json(userRole)
  } catch (error) {
    if (error instanceof Error && error.message === 'User already has this role') {
      return res.status(409).json({ error: 'User already has this role' })
    }
    next(error)
  }
}

export async function removeRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, roleId } = req.params
    await removeRoleFromUser(userId, roleId)
    res.json({ message: 'Role removed successfully' })
  } catch (error) {
    if (error instanceof Error && error.message === 'User role not found') {
      return res.status(404).json({ error: 'User role not found' })
    }
    next(error)
  }
}

export async function getRoles(_req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await listRoles()
    res.json(roles)
  } catch (error) {
    next(error)
  }
}

export async function getPermissions(_req: Request, res: Response, next: NextFunction) {
  try {
    const permissions = await listPermissions()
    res.json(permissions)
  } catch (error) {
    next(error)
  }
}

export async function updateInternalStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { isInternal } = req.body
    
    if (typeof isInternal !== 'boolean') {
      return res.status(400).json({ error: 'isInternal must be a boolean' })
    }
    
    const user = await updateUserInternalStatus(id, isInternal)
    res.json(user)
  } catch (error) {
    next(error)
  }
}
