import { Router } from 'express'
import * as controller from '../../controllers/public/documents.controller'
import { authMiddleware } from '../../middleware/auth'

const router = Router()

// Public routes - require authentication for all operations
router.use(authMiddleware)

router.get('/:id', controller.list)
router.post('/:id/initiate-download', controller.initiateDownload)

export default router
