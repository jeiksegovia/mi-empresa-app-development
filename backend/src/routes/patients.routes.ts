import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { z } from 'zod'
import * as patientService from '../services/patientService.js'
import { logger } from '../config/logger.js'
import { getPrisma } from '../config/database.js'
import { isWithinLastBusinessDays } from '../utils/businessDays.js'

const router = Router()

// Apply auth to all routes
router.use(authMiddleware())

// Zod schemas for validation
const createPatientSchema = z.object({
  // jul-10 E1: normalize to upper-case + trim (descripcion/notas preserved as-is per user spec)
  nombre: z.string().min(1).max(100).transform((v) => v.trim().toUpperCase()),
  tipoDocumento: z.enum(['CC', 'CE', 'PASAPORTE', 'REGISTRO_CIVIL']),
  numeroDocumento: z.string().min(1).max(50),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  genero: z.string().min(1).max(20),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  notas: z.string().optional(),
  informacionSeguro: z.string().optional(),
  observacionesEspeciales: z.string().optional(),
  // jul-9 B3/B4/B5
  fechaCumpleanos: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tipoSangre: z.enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG']).optional(),
  eps: z.string().max(200).optional(),
  contactosEmergencia: z
    .array(
      z.object({
        nombre: z.string().min(1),
        telefono: z.string().min(1),
        parentesco: z.string().min(1),
      }),
    )
    .optional(),
})

// jul-10 C1: single-step ficha create (atomic assign + first update).
// Presence of `archivoCompletado` flips the path from the legacy PENDIENTE
// flow to a single Prisma `$transaction` that ends with estado=COMPLETADO.
const createFichaSchema = z.object({
  instrumentoId: z.number().int().positive(),
  versionRegistro: z.string().min(1).max(20),
  archivoCompletado: z.string().min(1).optional(),
  notasObservaciones: z.string().optional(),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// jul-10 C7: weekly vencimientos report query
const vencimientosQuerySchema = z.object({
  days: z
    .preprocess((v) => (v === undefined ? 7 : Number(v)), z.number().int().min(1).max(365))
    .default(7),
})

const updatePatientSchema = createPatientSchema
  .partial()
  .omit({ contactosEmergencia: true })

// jul-9 B1: fechaIncidente is REQUIRED and must satisfy L3 2-business-day rule
const createNoteSchema = z.object({
  tipo: z.enum(['POSITIVA', 'NEGATIVA', 'NEUTRAL', 'ALERTA']),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']),
  contenido: z.string().min(1),
  fechaIncidente: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaIncidente must be YYYY-MM-DD'),
})

// PATCH /patients/:id/fichas/:fichaId/status — body shape
const updateFichaStatusSchema = z.object({
  estado: z.enum(['PENDIENTE', 'COMPLETADO', 'VENCIDO']),
  archivoCompletado: z.string().min(1).optional(),
  notasObservaciones: z.string().optional(),
  fechaVencimiento: z.string().optional(),
})

// GET /patients - list with pagination/search/filter
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const search = req.query.search as string | undefined
    const estado = req.query.estado as 'ACTIVO' | 'INACTIVO' | undefined

    const result = await patientService.listPatients({ page, limit, search, estado })
    res.json({ success: true, ...result })
  } catch (error) {
    logger.error('List patients error:', error)
    res.status(500).json({ success: false, message: 'Error fetching patients' })
  }
})

// jul-10 C7: GET /patients/fichas/vencimientos?days=N — weekly vencimientos report.
// Placed BEFORE /:id only for readability; :id can't capture this path anyway
// (two segments), but ordering keeps the report-route adjacent to the fichas tree.
router.get('/fichas/vencimientos', validate(vencimientosQuerySchema, 'query'), async (req: Request, res: Response): Promise<void> => {
  try {
    // validate() has already coerced `days` to a number via Zod preprocess.
    const { days } = req.query as unknown as { days: number }
    const result = await patientService.listFichasVencimientos(days)
    res.json({ success: true, ...result })
  } catch (error) {
    logger.error('List vencimientos error:', error)
    res.status(500).json({ success: false, message: 'Error listing vencimientos' })
  }
})

// GET /patients/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' })
      return
    }
    const patient = await patientService.getPatient(id)
    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    res.json({ success: true, data: patient })
  } catch (error) {
    logger.error('Get patient error:', error)
    res.status(500).json({ success: false, message: 'Error fetching patient' })
  }
})

// POST /patients
router.post('/', validate(createPatientSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patient = await patientService.createPatient(req.body)
    res.status(201).json({ success: true, data: patient })
  } catch (error: any) {
    logger.error('Create patient error:', error)
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Número de documento ya registrado' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating patient' })
  }
})

// PUT /patients/:id
router.put('/:id', validate(updatePatientSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' })
      return
    }
    const patient = await patientService.updatePatient(id, req.body)
    res.json({ success: true, data: patient })
  } catch (error: any) {
    logger.error('Update patient error:', error)
    if (error.message === 'Patient not found') {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Número de documento ya registrado' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating patient' })
  }
})

// DELETE /patients/:id (soft delete)
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' })
      return
    }
    await patientService.deletePatient(id)
    res.json({ success: true, message: 'Patient deactivated successfully' })
  } catch (error: any) {
    logger.error('Delete patient error:', error)
    if (error.message === 'Patient not found') {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error deleting patient' })
  }
})

