import { Router } from 'express'
import * as controller from '../../controllers/agency/notes.controller'
import { authMiddleware } from '../../middleware/auth'
import { requireCanEditRequest, requireCanEditRequestByNote } from '../../middleware/assignmentRestriction'

const router = Router()

// All notes routes require authentication
router.use(authMiddleware)

// Get all notes for a request (internal users see all notes)
router.get('/requests/:requestId/notes', controller.list)

// Get a specific note
router.get('/notes/:id', controller.getOne)

// Create a new note - requires assignment-based edit permissions
router.post('/requests/:requestId/notes', requireCanEditRequest, controller.create)

// Update a note - requires assignment-based edit permissions  
router.put('/notes/:id', requireCanEditRequestByNote, controller.update)

// Delete a note - requires assignment-based edit permissions
router.delete('/notes/:id', requireCanEditRequestByNote, controller.deleteNote)

export default router
