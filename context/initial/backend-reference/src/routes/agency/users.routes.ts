import { Router } from 'express'
import * as controller from '../../controllers/agency/users.controller'
import { authMiddleware, requirePermission } from '../../middleware/auth'

const router = Router()

// Agency routes - require authentication with agency-level permissions
router.use(authMiddleware)

router.get('/', controller.getAll)
router.get('/:id', controller.getById)
router.get('/idme/:idmeId', controller.getByIDMeId)

// User management routes
router.post('/roles', controller.assignRole)
router.delete('/:userId/roles/:roleId', controller.removeRole)
router.get('/roles', controller.getRoles)
router.get('/permissions', controller.getPermissions)
router.patch('/:id/internal-status', controller.updateInternalStatus)

export default router
