import { Router, Request, Response } from 'express'
import { authMiddleware, requireInstrumentWriter } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requireDomain } from '../middleware/domainAccess.js'
import { z } from 'zod'
import * as instrumentService from '../services/instrumentService.js'
import { logger } from '../config/logger.js'
import { getPrisma } from '../config/database.js'

const router = Router()

router.use(authMiddleware())

// --- Schemas ---

// QA jul-11 I2: roles now mirror the per-empresa CargoEmpresa catalog (plus
// ADMIN), so they are free-form names, no longer the RolUsuario enum. This
// column is descriptive only — access gating (requireInstrumentWriter) never
// reads it. Validation: non-empty comma-separated items, each ≤100 chars,
// total ≤255 (DB VarChar(255)).
function refineRolesPermitidos(val: unknown): val is string {
  if (typeof val !== 'string' || val.length === 0 || val.length > 255) return false
  const parts = val.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.length > 0 && parts.every((p) => p.length <= 100)
}

const baseInstrumentFields = {
  // jul-10 E1: normalize to upper-case + trim
  nombreInstrumento: z.string().min(1).max(200).transform((v) => v.trim().toUpperCase()),
  codigo: z.string().max(50).optional(),
  descripcion: z.string().optional(),
  tipo: z.enum(['VALORACION', 'NUTRICION', 'MATRICULA', 'ADMISION']),
  periodicidad: z.enum(['UNICA', 'ANUAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL']),
  rolesPermitidos: z.string().min(1).refine(refineRolesPermitidos, {
    message: 'rolesPermitidos must be a non-empty comma-separated list of role/cargo names (each ≤100 chars, total ≤255)',
  }),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
}

// fixes-jul17-2 §3.1 — the 6 dynamic templates the W2 seed writes. Their
// definitions live in prisma/instrument-templates/{codigo}.v1.json.
const TEMPLATE_CODIGOS = ['BARTHEL', 'MINI_MENTAL', 'TINETTI', 'YESAVAGE', 'MNA_CUADRO', 'FICHA_NUTRICIONAL'] as const

const createInstrumentSchema = z.object({
  ...baseInstrumentFields,
  // Optional: when present, the service deep-copies the named template's
  // active v1 definition into the new instrumento (and creates an active
  // InstrumentoVersion v1). Without it, legacy metadata-only creation is
  // preserved (the instrument is "sin definición" until a definition is
  // uploaded through the editor flow).
  templateCodigo: z.enum(TEMPLATE_CODIGOS).optional(),
})

const updateInstrumentSchema = z.object({
  // jul-10 E1: normalize to upper-case + trim
  nombreInstrumento: z.string().min(1).max(200).transform((v) => v.trim().toUpperCase()).optional(),
  codigo: z.string().max(50).optional(),
  descripcion: z.string().optional(),
  tipo: z.enum(['VALORACION', 'NUTRICION', 'MATRICULA', 'ADMISION']).optional(),
  periodicidad: z.enum(['UNICA', 'ANUAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL']).optional(),
  rolesPermitidos: z
    .string()
    .min(1)
    .refine(refineRolesPermitidos, {
      message: 'rolesPermitidos must be a non-empty comma-separated list of role/cargo names (each ≤100 chars, total ≤255)',
    })
    .optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
})

const createRecordSchema = z.object({
  clienteId: z.number().int().positive(),
  instrumentoId: z.number().int().positive(),
  estado: z.enum(['COMPLETADO', 'PENDIENTE', 'VENCIDO']).optional(),
  fechaCompletado: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  versionRegistro: z.string().min(1).max(20),
  responsable: z.number().int().positive(),
  notasObservaciones: z.string().optional(),
})

const updateRecordSchema = z.object({
  estado: z.enum(['COMPLETADO', 'PENDIENTE', 'VENCIDO']).optional(),
  fechaCompletado: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  versionRegistro: z.string().max(20).optional(),
  responsable: z.number().int().positive().optional(),
  notasObservaciones: z.string().optional(),
})

// --- Instrument Routes ---

// GET /instruments
// fixes-jul17-2 §1.2: instrumentos domain — CONTRATOS denied.
router.get('/', requireDomain('instrumentos'), async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const search = req.query.search as string | undefined
    const tipo = req.query.tipo as string | undefined
    const estado = req.query.estado as 'ACTIVO' | 'INACTIVO' | undefined

    const result = await instrumentService.listInstruments({ page, limit, search, tipo, estado })
    res.json({ success: true, ...result })
  } catch (error) {
    logger.error('List instruments error:', error)
    res.status(500).json({ success: false, message: 'Error fetching instruments' })
  }
})

// GET /instruments/records/by-instrument/:instrumentId
// Must come before /:id to avoid conflict
// fixes-jul17-2 §1.2: fichas domain (records are part of fichas per §1.2 table).
router.get('/records/by-instrument/:instrumentId', requireDomain('fichas'), async (req: Request, res: Response): Promise<void> => {
  try {
    const instrumentId = parseInt(req.params.instrumentId as string)
    if (isNaN(instrumentId)) {
      res.status(400).json({ success: false, message: 'Invalid instrument ID' })
      return
    }
    const records = await instrumentService.listRecordsByInstrument(instrumentId)
    res.json({ success: true, data: records })
  } catch (error) {
    logger.error('List records by instrument error:', error)
    res.status(500).json({ success: false, message: 'Error fetching records' })
  }
})

