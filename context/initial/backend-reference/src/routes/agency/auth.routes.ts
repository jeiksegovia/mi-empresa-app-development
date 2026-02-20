import { Router } from 'express'
import { login, logout, validateSession } from '../../controllers/agency/auth.controller'
import { authMiddleware } from '../../middleware/auth'

const router = Router()

// Agency authentication endpoints - username/password based
router.post('/login', login)                    // Login with username/password
router.post('/logout', logout)                  // Logout
router.get('/validate', authMiddleware, validateSession)  // Validate session

export default router
