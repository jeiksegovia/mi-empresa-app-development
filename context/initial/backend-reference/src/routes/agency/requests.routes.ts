import { Router } from 'express'
import * as controller from '../../controllers/agency/requests.controller'
import * as supportTicketsController from '../../controllers/agency/support-tickets.controller'
import { authMiddleware, requirePermission } from '../../middleware/auth'
import { restrictNonAssignmentUpdates, requireCanEditRequest } from '../../middleware/assignmentRestriction'

const router = Router()

// Agency routes - require authentication with agency-level permissions
router.use(authMiddleware)

router.get('/', controller.getAll)
router.post('/', controller.create)

// Exemptions and exclusions for frontend dropdowns (MUST come before /:id routes)
router.get('/exemptions', controller.getExemptions)
router.get('/exclusions', controller.getExclusions)

router.get('/by-number/:requestNumber', controller.getOneByNumber)

// Get exemptions/exclusions info for a specific request
router.get('/:id/exemptions-exclusions-info', controller.getRequestExemptionsExclusionsInfo)
router.get('/:id', controller.getOne)
router.put('/:id', restrictNonAssignmentUpdates, controller.update)
router.delete('/:id', controller.deleteRequest)

// Agency-specific routes
router.patch('/:id/assign', requirePermission('assign_cases'), controller.assignRequest)
router.patch('/:id/status', requirePermission('add_notes'), requireCanEditRequest, controller.updateStatus)

// Request workflow handler (reopen, complete, close)
router.post('/:id/workflow',
  requirePermission('add_notes'),
  requireCanEditRequest,
  controller.handleWorkflow)

// Support tickets for a specific request (RESTful sub-resource)
router.get('/:id/support-tickets', supportTicketsController.getTicketsForRequest)

export default router
