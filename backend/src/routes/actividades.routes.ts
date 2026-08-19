/**
 * actividades.routes — qa-session-aug-17 R6 / contract §4.3
 * Mounted at /api/v1/actividades.
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requireDomain } from '../middleware/domainAccess.js'
import * as actividadService from '../services/actividadService.js'
import { logger } from '../config/logger.js'

const router = Router()
router.use(authMiddleware())
router.use(requireDomain('actividades'))

const createSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  texto: z.string().min(1),
  empleadoId: z.number().int().positive().optional(),
})

const updateSchema = z.object({
  texto: z.string().min(1).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

async function buildCaller(req: Request): Promise<actividadService.ActividadCaller> {
  const user = req.user as any
  const userId = (req as any).userId as number
  let empleadoId: number | null =
    user?.empleadoId !== undefined && user?.empleadoId !== null
      ? Number(user.empleadoId)
      : null
  if (empleadoId === null || Number.isNaN(empleadoId)) {
    empleadoId = await actividadService.loadCallerEmpleadoId(userId)
  }
  return {
    userId,
    rol: user?.rol ?? 'EMPLEADO',
    tipoEmpleado: user?.tipoEmpleado ?? null,
    empleadoId,
  }
}

function sendServiceError(res: Response, e: any): boolean {
  if (!e?.status) return false
  const body: Record<string, unknown> = { success: false, message: e.message }
  if (e.code) body.code = e.code
  if (e.field) body.field = e.field
  res.status(e.status).json(body)
  return true
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = await buildCaller(req)
    const fecha = req.query.fecha as string | undefined
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      res.status(400).json({ success: false, message: 'fecha must be YYYY-MM-DD', field: 'fecha' })
      return
    }
    const empleadoIdRaw = req.query.empleadoId as string | undefined
    const empleadoId = empleadoIdRaw ? parseInt(empleadoIdRaw, 10) : undefined
    if (empleadoIdRaw && Number.isNaN(empleadoId!)) {
      res.status(400).json({ success: false, message: 'empleadoId must be a number', field: 'empleadoId' })
      return
    }
    const data = await actividadService.listActividades(caller, { fecha, empleadoId })
    res.json({ success: true, data })
  } catch (e: any) {
    if (sendServiceError(res, e)) return
    logger.error('List actividades error:', e)
    res.status(500).json({ success: false, message: 'Error listing actividades' })
  }
})

router.post('/', validate(createSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = await buildCaller(req)
    const data = await actividadService.createActividad(caller, req.body)
    res.status(201).json({ success: true, data })
  } catch (e: any) {
    if (sendServiceError(res, e)) return
    logger.error('Create actividad error:', e)
    res.status(500).json({ success: false, message: 'Error creating actividad' })
  }
})

// PUT/DELETE: ADMIN only (matrix already blocks create-only writers; explicit role for clarity)
router.put(
  '/:id',
  requireRole('ADMIN'),
  validate(updateSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string)
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid id' })
        return
      }
      const data = await actividadService.updateActividad(id, req.body)
      res.json({ success: true, data })
    } catch (e: any) {
      if (sendServiceError(res, e)) return
      logger.error('Update actividad error:', e)
      res.status(500).json({ success: false, message: 'Error updating actividad' })
    }
  },
)

router.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid id' })
      return
    }
    await actividadService.deleteActividad(id)
    res.status(204).end()
  } catch (e: any) {
    if (sendServiceError(res, e)) return
    logger.error('Delete actividad error:', e)
    res.status(500).json({ success: false, message: 'Error deleting actividad' })
  }
})

export { router as actividadesRoutes }
