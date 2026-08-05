import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requireDomain } from '../middleware/domainAccess.js'
import * as asistenciaService from '../services/asistenciaService.js'
import { logger } from '../config/logger.js'

const router = Router()
router.use(authMiddleware())
// nomina-asistencia-jul-18: domain key `asistencia` (matrix mirrors empleados)
router.use(requireDomain('asistencia'))

const putDiaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z
    .array(
      z.object({
        empleadoId: z.number().int().positive(),
        jornadaAm: z.boolean(),
        jornadaPm: z.boolean(),
        // qa-session-jul-24 §5: "notas" — 500-char justification text.
        // Required only when both false (non-attendance); Zod stays optional
        // here, the UI/server surface the requirement upstream.
        notas: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1),
})

/**
 * qa-session-jul-24 §5.1: server-side "today" in America/Bogota.
 * Uses Intl.DateTimeFormat with locale en-CA (only stable locale that emits
 * ISO date as YYYY-MM-DD). The result is a string — compare as strings only;
 * do not parse to Date and back, to avoid TZ drift across runtimes.
 */
export function serverTodayBogota(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

// GET /asistencia?fecha=YYYY-MM-DD
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const fecha = req.query.fecha as string | undefined
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      res.status(400).json({
        success: false,
        message: 'fecha (YYYY-MM-DD) es requerido',
        field: 'fecha',
      })
      return
    }
    const data = await asistenciaService.getAsistenciaDia(fecha)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('Get asistencia dia error:', e)
    res.status(500).json({ success: false, message: 'Error fetching asistencia' })
  }
})

// PUT /asistencia/dia
router.put('/dia', validate(putDiaSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    // qa-session-jul-24 §5: ADMIN bypass; CONTRATOS may only save for `today` (server-local BOGOTA).
    const user = req.user as any
    const rol = user?.rol
    const tipoEmpleado = user?.tipoEmpleado ?? null
    const isContratos = rol === 'EMPLEADO' && tipoEmpleado === 'CONTRATOS'
    if (isContratos) {
      const today = serverTodayBogota()
      if (req.body.fecha !== today) {
        res.status(403).json({
          success: false,
          message: 'CONTRATOS only puede registrar asistencia del día actual',
          field: 'fecha',
        })
        return
      }
    }
    const userId = req.user!.id
    const data = await asistenciaService.putAsistenciaDia(req.body, userId)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      const body: Record<string, unknown> = { success: false, message: e.message }
      if (e.field) body.field = e.field
      res.status(e.status).json(body)
      return
    }
    logger.error('Put asistencia dia error:', e)
    res.status(500).json({ success: false, message: 'Error saving asistencia' })
  }
})

// GET /asistencia/resumen?periodo=YYYY-MM&empleadoId?
router.get('/resumen', async (req: Request, res: Response): Promise<void> => {
  try {
    const periodo = req.query.periodo as string | undefined
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      res.status(400).json({
        success: false,
        message: 'periodo (YYYY-MM) es requerido',
        field: 'periodo',
      })
      return
    }
    const empleadoIdRaw = req.query.empleadoId as string | undefined
    const empleadoId = empleadoIdRaw ? parseInt(empleadoIdRaw, 10) : undefined
    const data = await asistenciaService.getAsistenciaResumen(periodo, empleadoId)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('Get asistencia resumen error:', e)
    res.status(500).json({ success: false, message: 'Error fetching resumen' })
  }
})

export { router as asistenciaRoutes }
