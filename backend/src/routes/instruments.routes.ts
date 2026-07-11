import { Router, Request, Response } from 'express'
import { authMiddleware, requireInstrumentWriter } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { z } from 'zod'
import * as instrumentService from '../services/instrumentService.js'
import { logger } from '../config/logger.js'

const router = Router()

router.use(authMiddleware())

// --- Schemas ---

// Mirrors the RolUsuario enum from schema.prisma verbatim.
// Update both together. Allowed values: ADMIN, EMPLEADO, AUDITOR, OPERADOR.
const ROL_USUARIO_VALUES = ['ADMIN', 'EMPLEADO', 'AUDITOR', 'OPERADOR'] as const

function refineRolesPermitidos(val: unknown): val is string {
  if (typeof val !== 'string' || val.length === 0) return false
  const parts = val.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.every((p) => (ROL_USUARIO_VALUES as readonly string[]).includes(p))
}

const baseInstrumentFields = {
  // jul-10 E1: normalize to upper-case + trim
  nombreInstrumento: z.string().min(1).max(200).transform((v) => v.trim().toUpperCase()),
  codigo: z.string().max(50).optional(),
  descripcion: z.string().optional(),
  tipo: z.enum(['VALORACION', 'NUTRICION', 'MATRICULA', 'ADMISION']),
  periodicidad: z.enum(['UNICA', 'ANUAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL']),
  rolesPermitidos: z.string().min(1).refine(refineRolesPermitidos, {
    message: 'rolesPermitidos must be a comma-separated list of valid RolUsuario values (ADMIN, EMPLEADO, AUDITOR, OPERADOR)',
  }),
  plantillaArchivo: z.string().optional(),
  versionPlantilla: z.string().min(1).max(20),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
}

const createInstrumentSchema = z.object(baseInstrumentFields)

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
      message: 'rolesPermitidos must be a comma-separated list of valid RolUsuario values (ADMIN, EMPLEADO, AUDITOR, OPERADOR)',
    })
    .optional(),
  plantillaArchivo: z.string().optional(),
  versionPlantilla: z.string().min(1).max(20).optional(),
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
  archivoCompletado: z.string().optional(),
  notasObservaciones: z.string().optional(),
})

const updateRecordSchema = z.object({
  estado: z.enum(['COMPLETADO', 'PENDIENTE', 'VENCIDO']).optional(),
  fechaCompletado: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  versionRegistro: z.string().max(20).optional(),
  responsable: z.number().int().positive().optional(),
  archivoCompletado: z.string().optional(),
  notasObservaciones: z.string().optional(),
})

// --- Instrument Routes ---

// GET /instruments
router.get('/', async (req: Request, res: Response): Promise<void> => {
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
router.get('/records/by-instrument/:instrumentId', async (req: Request, res: Response): Promise<void> => {
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
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
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

// POST /instruments — jul-10 C6 gated: ADMIN OR EMPLEADO+GERONTOLOGA
router.post('/', requireInstrumentWriter(), validate(createInstrumentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const instrument = await instrumentService.createInstrument(req.body, userId)
    res.status(201).json({ success: true, data: instrument })
  } catch (error: any) {
    logger.error('Create instrument error:', error)
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Instrument with this code already exists' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating instrument' })
  }
})

// PUT /instruments/:id — jul-10 C6 gated: ADMIN OR EMPLEADO+GERONTOLOGA
router.put('/:id', requireInstrumentWriter(), validate(updateInstrumentSchema), async (req: Request, res: Response): Promise<void> => {
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
router.delete('/:id', requireInstrumentWriter(), async (req: Request, res: Response): Promise<void> => {
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
router.post('/records', validate(createRecordSchema), async (req: Request, res: Response): Promise<void> => {
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
router.put('/records/:id', validate(updateRecordSchema), async (req: Request, res: Response): Promise<void> => {
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
