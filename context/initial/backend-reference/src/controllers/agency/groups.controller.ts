import { Request, Response } from 'express'
import { groupsService } from '../../services/groups.service'
import { CreateGroupRequest, UpdateGroupRequest, GroupFilterParams } from '../../types/groups'
import { logger } from '../../config/logger'

export class GroupsController {
  async createGroup(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateGroupRequest = req.body
      
      // Validate required fields
      if (!data.name || !data.description) {
        res.status(400).json({
          success: false,
          message: 'Name and description are required'
        })
        return
      }

      const group = await groupsService.createGroup(data)
      
      res.status(201).json({
        success: true,
        message: 'Group created successfully',
        data: group
      })
    } catch (error: any) {
      logger.error('Error creating group:', error)
      
      if (error.code === 'P2002') {
        res.status(409).json({
          success: false,
          message: 'Group name already exists'
        })
        return
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getGroups(req: Request, res: Response): Promise<void> {
    try {
      const filters: GroupFilterParams = {
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        includeDeleted: req.query.includeDeleted === 'true'
      }

      const result = await groupsService.getGroups(filters)
      
      res.json({
        success: true,
        ...result
      })
    } catch (error) {
      logger.error('Error fetching groups:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async getGroupById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const group = await groupsService.getGroupById(id)
      
      if (!group) {
        res.status(404).json({
          success: false,
          message: 'Group not found'
        })
        return
      }
      
      res.json({
        success: true,
        data: group
      })
    } catch (error) {
      logger.error('Error fetching group by ID:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async updateGroup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const data: UpdateGroupRequest = req.body
      
      const group = await groupsService.updateGroup(id, data)
      
      if (!group) {
        res.status(404).json({
          success: false,
          message: 'Group not found'
        })
        return
      }
      
      res.json({
        success: true,
        message: 'Group updated successfully',
        data: group
      })
    } catch (error: any) {
      logger.error('Error updating group:', error)
      
      if (error.code === 'P2002') {
        res.status(409).json({
          success: false,
          message: 'Group name already exists'
        })
        return
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }

  async deleteGroup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const deleted = await groupsService.deleteGroup(id)
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Group not found'
        })
        return
      }
      
      res.json({
        success: true,
        message: 'Group deleted successfully'
      })
    } catch (error: any) {
      logger.error('Error deleting group:', error)
      
      // Handle specific error for users assigned to group
      if (error.message && error.message.includes('Cannot delete group')) {
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
      const permissions = await groupsService.getAvailablePermissions()
      
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

export const groupsController = new GroupsController()
