import { Router } from 'express'
import authRoutes from './auth.routes'
import requestsRoutes from './requests.routes'
import documentsRoutes from './documents.routes'
import usersRoutes from './users.routes'
import notesRoutes from './notes.routes'
import supportTicketsRoutes from './support-tickets.routes'
import redactionRoutes from './redaction.routes'
import groupsRoutes from './groups.routes'
import rolesRoutes from './roles.routes'
import userManagementRoutes from './user-management.routes'
import invoicesRoutes from './invoices.routes'

const router = Router()

// Internal agency routes
router.use('/auth', authRoutes)  // Authentication endpoints
router.use('/requests', requestsRoutes)
router.use('/documents', documentsRoutes)
router.use('/users', usersRoutes)
router.use('/', notesRoutes)  // Notes routes
router.use('/support-tickets', supportTicketsRoutes)
router.use('/redaction', redactionRoutes)
router.use('/groups', groupsRoutes)
router.use('/roles', rolesRoutes)
router.use('/user-management', userManagementRoutes)
router.use('/invoices', invoicesRoutes)

export default router
