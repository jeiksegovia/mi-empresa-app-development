import { Router } from 'express'
import * as controller from '../../controllers/public/notes.controller'
import { authMiddleware } from '../../middleware/auth'

const router = Router()

// Public routes - require authentication for all operations
router.use(authMiddleware)

// Get public notes for a request (public users only see non-internal notes)
router.get('/requests/:requestId/notes', controller.list)

// Get a specific public note
router.get('/notes/:id', controller.getOne)

// Create a new public note (for requesters to add notes to their requests)
router.post('/requests/:requestId/notes', controller.create)

// Update a public note (requesters can only update their own public notes)
router.put('/notes/:id', controller.update)

// Delete a public note (requesters can only delete their own public notes)
router.delete('/notes/:id', controller.deleteNote)

export default router
