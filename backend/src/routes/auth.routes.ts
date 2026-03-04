import { Router, Request, Response } from 'express'
import { loginUser, logoutUser, getCurrentUser } from '../services/authService.js'
import { auth as authMiddleware } from '../middleware/auth.js'

const router = Router()

interface LoginRequest {
  email: string
  password: string
}

interface AuthRequest extends Request {
  userId?: number
  sessionId?: string
}

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      })
    }

    const result = await loginUser(email, password, req.ip, req.get('user-agent'))

    // Set JWT token as HTTP-only cookie for security
    res.cookie('sessionToken', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    return res.json({
      success: true,
      user: result.user,
      sessionToken: result.sessionToken, // Also return in response for client-side storage
    })
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Login failed',
    })
  }
})

// Logout endpoint
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const token = req.get('Authorization')?.replace('Bearer ', '') || ''

    if (token) {
      await logoutUser(token)
    }

    res.clearCookie('sessionToken')

    return res.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Logout failed',
    })
  }
})

// Get current user endpoint
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in request',
      })
    }

    const user = await getCurrentUser(req.userId)

    return res.json({
      success: true,
      user,
    })
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Failed to get user',
    })
  }
})

export { router as authRoutes }
