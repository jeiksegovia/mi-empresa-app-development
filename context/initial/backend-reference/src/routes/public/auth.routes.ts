import { Router } from 'express'
import { login, oauthCallback, logout } from '../../controllers/public/auth.controller'

const router = Router()

// Public authentication endpoints
router.post('/login', login)                    
router.get('/oauth/callback', oauthCallback)    // OAuth2 callback from ID.me
router.post('/logout', logout)                  // Logout

export default router
