import { Router } from 'express'
import workflowsRoutes from './workflows.routes'

const router = Router()

// Service-to-service routes
router.use('/workflows', workflowsRoutes)

export default router
