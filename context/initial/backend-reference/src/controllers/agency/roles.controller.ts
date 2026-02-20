import { Request, Response } from 'express'
import { rolesService } from '../../services/roles.service'
import { CreateRoleRequest, UpdateRoleRequest, RoleFilterParams } from '../../types/roles'
import { logger } from '../../config/logger'

export class RolesController {
  async createRole(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateRoleRequest = req.body
      
      // Validate required fields
      if (!data.name || !data.description) {
        res.status(400).json({
          success: false,
          message: 'Name and description are required'
        })
        return
      }

      const role = await rolesService.createRole(data)
      
      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role
      })
    } catch (error: any) {
      logger.error('Error creating role:', error)
      
      if (error.code === 'P2002') {
        res.status(409).json({
          success: false,
          message: 'Role name already exists'
        })
        return
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getRoles(req: Request, res: Response): Promise<void> {
    try {
      const filters: RoleFilterParams = {
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        includeDeleted: req.query.includeDeleted === 'true'
      }

      const result = await rolesService.getRoles(filters)
      
      res.json({
        success: true,
        ...result
      })
    } catch (error) {
      logger.error('Error fetching roles:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getRoleById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const role = await rolesService.getRoleById(id)
      
      if (!role) {
        res.status(404).json({
          success: false,
          message: 'Role not found'
        })
        return
      }
      
      res.json({
        success: true,
        data: role
      })
    } catch (error) {
      logger.error('Error fetching role by ID:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async updateRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const data: UpdateRoleRequest = req.body
      
      const role = await rolesService.updateRole(id, data)
      
      if (!role) {
        res.status(404).json({
          success: false,
          message: 'Role not found'
        })
        return
      }
      
      res.json({
        success: true,
        message: 'Role updated successfully',
        data: role
      })
    } catch (error: any) {
      logger.error('Error updating role:', error)
      
      if (error.code === 'P2002') {
        res.status(409).json({
          success: false,
          message: 'Role name already exists'
        })
        return
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async deleteRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const deleted = await rolesService.deleteRole(id)
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Role not found'
        })
        return
      }
      
      res.json({
        success: true,
        message: 'Role deleted successfully'
      })
    } catch (error: any) {
      logger.error('Error deleting role:', error)
      
      // Handle specific error for users assigned to role
      if (error.message && error.message.includes('Cannot delete role')) {
        res.status(409).json({
          success: false,
          message: error.message
        })
        return
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getAvailablePermissions(req: Request, res: Response): Promise<void> {
    try {
      const permissions = await rolesService.getAvailablePermissions()
      
      res.json({
        success: true,
        data: permissions
      })
    } catch (error) {
      logger.error('Error fetching available permissions:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

export const rolesController = new RolesController()
