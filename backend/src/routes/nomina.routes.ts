import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as nominaService from '../services/nominaService.js'
import { logger } from '../config/logger.js'

const router = Router()
router.use(authMiddleware())

const contratoSchema = z.object({
  tipoContrato: z.enum(['OPS', 'OBRA_O_LABOR', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO']),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  archivoUrl: z.string().optional(),
  activo: z.boolean().optional(),
})

const nominaPeriodoSchema = z.object({
  empleadoId: z.number().int().positive(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),  // YYYY-MM
  salario: z.number().nonnegative().optional(),
  notas: z.string().optional(),
  archivos: z
    .array(
      z.object({
        tipoArchivo: z.enum(['CUENTA_COBRO', 'INFORME_ACTIVIDADES', 'COMPROBANTE_APORTES', 'DESPRENDIBLE', 'OTRO']),
        nombre: z.string().min(1).max(200),
        url: z.string().min(1),
      }),
    )
    .optional(),
})

// ─── Contratos (nested under employees) ─────────────────────────────────────
router.get('/employees/:id/contratos', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const data = await nominaService.listContratos(id)
    res.json({ success: true, data })
  } catch (error) {
    logger.error('List contratos error:', error)
    res.status(500).json({ success: false, message: 'Error listing contratos' })
  }
})

router.post('/employees/:id/contratos', requireRole('ADMIN'), validate(contratoSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const created = await nominaService.createContrato(id, req.body)
    res.status(201).json({ success: true, data: created })
  } catch (e: any) {
    if (e?.status) { res.status(e.status).json({ success: false, message: e.message }); return }
    logger.error('Create contrato error:', e)
    res.status(500).json({ success: false, message: 'Error creating contrato' })
  }
})

router.put('/employees/:id/contratos/:cid', requireRole('ADMIN'), validate(contratoSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    const cid = parseInt(req.params.cid as string)
    if (isNaN(id) || isNaN(cid)) { res.status(400).json({ success: false, message: 'Invalid IDs' }); return }
    const updated = await nominaService.updateContrato(id, cid, req.body)
    res.json({ success: true, data: updated })
  } catch (e: any) {
    if (e?.status) { res.status(e.status).json({ success: false, message: e.message }); return }
    logger.error('Update contrato error:', e)
    res.status(500).json({ success: false, message: 'Error updating contrato' })
  }
})

router.delete('/employees/:id/contratos/:cid', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    const cid = parseInt(req.params.cid as string)
    if (isNaN(id) || isNaN(cid)) { res.status(400).json({ success: false, message: 'Invalid IDs' }); return }
    await nominaService.deleteContrato(id, cid)
    res.json({ success: true, message: 'Contrato eliminado' })
  } catch (e: any) {
    if (e?.status) { res.status(e.status).json({ success: false, message: e.message }); return }
    logger.error('Delete contrato error:', e)
    res.status(500).json({ success: false, message: 'Error deleting contrato' })
  }
})

// ─── Nomina period entries (top-level under /nomina) ────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const periodo = req.query.periodo as string | undefined
    if (!periodo) {
      res.status(400).json({ success: false, message: 'periodo (YYYY-MM) es requerido' })
      return
    }
    const tipoContrato = req.query.tipoContrato as string | undefined
    const data = await nominaService.getNominaMonth(periodo, tipoContrato)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) { res.status(e.status).json({ success: false, message: e.message }); return }
    logger.error('Get nomina month error:', e)
    res.status(500).json({ success: false, message: 'Error fetching nomina' })
  }
})

router.get('/periodos/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return }
    const data = await nominaService.getNominaPeriodo(id)
    if (!data) { res.status(404).json({ success: false, message: 'NominaPeriodo not found' }); return }
    res.json({ success: true, data })
  } catch (error) {
    logger.error('Get nomina periodo error:', error)
    res.status(500).json({ success: false, message: 'Error fetching nomina periodo' })
  }
})

router.post('/periodos', requireRole('ADMIN'), validate(nominaPeriodoSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const created = await nominaService.createNominaPeriodo(req.body, userId)
    res.status(201).json({ success: true, data: created })
  } catch (e: any) {
    if (e?.status) {
      const body: Record<string, unknown> = { success: false, message: e.message }
      if (e.field) body.field = e.field
      res.status(e.status).json(body)
      return
    }
    logger.error('Create nomina periodo error:', e)
    res.status(500).json({ success: false, message: 'Error creating nomina periodo' })
  }
})

router.put('/periodos/:id', requireRole('ADMIN'), validate(nominaPeriodoSchema.partial()), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return }
    const updated = await nominaService.updateNominaPeriodo(id, req.body)
    res.json({ success: true, data: updated })
  } catch (e: any) {
    if (e?.status) { res.status(e.status).json({ success: false, message: e.message }); return }
    logger.error('Update nomina periodo error:', e)
    res.status(500).json({ success: false, message: 'Error updating nomina periodo' })
  }
})

router.delete('/periodos/:id', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid id' }); return }
    await nominaService.deleteNominaPeriodo(id)
    res.json({ success: true, message: 'NominaPeriodo eliminado' })
  } catch (e: any) {
    if (e?.status) { res.status(e.status).json({ success: false, message: e.message }); return }
    logger.error('Delete nomina periodo error:', e)
    res.status(500).json({ success: false, message: 'Error deleting nomina periodo' })
  }
})

export { router as nominaRoutes }
