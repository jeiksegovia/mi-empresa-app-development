import { Router } from 'express'
import { userManagementController } from '../../controllers/agency/user-management.controller'
import { authMiddleware, requirePermission } from '../../middleware/auth'

const router = Router()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Apply authorization middleware - user management requires access_configuration permission
router.use(requirePermission('access_configuration'))

// User Management CRUD operations
router.post('/', userManagementController.createUser.bind(userManagementController))
router.get('/', userManagementController.getUsers.bind(userManagementController))
router.get('/roles', userManagementController.getAvailableRoles.bind(userManagementController))
router.get('/groups', userManagementController.getAvailableGroups.bind(userManagementController))
router.get('/:id', userManagementController.getUserById.bind(userManagementController))
router.get('/:id/permissions', userManagementController.getUserPermissions.bind(userManagementController))
router.put('/:id', userManagementController.updateUser.bind(userManagementController))
router.delete('/:id', userManagementController.deleteUser.bind(userManagementController))

export default router
