/**
 * Domain-based RBAC middleware — fixes-jul17-2 contract §1.2 / §1.3.
 *
 * Single source of truth for "can this EMPLEADO (with a specialization)
 * perform a write on this domain?" The matrix below is FROZEN once #31
 * completes; W10's frontend mirror must stay in parity (QA validates).
 *
 * Semantics (contract §1.3, augmented by fixes-features-aug-6 §2.1):
 *   1. No auth → 401 (existing authMiddleware already handles this).
 *   2. rol === 'ADMIN' → allow.
 *   3. rol !== 'EMPLEADO' (AUDITOR / OPERADOR) → fall through to EXISTING
 *      behavior (requireRole / etc.); this middleware does NOT add
 *      restrictions on their paths.
 *   4. EMPLEADO + tipoEmpleado null → allow (legacy, zero regression).
 *   5. EMPLEADO + GERONTOLOGA / CONTRATOS / PROFESORES / AUXILIARES →
 *      matrix lookup:
 *      - matrix[domain] === true           → allow
 *      - matrix[domain] === false          → 403 DOMAIN_FORBIDDEN
 *      - matrix[domain] === 'create-only'  → GET + POST allowed; PUT/PATCH/DELETE → 403
 *      - matrix[domain] === 'read-only'    → GET allowed; POST/PUT/PATCH/DELETE → 403
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
  // centro-costos-ago-5: D4 ADMIN bypass, CONTRATOS true, GERONTOLOGA false
  | 'centro-costos'
  // qa-session-aug-17 R6: Registro de actividades
  | 'actividades'

/**
 * Domain access value vocabulary (contract §2.1 — fixes-features-aug-6).
 *   true        → full access (all HTTP methods).
 *   false       → 403 for ALL methods.
 *   'create-only' → GET + POST allowed; PUT/PATCH/DELETE → 403.
 *   'read-only'   → GET allowed; POST/PUT/PATCH/DELETE → 403.
 */
export type DomainAccessValue = boolean | 'create-only' | 'read-only'

/**
 * fixes-features-aug-6 §2.3: tipoEmpleado allow-list (extended to 4 values).
 * Unknown future specialization → allow (legacy zero-regression).
 */
const MATRIX_TIPOS = ['GERONTOLOGA', 'CONTRATOS', 'PROFESORES', 'AUXILIARES'] as const
type MatrixTipo = typeof MATRIX_TIPOS[number]

/**
 * Authoritative matrix (contract §2.2 — fixes-features-aug-6).
 * 4 tipos × 11 domains. S1 added PROFESORES + AUXILIARES rows; S3 flipped
 * GERONTOLOGA.certificados from false to true.
 */
