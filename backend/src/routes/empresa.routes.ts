import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requireDomain } from '../middleware/domainAccess.js'
import { getPrisma } from '../config/database.js'
import { z } from 'zod'
import * as empresaService from '../services/empresaService.js'
import * as cargoService from '../services/cargoEmpresaService.js'
import { logger } from '../config/logger.js'

const router = Router()

router.use(authMiddleware())

// fixes-jul17-2 §1.2: empresa domain — matrix is false for BOTH GERONTOLOGA and
// CONTRATOS. Applied per-route below (not as router.use) so GET /cargos can
// carry the qa-session-aug-17 R2 route-level exception without flipping
// DOMAIN_ACCESS.CONTRATOS.empresa (contract D1 — stays false).

const updateEmpresaSchema = z.object({
  // jul-10 E1: normalize to upper-case + trim
  nombre: z.string().min(1).max(200).transform((v) => v.trim().toUpperCase()).optional(),
  nit: z.string().min(1).max(50).optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
})

// W6: Empresa bootstrap from empty DB. nombre + nit are REQUIRED on create;
// optional fields stay optional. Same E1 uppercase transform as update.
const createEmpresaSchema = z.object({
  nombre: z.string().min(1).max(200).transform((v) => v.trim().toUpperCase()),
  nit: z.string().min(1).max(50),
  direccion: z.string().max(255).optional(),
  telefono: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
})

// ─── jul-9 D7: CargoEmpresa catalog ───

const createCargoSchema = z.object({
  nombre: z.string().min(1).max(100),
})

const updateCargoSchema = z.object({
  activo: z.boolean().optional(),
})

/**
 * qa-session-aug-17 R2 + aug-27 3rd pass:
 * Allow EMPLEADO + CONTRATOS on GET (read catalog) and POST (create cargo)
 * for /empresa/cargos only.
 * Matrix cell CONTRATOS.empresa stays false — this is NOT a matrix change.
 * PATCH/DELETE stay ADMIN-only via requireDomain('empresa') + requireRole('ADMIN').
 */
function requireEmpresaOrContratosGetCargos() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user
      const userId = (req as any).userId as number | undefined
      const rol = user?.rol
      const method = req.method.toUpperCase()

      if (rol === 'ADMIN') {
        next()
        return
      }

      // GET: AUDITOR/OPERADOR fall through (same as requireDomain). POST from
      // those roles is not a CONTRATOS exception — they must not create cargos.
      if (rol && rol !== 'EMPLEADO') {
        if (method === 'GET') {
          next()
          return
        }
        return requireDomain('empresa')(req, res, next)
      }

      if (rol === 'EMPLEADO') {
        let tipoEmpleado: string | null = user?.tipoEmpleado ?? null
        if (user?.tipoEmpleado === undefined && userId) {
          const prisma = getPrisma()
          const usuario = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { rol: true, tipoEmpleado: true, activo: true },
          })
          if (!usuario || !usuario.activo) {
            res.status(401).json({ success: false, message: 'User not found or inactive' })
            return
          }
          tipoEmpleado = usuario.tipoEmpleado ?? null
          ;(req as any).user = { ...(user || {}), rol: usuario.rol, tipoEmpleado }
        }

        if (tipoEmpleado === 'CONTRATOS' && (method === 'GET' || method === 'POST')) {
          next()
          return
        }
      }

      return requireDomain('empresa')(req, res, next)
    } catch (error) {
      logger.error('requireEmpresaOrContratosGetCargos error:', error)
      res.status(500).json({ success: false, message: 'Authorization check failed' })
    }
  }
}

router.get('/cargos', requireEmpresaOrContratosGetCargos(), async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.query.activo as string | undefined
    let activo: boolean | 'all'
    if (raw === undefined || raw === '') activo = 'all'
    else if (raw === 'true') activo = true
    else if (raw === 'false') activo = false
    else {
      res.status(400).json({ success: false, message: 'activo must be true|false|all' })
      return
    }
    const data = await cargoService.listCargos({ activo })
    res.json({ success: true, data })
  } catch (error) {
    logger.error('List cargos error:', error)
    res.status(500).json({ success: false, message: 'Error listing cargos' })
  }
})

router.post('/cargos', requireEmpresaOrContratosGetCargos(), validate(createCargoSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await cargoService.createCargo(req.body)
    res.status(201).json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      const body: Record<string, unknown> = { success: false, message: e.message }
      if (e.field) body.field = e.field
      res.status(e.status).json(body)
      return
    }
    logger.error('Create cargo error:', e)
    res.status(500).json({ success: false, message: 'Error creating cargo' })
  }
})

router.patch('/cargos/:id', requireDomain('empresa'), requireRole('ADMIN'), validate(updateCargoSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid cargo ID' }); return }
    const data = await cargoService.updateCargo(id, req.body)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      const body: Record<string, unknown> = { success: false, message: e.message }
      if (e.field) body.field = e.field
      res.status(e.status).json(body)
      return
    }
    logger.error('Update cargo error:', e)
    res.status(500).json({ success: false, message: 'Error updating cargo' })
  }
})

router.delete('/cargos/:id', requireDomain('empresa'), requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid cargo ID' }); return }
    await cargoService.deleteCargo(id)
    // jul-9 D7 (QA GAP-3): contract §4.5 calls for 204 No Content on DELETE.
    res.status(204).end()
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message })
      return
    }
    logger.error('Delete cargo error:', e)
    res.status(500).json({ success: false, message: 'Error archiving cargo' })
  }
})

// GET /empresa - get current empresa (admin only)
// W6: normalize the empty-state response to 200 { data: null } so the frontend
// can render a "create mode" form without treating 404 as an error. The dev
// QA report shows the previous 404 was surfacing as a load-time error.
router.get('/', requireDomain('empresa'), requireRole('ADMIN'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const empresa = await empresaService.getEmpresa()
    if (!empresa) {
      res.status(200).json({ success: true, data: null })
      return
    }
    res.json({ success: true, data: empresa })
  } catch (error) {
    logger.error('Get empresa error:', error)
    res.status(500).json({ success: false, message: 'Error fetching empresa' })
  }
})

// POST /empresa - create empresa (admin only). W6: bootstrap from empty DB.
// Single-empresa system: returns 409 if a row already exists.
router.post('/', requireDomain('empresa'), requireRole('ADMIN'), validate(createEmpresaSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const empresa = await empresaService.createEmpresa(req.body)
    res.status(201).json({ success: true, data: empresa })
  } catch (e: any) {
    if (e?.status) {
      const body: Record<string, unknown> = { success: false, message: e.message }
      if (e.field) body.field = e.field
      res.status(e.status).json(body)
      return
    }
    if (e?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'NIT ya registrado', field: 'nit' })
      return
    }
    logger.error('Create empresa error:', e)
    res.status(500).json({ success: false, message: 'Error creating empresa' })
  }
})

// PUT /empresa/:id - update empresa (admin only)
router.put('/:id', requireDomain('empresa'), requireRole('ADMIN'), validate(updateEmpresaSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid empresa ID' })
      return
    }
    const empresa = await empresaService.updateEmpresa(id, req.body)
    res.json({ success: true, data: empresa })
  } catch (error: any) {
    logger.error('Update empresa error:', error)
    if (error.message === 'Empresa not found') {
      res.status(404).json({ success: false, message: 'Empresa not found' })
      return
    }
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'NIT ya registrado' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating empresa' })
  }
})

export { router as empresaRoutes }
