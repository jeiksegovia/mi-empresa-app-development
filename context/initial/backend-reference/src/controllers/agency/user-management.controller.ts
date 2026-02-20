import { Request, Response } from 'express'
import { userManagementService } from '../../services/user-management.service'
import { 
  CreateUserRequest, 
  UpdateUserRequest, 
  UserFilterParams 
} from '../../types/user-management'
import { logger } from '../../config/logger'

export class UserManagementController {
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateUserRequest = req.body
      
      // Validate required fields
      if (!data.email || !data.name) {
        res.status(400).json({
          success: false,
          message: 'Email and name are required'
        })
        return
      }

      const user = await userManagementService.createUser(data)
      
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user
      })
    } catch (error: any) {
      logger.error('Error creating user:', error)
      
      if (error.code === 'P2002') {
        res.status(409).json({
          success: false,
          message: 'Email or username already exists'
        })
        return
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const filters: UserFilterParams = {
        search: req.query.search as string,
        roleId: req.query.roleId as string,
        groupIds: req.query.groupIds ? (req.query.groupIds as string).split(',') : undefined,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
        isInternal: req.query.isInternal ? req.query.isInternal === 'true' : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        includeDeleted: req.query.includeDeleted === 'true',
        sortBy: req.query.sortBy as any || 'email',
        sortOrder: req.query.sortOrder as 'asc' | 'desc' || 'asc'
      }

      const result = await userManagementService.getUsers(filters)
      
      res.json({
        success: true,
        ...result
      })
    } catch (error) {
      logger.error('Error fetching users:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const user = await userManagementService.getUserById(id)
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        })
        return
      }
      
      res.json({
        success: true,
        data: user
      })
    } catch (error) {
      logger.error('Error fetching user by ID:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const data: UpdateUserRequest = req.body
      
      const user = await userManagementService.updateUser(id, data)
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        })
        return
      }
      
      res.json({
        success: true,
        message: 'User updated successfully',
        data: user
      })
    } catch (error: any) {
      logger.error('Error updating user:', error)
      
      if (error.code === 'P2002') {
        res.status(409).json({
          success: false,
          message: 'Username already exists'
        })
        return
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const deleted = await userManagementService.deleteUser(id)
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        })
        return
      }
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      })
    } catch (error) {
      logger.error('Error deleting user:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getUserPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const permissions = await userManagementService.getUserPermissions(id)
      
      res.json({
        success: true,
        data: permissions
      })
    } catch (error) {
      logger.error('Error fetching user permissions:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getAvailableRoles(req: Request, res: Response): Promise<void> {
    try {
      const roles = await userManagementService.getAvailableRoles()
      
      res.json({
        success: true,
        data: roles
      })
    } catch (error) {
      logger.error('Error fetching available roles:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getAvailableGroups(req: Request, res: Response): Promise<void> {
    try {
      const groups = await userManagementService.getAvailableGroups()
      
      res.json({
        success: true,
        data: groups
      })
    } catch (error) {
      logger.error('Error fetching available groups:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

export const userManagementController = new UserManagementController()
