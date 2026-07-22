/**
 * Domain-based RBAC middleware — fixes-jul17-2 contract §1.2 / §1.3.
 *
 * Single source of truth for "can this EMPLEADO (with a specialization)
 * perform a write on this domain?" The matrix below is FROZEN once #31
 * completes; W10's frontend mirror must stay in parity (QA validates).
 *
 * Semantics (contract §1.3):
 *   1. No auth → 401 (existing authMiddleware already handles this).
 *   2. rol === 'ADMIN' → allow.
 *   3. rol !== 'EMPLEADO' (AUDITOR / OPERADOR) → fall through to EXISTING
 *      behavior (requireRole / etc.); this middleware does NOT add
 *      restrictions on their paths.
 *   4. EMPLEADO + tipoEmpleado null → allow (legacy, zero regression).
 *   5. EMPLEADO + GERONTOLOGA / CONTRATOS → matrix lookup:
 *      - matrix[domain] === true   → allow
 *      - matrix[domain] === false  → 403 DOMAIN_FORBIDDEN
 *      - matrix[domain] === 'create-only'
 *           → GET list/detail + POST create allowed
 *           → PUT / PATCH / DELETE → 403 DOMAIN_FORBIDDEN
 *
 * `requireInstrumentWriter` (jul-10 C6) is UNCHANGED and still runs in
 * addition where already applied — it gates GERONTOLOGA vs plain EMPLEADO
 * on instrument WRITES; requireDomain only adds the per-domain rule.
 */

import { Request, Response, NextFunction } from 'express'
import { getPrisma } from '../config/database.js'
import { logger } from '../config/logger.js'

export type Domain =
  | 'pacientes'
  | 'fichas'
  | 'instrumentos'
  | 'empleados'
  | 'nomina'
  | 'certificados'
  | 'empresa'
  | 'notas'
  // nomina-asistencia-jul-18: same matrix as empleados
  | 'asistencia'

/**
 * Authoritative matrix (contract §1.2 table).
 *   true        → full access (all HTTP methods).
 *   false       → 403 for ALL methods.
 *   'create-only' → GET + POST allowed; PUT/PATCH/DELETE → 403.
 */
export const DOMAIN_ACCESS: Record<'GERONTOLOGA' | 'CONTRATOS', Record<Domain, boolean | 'create-only'>> = {
  GERONTOLOGA: {
    pacientes: true,
    fichas: true,
    instrumentos: true,
    empleados: false,
    nomina: false,
    certificados: false,
    empresa: false,
    notas: true,
    asistencia: false,
  },
  CONTRATOS: {
    pacientes: 'create-only',
    fichas: false,
    instrumentos: false,
    empleados: true,
    nomina: true,
    certificados: true,
    empresa: false,
    notas: false,
    asistencia: true,
  },
}

interface AuthedRequest extends Request {
  userId?: number
  // Runtime shape is UserTokenPayload from auth middleware (which doesn't
  // include tipoEmpleado) PLUS optional tipoEmpleado that requireInstrumentWriter
  // or requireDomain may have attached. We type as `any` here to avoid coupling
  // domainAccess to the JWT payload shape; we only read rol + tipoEmpleado.
  user?: any
}

/**
 * Express middleware factory. Attaches `req.user.tipoEmpleado` if missing
 * (one Prisma SELECT per request, mirrored from requireInstrumentWriter).
 * Apply per-route — NOT as router.use() blanket — so the contract's per
 * route inventory is preserved.
 */
export function requireDomain(domain: Domain) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Step 1: authMiddleware runs first; if we got here, user is authed.
      // But userId could be missing in tests — bail safely.
      if (!req.userId) {
        res.status(401).json({ success: false, message: 'Authentication required' })
        return
      }

      // Step 2: ADMIN bypass — never restrict.
      const rol = req.user?.rol
      if (rol === 'ADMIN') {
        next()
        return
      }

      // Step 3: AUDITOR / OPERADOR — fall through to EXISTING behavior.
      // requireDomain does NOT add restrictions for these roles.
      if (rol !== 'EMPLEADO') {
        next()
        return
      }

      // From here, rol === 'EMPLEADO' — apply the matrix.
      // Look up tipoEmpleado (one DB hit; cheap because JWT payload omits it).
      let tipoEmpleado: string | null = req.user?.tipoEmpleado ?? null
      if (req.user?.tipoEmpleado === undefined) {
        const prisma = getPrisma()
        const usuario = await prisma.usuario.findUnique({
          where: { id: req.userId },
          select: { rol: true, tipoEmpleado: true, activo: true },
        })
        if (!usuario || !usuario.activo) {
          res.status(401).json({ success: false, message: 'User not found or inactive' })
          return
        }
        tipoEmpleado = usuario.tipoEmpleado ?? null
        // Persist on req.user so downstream middleware (requireRole, etc.) sees it.
        req.user = { ...(req.user || {}), rol: usuario.rol, tipoEmpleado }
      }

      // Step 4: EMPLEADO + tipoEmpleado null → legacy zero-regression allow.
      if (tipoEmpleado === null) {
        next()
        return
      }

      // Step 5: matrix lookup.
      if (tipoEmpleado !== 'GERONTOLOGA' && tipoEmpleado !== 'CONTRATOS') {
        // Unknown future specialization — be safe, allow (existing behavior)
        // rather than 403 a brand new sub-role that isn't in the matrix yet.
        logger.warn(`requireDomain(${domain}): unknown tipoEmpleado=${tipoEmpleado} — allowing`)
        next()
        return
      }

      const access = DOMAIN_ACCESS[tipoEmpleado as 'GERONTOLOGA' | 'CONTRATOS'][domain]
      if (access === true) {
        next()
        return
      }
      if (access === false) {
        res.status(403).json({
          success: false,
          message: 'Acceso no permitido para su perfil',
          code: 'DOMAIN_FORBIDDEN',
        })
        return
      }
      // 'create-only'
      const method = req.method.toUpperCase()
      if (method === 'GET' || method === 'POST') {
        next()
        return
      }
      res.status(403).json({
        success: false,
        message: 'Acceso no permitido para su perfil',
        code: 'DOMAIN_FORBIDDEN',
      })
    } catch (error) {
      logger.error(`requireDomain(${domain}) error:`, error)
      res.status(500).json({ success: false, message: 'Authorization check failed' })
    }
  }
}