export const DOMAIN_ACCESS: Record<MatrixTipo, Record<Domain, DomainAccessValue>> = {
  GERONTOLOGA: {
    pacientes: true,
    fichas: true,
    instrumentos: true,
    empleados: false,
    nomina: false,
    certificados: true, // S3 — was false → true
    empresa: false,
    notas: true,
    asistencia: false,
    'centro-costos': false,
    actividades: 'read-only', // qa-session-aug-17 R6
  },
  CONTRATOS: {
    pacientes: 'create-only',
    fichas: false,
    instrumentos: false,
    empleados: true,
    nomina: true,
    certificados: true,
    // CONTRACT D1: stays false — GET /empresa/cargos is a route-level exception only
    // (qa-session-aug-17 R2). Do NOT flip this cell for the cargos exception.
    empresa: false,
    notas: false,
    asistencia: true,
    'centro-costos': true,
    actividades: 'read-only', // qa-session-aug-17 R6
  },
  // S1: Identical rows for the two new sub-roles.
  PROFESORES: {
    pacientes: 'read-only',     // S1: view basic info, no create/edit
    fichas: 'create-only',      // S1: fill ficha, no edit/delete
    instrumentos: false,        // S1: cannot manage catalog
    empleados: false,
    nomina: false,
    certificados: false,
    empresa: false,
    notas: 'create-only',       // S1 + S3: create-only (see §4 for autor filter)
    asistencia: false,
    'centro-costos': false,
    actividades: 'create-only', // qa-session-aug-17 R6
  },
  AUXILIARES: {
    pacientes: 'read-only',     // S1: identical to PROFESORES
    fichas: 'create-only',
    instrumentos: false,
    empleados: false,
    nomina: false,
    certificados: false,
    empresa: false,
    notas: 'create-only',       // S1: identical to PROFESORES
    asistencia: false,
    'centro-costos': false,
    actividades: 'create-only', // qa-session-aug-17 R6
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

      // Step 5: matrix lookup (allow-list extended to 4 tipos per §2.3).
      if (!(MATRIX_TIPOS as readonly string[]).includes(tipoEmpleado)) {
        // Unknown future specialization — be safe, allow (existing behavior)
        // rather than 403 a brand new sub-role that isn't in the matrix yet.
        logger.warn(`requireDomain(${domain}): unknown tipoEmpleado=${tipoEmpleado} — allowing`)
        next()
        return
      }

      const access = DOMAIN_ACCESS[tipoEmpleado as MatrixTipo][domain]
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
      // 'create-only' or 'read-only' (contract §2.1)
      const method = req.method.toUpperCase()
      if (access === 'create-only' && (method === 'GET' || method === 'POST')) {
        next()
        return
      }
      if (access === 'read-only' && method === 'GET') {
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

/**
 * requireEmployeeUnlocked — qa-session-jul-31 followup (aug-04): admin "bloqueador".
 *
 * When an empleado is `bloqueado`, only ADMIN may mutate it (its record, medio de
 * pago, and contratos). Every other role gets 403 EMPLOYEE_LOCKED. Apply this
 * per-route on the mutating endpoints reachable by non-admins (PUT/DELETE
 * /employees/:id and the contratos create/edit/delete). Runs AFTER
 * requireDomain, so the caller already passed the domain matrix.
 *
 * Security/efficiency: ADMIN bypasses before any DB hit; otherwise exactly one
 * `SELECT bloqueado` per request. The lock state is read from the DB (never the
 * client), and the `bloqueado*` columns are absent from the create/update Zod
 * schemas, so there is no request path for a non-admin to flip the lock.
 *
 * @param param name of the route param OR body field carrying the empleado id
 *   (default 'id'). qa-session-aug-17 R4: periodos POST/PUT pass 'empleadoId'
 *   so the lock check reads `req.body.empleadoId` (body preferred) with an
 *   optional async resolver for PUT when body omits it.
 * @param resolveEmpleadoId optional async fallback when param/body is absent
 *   (e.g. load existing NominaPeriodo.empleadoId on PUT /periodos/:id).
 */
export function requireEmployeeUnlocked(
  param: string = 'id',
  resolveEmpleadoId?: (req: AuthedRequest) => Promise<number | null | undefined>,
) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // ADMIN always allowed to edit, even when locked (they own lock/unlock).
      if (req.user?.rol === 'ADMIN') {
        next()
        return
      }

      let empleadoId: number | null = null
      const fromParams = req.params?.[param]
      const fromBody = (req.body as any)?.[param]
      const raw = fromBody !== undefined && fromBody !== null && fromBody !== ''
        ? fromBody
        : fromParams
      if (raw !== undefined && raw !== null && raw !== '') {
        const parsed = Number.parseInt(String(raw), 10)
        if (!Number.isNaN(parsed)) empleadoId = parsed
      }

      if (empleadoId === null && resolveEmpleadoId) {
        const resolved = await resolveEmpleadoId(req)
        if (resolved !== null && resolved !== undefined && !Number.isNaN(Number(resolved))) {
          empleadoId = Number(resolved)
        }
      }

      if (empleadoId === null) {
        // Malformed / missing id — let the route handler return its own 400/404.
        next()
        return
      }
      const prisma = getPrisma()
      const empleado = await prisma.empleado.findUnique({
        where: { id: empleadoId },
        select: { bloqueado: true },
      })
      if (empleado?.bloqueado) {
        res.status(403).json({
          success: false,
          message: 'Empleado bloqueado: solo un administrador puede editarlo',
          code: 'EMPLOYEE_LOCKED',
        })
        return
      }
      next()
    } catch (error) {
      logger.error('requireEmployeeUnlocked error:', error)
      res.status(500).json({ success: false, message: 'Lock check failed' })
    }
  }
}
