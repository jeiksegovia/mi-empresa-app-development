import { Router } from 'express'
import * as controller from '../../controllers/agency/documents.controller'
import * as redactionController from '../../controllers/agency/redaction.controller'
import { authMiddleware, requirePermission } from '../../middleware/auth'
import { preventModificationOnCompletedRequest } from '../../middleware/requestCompletion'
import { requireCanEditRequest, requireCanEditRequestByDocument } from '../../middleware/assignmentRestriction'

const router = Router()

router.use(authMiddleware)

// Read operations - no restrictions on completed requests
router.get('/:id', controller.list)
router.get('/:id/preview', controller.preview)
router.post('/:id/initiate-download', controller.initiateDownload)
router.post('/:id/complete-upload', controller.completeUpload)
router.post('/:id/multipart/generate-part', controller.generateMultipartPart)
router.post('/:id/multipart/complete', controller.completeMultipartUpload)
router.post('/:id/multipart/abort', controller.abortMultipartUpload)
router.delete('/:id', controller.remove)

// Document modification operations - require assignment-based edit permissions and prevent when request is completed
router.post('/:id', requireCanEditRequest, preventModificationOnCompletedRequest, controller.upload)
router.post('/:id/initiate-upload', requireCanEditRequest, preventModificationOnCompletedRequest, controller.initiateUpload)
router.post('/:id/complete-upload', requireCanEditRequest, preventModificationOnCompletedRequest, controller.completeUpload)
router.delete('/:id', requireCanEditRequestByDocument, preventModificationOnCompletedRequest, controller.remove)

// Document status and workflow operations - require assignment-based edit permissions and prevent when request is completed
router.patch('/:id/status', 
  requirePermission('update_status'),
  requireCanEditRequestByDocument,
  preventModificationOnCompletedRequest,
  controller.updateStatus)

// Document workflow handler
router.post('/:id/workflow', 
  requirePermission('update_status'),
  requireCanEditRequestByDocument,
  preventModificationOnCompletedRequest,
  controller.handleWorkflow)

// Mock Hyperscience redaction flow (for testing) - processes a single document
router.post('/:id/mock-redaction-flow', 
  requirePermission('update_status'),
  requireCanEditRequestByDocument,
  preventModificationOnCompletedRequest,
  controller.mockRedactionFlow)

// Hyperscience redaction flow
router.post('/:id/redaction', 
  requirePermission('update_status'),
  requireCanEditRequestByDocument,
  preventModificationOnCompletedRequest,
  redactionController.initiateRedaction)

export default router
