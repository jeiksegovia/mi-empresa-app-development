import { Router } from 'express'
import authRoutes from './auth.routes'
import requestsRoutes from './requests.routes'
import documentsRoutes from './documents.routes'
import usersRoutes from './users.routes'
import notesRoutes from './notes.routes'
import supportTicketsRoutes from './support-tickets.routes'
import invoicesRoutes from './invoices.routes'

const router = Router()

// Public-facing routes
router.use('/auth', authRoutes)  
router.use('/requests', requestsRoutes)
router.use('/documents', documentsRoutes)
router.use('/users', usersRoutes)
router.use('/', notesRoutes) 
router.use('/support-tickets', supportTicketsRoutes)
router.use('/invoices', invoicesRoutes)

export default router
