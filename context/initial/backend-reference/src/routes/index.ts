import { Router } from 'express'
import publicRoutes from './public'
import agencyRoutes from './agency'
import servicesRoutes from './services'

const router = Router()

// API v1 routes
router.use('/api/v1/public', publicRoutes)
router.use('/api/v1/agency', agencyRoutes)
router.use('/api/v1/services', servicesRoutes)

export default router
