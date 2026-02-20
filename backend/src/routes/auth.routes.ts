import { Router } from 'express'

const router = Router()

// Placeholder - will be implemented in Phase 2
router.post('/login', (_req, res) => {
  res.json({ success: true, message: 'Login endpoint - to be implemented' })
})

router.post('/logout', (_req, res) => {
  res.json({ success: true, message: 'Logout endpoint - to be implemented' })
})

router.get('/me', (_req, res) => {
  res.json({ success: true, message: 'Me endpoint - to be implemented' })
})

export { router as authRoutes }