// POST /patients/:id/notes - Create note for patient
router.post('/:id/notes', validate(createNoteSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id as string)
    if (isNaN(patientId)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' })
      return
    }

    // jul-9 B2 + L3 hard block: fechaIncidente must be within the last 2 business days
    // Use the route-level helper so the date-string is interpreted as a local
    // calendar date (NOT UTC midnight).
    if (!isWithinLastBusinessDays(req.body.fechaIncidente, new Date(), 2)) {
      res.status(400).json({
        success: false,
        message: 'La fecha del incidente debe estar dentro de los últimos 2 días hábiles',
        field: 'fechaIncidente',
      })
      return
    }

    const userId = req.user!.id

    const note = await patientService.createNote(patientId, userId, req.body)
    res.status(201).json({ success: true, data: note })
  } catch (error: any) {
    logger.error('Create note error:', error)
    if (error.message === 'Patient not found') {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating note' })
  }
})

// POST /patients/:id/fichas — assign instrument (legacy PENDIENTE) OR
// jul-10 C1 single-step (atomic create+complete when archivoCompletado is present)
router.post('/:id/fichas', validate(createFichaSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id as string)
    if (isNaN(patientId)) { res.status(400).json({ success: false, message: 'Invalid patient ID' }); return }

    const prisma = getPrisma()
    // Verify patient exists
    const patient = await prisma.cliente.findUnique({ where: { id: patientId } })
    if (!patient) { res.status(404).json({ success: false, message: 'Patient not found' }); return }

    const ficha = await patientService.createFichaAtomic(patientId, req.user!.id, req.body)
    res.status(201).json({ success: true, data: ficha })
  } catch (error: any) {
    logger.error('Create patient ficha error:', error)
    if (error.code === 'P2003') {
      // FK violation — instrumentoId not found
      res.status(404).json({ success: false, message: 'Instrument not found' })
      return
    }
    if (error.message === 'Patient not found') {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating ficha' })
  }
})

// DELETE /patients/:id/fichas/:fichaId — remove assignment (only if PENDIENTE)
router.delete('/:id/fichas/:fichaId', async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id as string)
    const fichaId = parseInt(req.params.fichaId as string)
    if (isNaN(patientId) || isNaN(fichaId)) {
      res.status(400).json({ success: false, message: 'Invalid IDs' })
      return
    }

    const prisma = getPrisma()

    const ficha = await prisma.registroFichaCompletada.findFirst({
      where: { id: fichaId, clienteId: patientId },
    })
    if (!ficha) { res.status(404).json({ success: false, message: 'Ficha not found' }); return }
    if (ficha.estado !== 'PENDIENTE') {
      res.status(400).json({ success: false, message: 'Solo se pueden eliminar fichas en estado PENDIENTE' })
      return
    }

    await prisma.registroFichaCompletada.delete({ where: { id: fichaId } })
    res.json({ success: true, message: 'Ficha removed successfully' })
  } catch (error: any) {
    logger.error('Delete patient ficha error:', error)
    res.status(500).json({ success: false, message: 'Error deleting ficha' })
  }
})

// PATCH /patients/:id/fichas/:fichaId/status — update status with transition validation
router.patch('/:id/fichas/:fichaId/status', validate(updateFichaStatusSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id as string)
    const fichaId = parseInt(req.params.fichaId as string)
    if (isNaN(patientId) || isNaN(fichaId)) {
      res.status(400).json({ success: false, message: 'Invalid IDs' })
      return
    }

    const { estado, archivoCompletado, notasObservaciones, fechaVencimiento } = req.body as {
      estado: string
      archivoCompletado?: string
      notasObservaciones?: string
      fechaVencimiento?: string
    }

    const prisma = getPrisma()

    const ficha = await prisma.registroFichaCompletada.findFirst({
      where: { id: fichaId, clienteId: patientId },
    })
    if (!ficha) { res.status(404).json({ success: false, message: 'Ficha not found' }); return }

    // Validate transition. Per D3 — VENCIDO → COMPLETADO is allowed (admin override).
    // VENCIDO is reached automatically by cron-style expiration, and the user
    // can upload the late file and mark it complete.
    const validTransitions: Record<string, string[]> = {
      PENDIENTE: ['COMPLETADO', 'VENCIDO'],
      COMPLETADO: ['VENCIDO'],
      VENCIDO: ['COMPLETADO'],
    }
    const allowed = validTransitions[ficha.estado] ?? []
    if (!allowed.includes(estado)) {
      res.status(400).json({ success: false, message: `Cannot transition from ${ficha.estado} to ${estado}` })
      return
    }

    // COMPLETADO requires archivoCompletado in the payload
    if (estado === 'COMPLETADO' && !archivoCompletado) {
      res.status(400).json({ success: false, message: 'archivoCompletado is required when transitioning to COMPLETADO' })
      return
    }

    const updateData: any = {
      estado,
      ...(estado === 'COMPLETADO' && { fechaCompletado: new Date() }),
      ...(archivoCompletado && { archivoCompletado }),
      ...(notasObservaciones && { notasObservaciones }),
      ...(fechaVencimiento && { fechaVencimiento: new Date(fechaVencimiento) }),
    }

    const updated = await prisma.registroFichaCompletada.update({
      where: { id: fichaId },
      data: updateData,
      include: {
        instrumento: { select: { id: true, nombreInstrumento: true, tipo: true } },
      },
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    logger.error('Update patient ficha status error:', error)
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: 'Validation failed', errors: error.errors })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating ficha status' })
  }
})

export { router as patientRoutes }