// GET /instruments/:id
// fixes-jul17-2 §1.2: instrumentos domain.
router.get('/:id', requireDomain('instrumentos'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid instrument ID' })
      return
    }
    const instrument = await instrumentService.getInstrument(id)
    if (!instrument) {
      res.status(404).json({ success: false, message: 'Instrument not found' })
      return
    }
    res.json({ success: true, data: instrument })
  } catch (error) {
    logger.error('Get instrument error:', error)
    res.status(500).json({ success: false, message: 'Error fetching instrument' })
  }
})

// W4 §4.2: GET /instruments/:codigo/definition — returns the active version + full definition.
// IMPORTANT: this must come BEFORE the catch-all /:codigo pattern. It uses the
// string codigo (e.g., "BARTHEL") rather than the numeric id, so it cannot
// collide with /:id because :id is parsed as integer — non-numeric params
// fall through to this route.
// fixes-jul17-2 §1.2: fichas domain (read access for ficha rendering).
router.get('/:codigo/definition', requireDomain('fichas'), async (req: Request, res: Response): Promise<void> => {
  try {
    const codigo = (req.params.codigo as string).trim().toUpperCase()
    if (!codigo) {
      res.status(400).json({ success: false, message: 'codigo is required' })
      return
    }
    // The JWT payload has `rol` but not `tipoEmpleado` — look up the Usuario
    // row to build a CSV the service can intersect with `rolesPermitidos`.
    const prisma = getPrisma()
    const usuario = req.user?.id
      ? await prisma.usuario.findUnique({
          where: { id: req.user.id },
          select: { rol: true, tipoEmpleado: true },
        })
      : null
    const callerRolesCsv = usuario
      ? [usuario.rol, usuario.tipoEmpleado].filter(Boolean).join(',')
      : null
    const result = await instrumentService.getInstrumentDefinition(codigo, callerRolesCsv)
    res.json({ success: true, data: result })
  } catch (error: any) {
    if (error instanceof instrumentService.InstrumentDefinitionError) {
      const status = error.code === 'INSTRUMENT_NOT_FOUND' || error.code === 'NO_ACTIVE_VERSION' ? 404 : 403
      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code,
      })
      return
    }
    logger.error('Get instrument definition error:', error)
    res.status(500).json({ success: false, message: 'Error fetching instrument definition' })
  }
})

// POST /instruments — jul-10 C6 gated: ADMIN OR EMPLEADO+GERONTOLOGA
// fixes-jul17-2 §1.2: instrumentos domain (CONTRATOS denied).
// fixes-jul17-2 §3.1: optional templateCodigo deep-copies the named template.
router.post('/', requireDomain('instrumentos'), requireInstrumentWriter(), validate(createInstrumentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const instrument = await instrumentService.createInstrument(req.body, userId)
    res.status(201).json({ success: true, data: instrument })
  } catch (error: any) {
    logger.error('Create instrument error:', error)
    if (error instanceof instrumentService.CreateInstrumentError) {
      // TEMPLATE_NOT_FOUND / NO_ACTIVE_VERSION → 404
      res.status(404).json({
        success: false,
        message: error.message,
        code: error.code,
      })
      return
    }
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Instrument with this code already exists' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating instrument' })
  }
})

// PUT /instruments/:id — jul-10 C6 gated: ADMIN OR EMPLEADO+GERONTOLOGA
// fixes-jul17-2 §1.2: instrumentos domain (CONTRATOS denied).
router.put('/:id', requireDomain('instrumentos'), requireInstrumentWriter(), validate(updateInstrumentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid instrument ID' })
      return
    }
    const userId = req.user!.id
    const instrument = await instrumentService.updateInstrument(id, req.body, userId)
    res.json({ success: true, data: instrument })
  } catch (error: any) {
    logger.error('Update instrument error:', error)
    if (error.message === 'Instrument not found') {
      res.status(404).json({ success: false, message: 'Instrument not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating instrument' })
  }
})

// DELETE /instruments/:id (soft delete → INACTIVO) — jul-10 C6 gated
// fixes-jul17-2 §1.2: instrumentos domain (CONTRATOS denied).
router.delete('/:id', requireDomain('instrumentos'), requireInstrumentWriter(), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid instrument ID' })
      return
    }
    await instrumentService.deleteInstrument(id)
    res.json({ success: true, message: 'Instrument deactivated successfully' })
  } catch (error: any) {
    logger.error('Delete instrument error:', error)
    if (error.message === 'Instrument not found') {
      res.status(404).json({ success: false, message: 'Instrument not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error deleting instrument' })
  }
})

// --- Record Routes ---

// POST /instruments/records
// fixes-jul17-2 §1.2: fichas domain (records are part of fichas per §1.2 table).
router.post('/records', requireDomain('fichas'), validate(createRecordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const record = await instrumentService.createRecord(req.body)
    res.status(201).json({ success: true, data: record })
  } catch (error: any) {
    logger.error('Create record error:', error)
    if (error.message === 'Instrument not found') {
      res.status(404).json({ success: false, message: 'Instrument not found' })
      return
    }
    if (error.message === 'Patient not found') {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating record' })
  }
})

// PUT /instruments/records/:id
// fixes-jul17-2 §1.2: fichas domain.
router.put('/records/:id', requireDomain('fichas'), validate(updateRecordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid record ID' })
      return
    }
    const record = await instrumentService.updateRecord(id, req.body)
    res.json({ success: true, data: record })
  } catch (error: any) {
    logger.error('Update record error:', error)
    if (error.message === 'Record not found') {
      res.status(404).json({ success: false, message: 'Record not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating record' })
  }
})

export { router as instrumentRoutes }
