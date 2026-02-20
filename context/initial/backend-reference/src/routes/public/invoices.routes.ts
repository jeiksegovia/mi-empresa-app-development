import { Router } from 'express'
import * as controller from '../../controllers/public/invoices.controller'
import { authMiddleware } from '../../middleware/auth'

const router = Router()

// Public routes - require authentication for all operations
router.use(authMiddleware)

// Get all invoices for the authenticated user
router.get('/', controller.getAll)

// Get invoices for a specific request
router.get('/requests/:requestId', controller.getByRequestId)

// Get a specific invoice by ID
router.get('/:id', controller.getById)

// Download receipt for an invoice
router.get('/:id/receipt', controller.downloadReceipt)

// Get payment page for an invoice
router.get('/:id/payment', controller.getPaymentPage)

export default router
