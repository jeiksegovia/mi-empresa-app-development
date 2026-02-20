import { Request, Response, NextFunction } from 'express'
import { verifyJwt } from '../utils/jwt.js'
import { getPrisma } from '../config/database.js'
import { logger } from '../config/logger.js'

export function authMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionCookie = req.cookies?.session
      if (!sessionCookie) {
        res.status(401).json({ success: false, message: 'Authentication required' })
        return
      }

      const payload = verifyJwt(sessionCookie)

      const prisma = getPrisma()
      const session = await prisma.sesion.findFirst({
        where: {
          id: parseInt(payload.sessionId),
          usuarioId: payload.id,
          activa: true,
          expiraEn: { gt: new Date() },
        },
      })

      if (!session) {
        res.status(401).json({ success: false, message: 'Session expired or invalid' })
        return
      }

      req.user = payload
      next()
    } catch (error) {
      logger.error('Auth middleware error:', error)
      res.status(401).json({ success: false, message: 'Invalid or expired token' })
    }
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' })
      return
    }

    if (req.user.rol === 'ADMIN') {
      next()
      return
    }

    if (!roles.includes(req.user.rol)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' })
      return
    }

    next()
  }
}
