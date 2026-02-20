import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  loginUser,
  logoutUser,
  getCurrentUser,
  refreshSession,
} from '../services/authService.js'
import { logger } from '../config/logger.js'

const router = Router()

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

const refreshSchema = z.object({
  sessionToken: z.string().min(1, 'Token de sesión requerido'),
})

/**
 * POST /api/v1/auth/login
 * Email/password login, create JWT session cookie
 */
router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body

      // Get client IP and user agent
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress
      const userAgent = req.headers['user-agent']

      // Authenticate user
      const result = await loginUser(email, password, ip, userAgent)

      // Set HTTP-only cookie
      res.cookie('session', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })

      logger.info(`User logged in: ${email}`)

      res.json({
        user: result.user,
      })
    } catch (error) {
      if (error instanceof Error) {
        // Handle authentication errors
        if (
          error.message === 'Credenciales inválidas' ||
          error.message === 'Usuario inactivo'
        ) {
          res.status(401).json({
            error: error.message,
          })
          return
        }
      }
      next(error)
    }
  }
)

/**
 * POST /api/v1/auth/logout
 * Invalidate session, clear cookie
 */
router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionToken = req.cookies?.session

      if (sessionToken) {
        await logoutUser(sessionToken)
      }

      // Clear session cookie
      res.clearCookie('session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      })

      logger.info('User logged out')

      res.json({
        message: 'Sesión cerrada exitosamente',
      })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * GET /api/v1/auth/me
 * Get current user info (protected)
 */
router.get(
  '/me',
  authMiddleware(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'No autenticado',
        })
        return
      }

      // Get fresh user data
      const user = await getCurrentUser(req.user.id)

      res.json({
        user,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'Usuario no encontrado') {
        res.status(404).json({
          error: error.message,
        })
        return
      }
      next(error)
    }
  }
)

/**
 * POST /api/v1/auth/refresh
 * Refresh token logic - extend session expiration
 */
router.post(
  '/refresh',
  authMiddleware(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'No autenticado',
        })
        return
      }

      // Refresh session
      const newToken = await refreshSession(parseInt(req.user.sessionId))

      // Update cookie with new token
      res.cookie('session', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })

      logger.info(`Session refreshed for user: ${req.user.email}`)

      res.json({
        message: 'Sesión actualizada exitosamente',
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'Sesión inválida o expirada') {
        res.status(401).json({
          error: error.message,
        })
        return
      }
      if (error instanceof Error && error.message === 'Usuario inactivo') {
        res.status(403).json({
          error: error.message,
        })
        return
      }
      next(error)
    }
  }
)

export { router as authRoutes }
