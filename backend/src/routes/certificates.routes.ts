import { Router, Request, Response } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requireDomain } from '../middleware/domainAccess.js'
import { z } from 'zod'
import * as certificateService from '../services/certificateService.js'
import { logger } from '../config/logger.js'

const router = Router()

router.use(authMiddleware())

// fixes-jul17-2 §1.2: certificados domain — CONTRATOS has full access;
// GERONTOLOGA gets 403 (matrix false), null-EMPLEADO + ADMIN/AUDITOR/OPERADOR fall through.
router.use(requireDomain('certificados'))

const baseCertificateFields = {
  empresaId: z.number().int().positive().optional(),
  tipoCertificado: z.enum(['ALCALDIA', 'GOBERNACION', 'SECRETARIAS', 'TRIBUTARIOS', 'REGISTRO_MERCANTIL', 'OTRO']).optional(),
  // jul-10 E1: normalize entity name to upper-case + trim (applied to both create and update via .partial())
  nombre: z
    .string()
    .min(1)
    .max(200)
    .transform((v) => v.trim().toUpperCase())
    .optional(),
  descripcion: z.string().optional(),
  estado: z.enum(['VIGENTE', 'VENCIDO', 'PENDIENTE']).optional(),
  fechaEmision: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  archivoUrl: z.string().optional(),

  periodicidad: z.enum(['UNICA', 'MENSUAL', 'ANUAL']).optional(),
  periodo: z.string().optional(),
  comprobantePagoUrl: z.string().optional(),
  duplicateFromId: z.number().int().positive().optional(),
}

const createCertificateSchema = z
  .object(baseCertificateFields)
  .refine(
    (data) => Boolean(data.duplicateFromId) || (Boolean(data.tipoCertificado) && Boolean(data.nombre)),
    {
      message: 'duplicateFromId OR (tipoCertificado AND nombre) es requerido',
      path: ['tipoCertificado'],
    }
  )

const updateCertificateSchema = z.object(baseCertificateFields).partial()

// ----- Certificate Updates (history) -----

const addCertificateUpdateSchema = z.object({
  archivoUrl: z.string().min(1).max(500).optional(),
  // jul-9 A4: payment receipt URL alongside existing archivoUrl (L5 decision)
  comprobantePagoUrl: z.string().min(1).max(500).optional(),
  notas: z.string().optional(),
  fechaEmision: z.string().optional(),
  fechaVencimiento: z.string().optional(),
}).refine(
  (d) =>
    d.archivoUrl !== undefined ||
    d.comprobantePagoUrl !== undefined ||
    d.notas !== undefined ||
    d.fechaEmision !== undefined ||
    d.fechaVencimiento !== undefined,
  { message: 'At least one of archivoUrl, comprobantePagoUrl, notas, fechaEmision, fechaVencimiento is required', path: ['archivoUrl'] }
)

// GET /certificates/stats
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await certificateService.getCertificateStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    logger.error('Get certificate stats error:', error)
    res.status(500).json({ success: false, message: 'Error fetching certificate stats' })
  }
})

// GET /certificates
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const tipo = req.query.tipo as string | undefined
    const estado = req.query.estado as string | undefined

    const result = await certificateService.listCertificates({ page, limit, tipo, estado })
    res.json({ success: true, ...result })
  } catch (error) {
    logger.error('List certificates error:', error)
    res.status(500).json({ success: false, message: 'Error fetching certificates' })
  }
})

// GET /certificates/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid certificate ID' })
      return
    }
    const cert = await certificateService.getCertificate(id)
    if (!cert) {
      res.status(404).json({ success: false, message: 'Certificate not found' })
      return
    }
    res.json({ success: true, data: cert })
  } catch (error) {
    logger.error('Get certificate error:', error)
    res.status(500).json({ success: false, message: 'Error fetching certificate' })
  }
})

// POST /certificates — qa-sep-2 F1: GERONTOLOGA create-only (matrix) + ADMIN.
// CONTRATOS stays read-only → 403 DOMAIN_FORBIDDEN. PUT/DELETE remain ADMIN.
router.post('/', validate(createCertificateSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const cert = await certificateService.createCertificate(req.body, userId)
    res.status(201).json({ success: true, data: cert })
  } catch (error: any) {
    logger.error('Create certificate error:', error)
    if ((error as any)?.code === 'P2003') {
      res.status(400).json({ success: false, message: 'Empresa not found' })
      return
    }
    if (error?.message === 'No empresa found') {
      res.status(400).json({ success: false, message: 'No empresa configured' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating certificate' })
  }
})

// PUT /certificates/:id (admin only)
router.put('/:id', requireRole('ADMIN'), validate(updateCertificateSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid certificate ID' })
      return
    }
    const cert = await certificateService.updateCertificate(id, req.body)
    res.json({ success: true, data: cert })
  } catch (error: any) {
    logger.error('Update certificate error:', error)
    if (error.message === 'Certificate not found') {
      res.status(404).json({ success: false, message: 'Certificate not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating certificate' })
  }
})

// DELETE /certificates/:id (admin only)
router.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid certificate ID' })
      return
    }
    await certificateService.deleteCertificate(id)
    res.json({ success: true, message: 'Certificate deleted successfully' })
  } catch (error: any) {
    logger.error('Delete certificate error:', error)
    if (error.message === 'Certificate not found') {
      res.status(404).json({ success: false, message: 'Certificate not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error deleting certificate' })
  }
})

// POST /certificates/:id/updates — append history (file/comprobante/fechas).
// qa-sep-11: GERONTOLOGA create-only must attach the first update after POST /
// (prod 403 left empty certs). Matrix already allows POST; drop ADMIN-only.
// PUT/DELETE of the cert remain requireRole('ADMIN'). CONTRATOS is read-only.
router.post('/:id/updates', validate(addCertificateUpdateSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid certificate ID' })
      return
    }
    const userId = req.user!.id
    const result = await certificateService.addCertificateUpdate(id, req.body, userId)
    res.status(201).json({ success: true, data: result })
  } catch (error: any) {
    logger.error('Add certificate update error:', error)
    if (error.status === 404) {
      res.status(404).json({ success: false, message: error.message })
      return
    }
    res.status(500).json({ success: false, message: 'Error adding certificate update' })
  }
})

// GET /certificates/:id/updates — list update history (any authenticated user)
router.get('/:id/updates', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid certificate ID' })
      return
    }
    const updates = await certificateService.listCertificateUpdates(id)
    res.json({ success: true, data: updates })
  } catch (error: any) {
    logger.error('List certificate updates error:', error)
    if (error.status === 404) {
      res.status(404).json({ success: false, message: error.message })
      return
    }
    res.status(500).json({ success: false, message: 'Error fetching certificate updates' })
  }
})

export { router as certificateRoutes }
