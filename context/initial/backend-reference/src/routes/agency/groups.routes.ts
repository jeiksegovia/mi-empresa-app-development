import { Router } from 'express'
import { groupsController } from '../../controllers/agency/groups.controller'
import { authMiddleware, requirePermission } from '../../middleware/auth'

const router = Router()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Apply authorization middleware - groups management requires access_configuration permission
router.use(requirePermission('access_configuration'))

// Groups CRUD operations
router.post('/', groupsController.createGroup.bind(groupsController))
router.get('/', groupsController.getGroups.bind(groupsController))
router.get('/permissions', groupsController.getAvailablePermissions.bind(groupsController))
router.get('/:id', groupsController.getGroupById.bind(groupsController))
router.put('/:id', groupsController.updateGroup.bind(groupsController))
router.delete('/:id', groupsController.deleteGroup.bind(groupsController))

export default router
