import { Router } from 'express'
import { rolesController } from '../../controllers/agency/roles.controller'
import { authMiddleware, requirePermission } from '../../middleware/auth'

const router = Router()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Apply authorization middleware - roles management requires access_configuration permission
router.use(requirePermission('access_configuration'))

// Roles CRUD operations
router.post('/', rolesController.createRole.bind(rolesController))
router.get('/', rolesController.getRoles.bind(rolesController))
router.get('/permissions', rolesController.getAvailablePermissions.bind(rolesController))
router.get('/:id', rolesController.getRoleById.bind(rolesController))
router.put('/:id', rolesController.updateRole.bind(rolesController))
router.delete('/:id', rolesController.deleteRole.bind(rolesController))

export default router
