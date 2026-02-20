import { Router } from 'express'
import * as controller from '../../controllers/services/workflows.controller'
import { servicesApiKey } from '../../middleware/servicesApiKey'

const router = Router()

// All routes require service API key authentication
router.use(servicesApiKey)

// Hyperscience redaction notification endpoint
router.post('/redacted-notifications', controller.postRedactedNotification)

export default router
