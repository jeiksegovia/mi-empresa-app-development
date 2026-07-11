import { Request, Response, NextFunction } from 'express'
import { verifyJwt } from '../utils/jwt.js'
import { getPrisma } from '../config/database.js'
import { logger } from '../config/logger.js'

interface AuthRequest extends Request {
  userId?: number
  sessionId?: string
  user?: any
}

export async function auth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Try to get token from cookie first, then from Authorization header
    const token = req.cookies?.session || req.get('Authorization')?.replace('Bearer ', '')

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required' })
      return
    }

    const payload = verifyJwt(token)

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

    req.userId = payload.id
    req.sessionId = payload.sessionId
    req.user = payload
    next()
  } catch (error) {
    logger.error('Auth middleware error:', error)
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

export function authMiddleware() {
  return auth
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
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

/**
 * jul-10 C6 / L2: gate /instruments/* WRITE ops (POST/PUT/DELETE).
 * Allows:
 *   - ADMIN (always), OR
 *   - EMPLEADO with tipoEmpleado='GERONTOLOGA'
 * Denies: plain EMPLEADO, AUDITOR, OPERADOR → 403.
 *
 * The JWT payload has `rol` but NOT `tipoEmpleado`, so we look up the
 * current Usuario record (one SELECT per request) and attach to req.
 */
export function requireInstrumentWriter() {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, message: 'Authentication required' })
        return
      }

      const prisma = getPrisma()
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.userId },
        select: { id: true, rol: true, tipoEmpleado: true, activo: true },
      })

      if (!usuario || !usuario.activo) {
        res.status(401).json({ success: false, message: 'User not found or inactive' })
        return
      }

      // ADMIN bypass
      if (usuario.rol === 'ADMIN') {
        req.user = { ...(req.user || {}), rol: usuario.rol, tipoEmpleado: usuario.tipoEmpleado }
        next()
        return
      }

      // EMPLEADO + GERONTOLOGA bypass
      if (usuario.rol === 'EMPLEADO' && usuario.tipoEmpleado === 'GERONTOLOGA') {
        req.user = { ...(req.user || {}), rol: usuario.rol, tipoEmpleado: usuario.tipoEmpleado }
        next()
        return
      }

      res.status(403).json({
        success: false,
        message: 'Insufficient permissions: instrument writes require ADMIN or EMPLEADO+GERONTOLOGA',
      })
    } catch (error) {
      logger.error('requireInstrumentWriter error:', error)
      res.status(500).json({ success: false, message: 'Authorization check failed' })
    }
  }
}
