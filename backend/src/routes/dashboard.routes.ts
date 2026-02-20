import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { getDashboardStats } from '../services/dashboardService.js'
import { logger } from '../config/logger.js'

const router = Router()

router.get('/stats', authMiddleware(), async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getDashboardStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    logger.error('Dashboard stats error:', error)
    res.status(500).json({ success: false, message: 'Error fetching dashboard stats' })
  }
})

export { router as dashboardRoutes }
