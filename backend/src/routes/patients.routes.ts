import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requireDomain } from '../middleware/domainAccess.js'
import { z } from 'zod'
import * as patientService from '../services/patientService.js'
import { logger } from '../config/logger.js'
import { getPrisma } from '../config/database.js'
import { isWithinLastBusinessDays } from '../utils/businessDays.js'

const router = Router()

// Apply auth to all routes
router.use(authMiddleware())

// QA jul-11 B1/B2: PrimeVue DatePicker v-models are Date objects that
// JSON-serialize to full ISO timestamps ("2026-08-04T05:00:00.000Z"), which
// the anchored YYYY-MM-DD regexes rejected with an invisible 400. Normalize
// any ISO-like string down to its date part before validating.
const dateYMD = z.preprocess(
  (v) => (typeof v === 'string' && v.length > 10 ? v.slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
)

// Zod schemas for validation
const createPatientSchema = z.object({
  // jul-10 E1: normalize to upper-case + trim (descripcion/notas preserved as-is per user spec)
  nombre: z.string().min(1).max(100).transform((v) => v.trim().toUpperCase()),
  tipoDocumento: z.enum(['CC', 'CE', 'PASAPORTE', 'REGISTRO_CIVIL']),
  numeroDocumento: z.string().min(1).max(50),
  fechaNacimiento: dateYMD,
  genero: z.string().min(1).max(20),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  notas: z.string().optional(),
  informacionSeguro: z.string().optional(),
  observacionesEspeciales: z.string().optional(),
  // jul-9 B3/B4/B5
  fechaCumpleanos: dateYMD.optional(),
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

// jul-10 C1 (legacy) → W4 §4.3 (evolved): single-step ficha create (atomic assign + first update).
// Presence of `respuestas` flips the path from the legacy PENDIENTE flow to a single
// Prisma `$transaction` that ends with estado=COMPLETADO and the scoring fields
// (respuestas, subtotales, puntajeTotal, clasificacion) populated by the scoring
// engine.
//
// `instrumentoVersionId` is optional — defaults to the currently active version
// (looked up by the service layer).
//
// `versionRegistro` is OPTIONAL (G2-12, 2026-07-17): clients SHOULD omit it. The
// service layer server-derives it from the resolved active version as `v{version}`
// (e.g., `"v1"`). Clients that send it are honored (backward compat).
//
// The legacy `archivoCompletado` field is REMOVED in W4 — file-flow is gone.
const createFichaSchema = z.object({
  instrumentoId: z.number().int().positive(),
  instrumentoVersionId: z.number().int().positive().optional(),
  versionRegistro: z.string().min(1).max(20).optional(),
  respuestas: z.record(z.string(), z.any()).optional(),
  notasObservaciones: z.string().optional(),
  fechaVencimiento: dateYMD.optional(),
})

// W4 §4.3b: PATCH /patients/:id/fichas/:fichaId/completar
const completarFichaSchema = z.object({
  respuestas: z.record(z.string(), z.any()),
  notasObservaciones: z.string().optional(),
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

function patientActorFromRequest(req: Request): patientService.PatientActor {
  // authMiddleware guarantees req.user; requireDomain('pacientes') enriches
  // EMPLEADO callers with tipoEmpleado before the route handler runs.
  const user = req.user! as typeof req.user & { tipoEmpleado?: string | null }
  return {
    userId: user.id,
    rol: user.rol,
    tipoEmpleado: user.tipoEmpleado ?? null,
  }
}

// jul-9 B1: fechaIncidente is REQUIRED and must satisfy L3 2-business-day rule
const createNoteSchema = z.object({
  tipo: z.enum(['POSITIVA', 'NEGATIVA', 'NEUTRAL', 'ALERTA']),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']),
  contenido: z.string().min(1),
  fechaIncidente: dateYMD,
})

// PATCH /patients/:id/fichas/:fichaId/status — body shape.
// W4: archivoCompletado removed (file flow gone). To complete a PENDIENTE ficha
// with answers, use PATCH /:id/fichas/:fichaId/completar (§4.3b) instead.
const updateFichaStatusSchema = z.object({
  estado: z.enum(['PENDIENTE', 'COMPLETADO', 'VENCIDO']),
  notasObservaciones: z.string().optional(),
  fechaVencimiento: z.string().optional(),
})

// GET /patients - list with pagination/search/filter
// fixes-jul17-2 §1.2: pacientes domain. CONTRATOS create-only → GET allowed.
router.get('/', requireDomain('pacientes'), async (req: Request, res: Response): Promise<void> => {
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
// fixes-jul17-2 §1.2: fichas domain — CONTRATOS denied (matrix false).
router.get('/fichas/vencimientos', requireDomain('fichas'), validate(vencimientosQuerySchema, 'query'), async (req: Request, res: Response): Promise<void> => {
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
// fixes-jul17-2 §1.2: pacientes domain.
router.get('/:id', requireDomain('pacientes'), async (req: Request, res: Response): Promise<void> => {
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
// fixes-jul17-2 §1.2: pacientes domain. CONTRATOS create-only → POST allowed.
router.post('/', requireDomain('pacientes'), validate(createPatientSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patient = await patientService.createPatient(
      req.body,
      patientActorFromRequest(req),
    )
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
// fixes-jul17-2 §1.2: pacientes domain. CONTRATOS create-only → PUT 403.
router.put('/:id', requireDomain('pacientes'), validate(updatePatientSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' })
      return
    }
    const patient = await patientService.updatePatient(
      id,
      req.body,
      patientActorFromRequest(req),
    )
    res.json({ success: true, data: patient })
  } catch (error: any) {
    if (error instanceof patientService.PatientStateForbiddenError) {
      res.status(403).json({
        success: false,
        message: error.message,
        code: error.code,
      })
      return
    }
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
// fixes-jul17-2 §1.2: pacientes domain. CONTRATOS create-only → DELETE 403.
router.delete('/:id', requireDomain('pacientes'), async (req: Request, res: Response): Promise<void> => {
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
// fixes-jul17-2 §1.2: notas domain — only GERONTOLOGA / null-EMPLEADO have access.
router.post('/:id/notes', requireDomain('notas'), validate(createNoteSchema), async (req: Request, res: Response): Promise<void> => {
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

// POST /patients/:id/fichas — W4 §4.3 (evolved).
// `respuestas` absent → legacy PENDIENTE assign.
// `respuestas` present → validate + score + persist as COMPLETADO.
// fixes-jul17-2 §1.2: fichas domain — CONTRATOS denied (matrix false).
router.post('/:id/fichas', requireDomain('fichas'), validate(createFichaSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id as string)
    if (isNaN(patientId)) { res.status(400).json({ success: false, message: 'Invalid patient ID' }); return }

    const prisma = getPrisma()
    const patient = await prisma.cliente.findUnique({ where: { id: patientId } })
    if (!patient) { res.status(404).json({ success: false, message: 'Patient not found' }); return }

    const ficha = await patientService.createFichaAtomic(patientId, req.user!.id, req.body)
    res.status(201).json({ success: true, data: ficha })
  } catch (error: any) {
    logger.error('Create patient ficha error:', error)
    if (error instanceof patientService.InstrumentScoringError) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
        field: error.field,
      })
      return
    }
    if (error.code === 'P2003') {
      res.status(404).json({ success: false, message: 'Instrument not found' })
      return
    }
    if (error.message === 'Patient not found') {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    if (error.message === 'Instrument not found') {
      res.status(404).json({ success: false, message: 'Instrument not found' })
      return
    }
    if (error.message === 'NO_ACTIVE_VERSION') {
      res.status(404).json({
        success: false,
        message: 'El instrumento no tiene una versión activa',
        code: 'NO_ACTIVE_VERSION',
      })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating ficha' })
  }
})

// W4 §4.4: GET /patients/:id/fichas/:fichaId — full detail incl. respuestas/scoring/version
// fixes-jul17-2 §1.2: fichas domain.
router.get('/:id/fichas/:fichaId', requireDomain('fichas'), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id as string)
    const fichaId = parseInt(req.params.fichaId as string)
    if (isNaN(patientId) || isNaN(fichaId)) {
      res.status(400).json({ success: false, message: 'Invalid IDs' })
      return
    }

    const ficha = await patientService.getFicha(patientId, fichaId)
    if (!ficha) {
      res.status(404).json({ success: false, message: 'Ficha not found' })
      return
    }
    res.json({ success: true, data: ficha })
  } catch (error) {
    logger.error('Get patient ficha error:', error)
    res.status(500).json({ success: false, message: 'Error fetching ficha' })
  }
})

// W4 §4.3b: PATCH /patients/:id/fichas/:fichaId/completar
// Completes a PENDIENTE or VENCIDO ficha with answers. Returns 400 INVALID_STATE if already COMPLETADO.
// fixes-jul17-2 §1.2: fichas domain — CONTRATOS denied.
router.patch('/:id/fichas/:fichaId/completar', requireDomain('fichas'), validate(completarFichaSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id as string)
    const fichaId = parseInt(req.params.fichaId as string)
    if (isNaN(patientId) || isNaN(fichaId)) {
      res.status(400).json({ success: false, message: 'Invalid IDs' })
      return
    }

    const ficha = await patientService.completeFichaAtomic(patientId, fichaId, req.body)
    res.json({ success: true, data: ficha })
  } catch (error: any) {
    logger.error('Complete patient ficha error:', error)
    if (error instanceof patientService.InstrumentScoringError) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
        field: error.field,
      })
      return
    }
    if (error instanceof patientService.InvalidStateError) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      })
      return
    }
    if (error.message === 'Ficha not found') {
      res.status(404).json({ success: false, message: 'Ficha not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error completing ficha' })
  }
})

// DELETE /patients/:id/fichas/:fichaId — remove assignment (only if PENDIENTE)
// fixes-jul17-2 §1.2: fichas domain.
router.delete('/:id/fichas/:fichaId', requireDomain('fichas'), async (req: Request, res: Response): Promise<void> => {
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

// PATCH /patients/:id/fichas/:fichaId/status — update status with transition validation.
// W4: archivoCompletado removed from this path. Use PATCH .../completar (§4.3b)
// to complete a ficha with answers.
// fixes-jul17-2 §1.2: fichas domain — CONTRATOS denied.
router.patch('/:id/fichas/:fichaId/status', requireDomain('fichas'), validate(updateFichaStatusSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id as string)
    const fichaId = parseInt(req.params.fichaId as string)
    if (isNaN(patientId) || isNaN(fichaId)) {
      res.status(400).json({ success: false, message: 'Invalid IDs' })
      return
    }

    const { estado, notasObservaciones, fechaVencimiento } = req.body as {
      estado: string
      notasObservaciones?: string
      fechaVencimiento?: string
    }

    const prisma = getPrisma()

    const ficha = await prisma.registroFichaCompletada.findFirst({
      where: { id: fichaId, clienteId: patientId },
    })
    if (!ficha) { res.status(404).json({ success: false, message: 'Ficha not found' }); return }

    // Validate transition. Per D3 — VENCIDO → COMPLETADO is allowed (admin override).
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

    const updateData: any = {
      estado,
      ...(estado === 'COMPLETADO' && { fechaCompletado: new Date() }),
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
