import { Router } from 'express'
import * as controller from '../../controllers/public/support-tickets.controller'
import { authMiddleware } from '../../middleware/auth'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Get all support tickets for the authenticated user
router.get('/', controller.getTickets)

// Submit a support ticket for a specific request
router.post('/requests/:foiaRequestId', controller.submitTicket)

// Get support tickets for a specific request
router.get('/requests/:foiaRequestId', controller.getTicketsForRequest)

// Get a specific support ticket by ID
router.get('/:ticketId', controller.getTicket)

// Get a specific support ticket by ticket number
router.get('/number/:ticketNumber', controller.getTicketByNumber)

// Add a message to a support ticket
router.post('/:ticketId/messages', controller.addMessage)

export default router
