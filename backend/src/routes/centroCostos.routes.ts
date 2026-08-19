import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requireDomain } from '../middleware/domainAccess.js'
import * as centroCostosService from '../services/centroCostosService.js'
import { logger } from '../config/logger.js'

const router = Router()
router.use(authMiddleware())
// centro-costos-ago-5: domain key `centro-costos` (D4: ADMIN full, CONTRATOS true, GERONTOLOGA false)
router.use(requireDomain('centro-costos'))

/* -------------------------------------------------------------------------- */
/*  Zod schemas                                                               */
/* -------------------------------------------------------------------------- */

// `valorUnitario` accepts both JSON number and numeric string (contract §1.2).
// We coerce to a string in the schema so the service can hand it to Prisma.Decimal.
const positiveDecimalLike = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a positive number', path: ['valorUnitario'] })
    return z.NEVER
  }
  return String(n)
})

const periodoInput = z.string().refine(
  (s) => /^\d{4}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s),
  { message: 'periodo debe tener formato YYYY-MM o YYYY-MM-DD' },
)

const createItemSchema = z.object({
  nombre: z.string().min(1).max(200),
  notas: z.string().max(1000).optional().nullable(),
  cantidad: z.number().int().positive().optional(),
  valorUnitario: z.union([z.number(), z.string()]).refine(
    (v) => {
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) && n > 0
    },
    { message: 'must be a positive number' },
  ),
  periodo: periodoInput,
  numeroFactura: z.string().max(100).optional().nullable(),
  proveedor: z.string().max(200).optional().nullable(),
  fechaFactura: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaFactura debe tener formato YYYY-MM-DD')
    .optional()
    .nullable(),
})

const updateItemSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  notas: z.string().max(1000).optional().nullable(),
  cantidad: z.number().int().positive().optional(),
  valorUnitario: z
    .union([z.number(), z.string()])
    .refine(
      (v) => {
        const n = typeof v === 'number' ? v : Number(v)
        return Number.isFinite(n) && n > 0
      },
      { message: 'must be a positive number' },
    )
    .optional(),
  periodo: periodoInput.optional(),
  numeroFactura: z.string().max(100).optional().nullable(),
  proveedor: z.string().max(200).optional().nullable(),
  fechaFactura: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaFactura debe tener formato YYYY-MM-DD')
    .optional()
    .nullable(),
})

const createCentroSchema = z.object({
  nombre: z.string().min(1).max(200),
  tipo: z.enum(['INGRESOS', 'EGRESOS']),
  descripcion: z.string().max(2000).optional().nullable(),
  orden: z.number().int().optional(),
})

const updateCentroSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  descripcion: z.string().max(2000).optional().nullable(),
  activo: z.boolean().optional(),
  orden: z.number().int().optional(),
})

/* -------------------------------------------------------------------------- */
/*  Routes — order matters (trap #2). /items/:itemId BEFORE /:id.            */
/* -------------------------------------------------------------------------- */

/* -------- ITEMS (specific paths) ------------------------------------------ */

// GET /items?periodo=YYYY-MM
router.get('/items', async (req: Request, res: Response): Promise<void> => {
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
    const data = await centroCostosService.listItemsByMonth(periodo)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('GET /centro-costos/items error:', e)
    res.status(500).json({ success: false, message: 'Error fetching items' })
  }
})

// PUT /items/:itemId — must be registered BEFORE /:id (trap #2).
router.put(
  '/items/:itemId',
  validate(updateItemSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const itemId = parseInt(req.params.itemId as string, 10)
      if (Number.isNaN(itemId)) {
        res.status(400).json({ success: false, message: 'itemId debe ser numérico', field: 'itemId' })
        return
      }
      const data = await centroCostosService.updateItem(itemId, req.body)
      res.json({ success: true, data })
    } catch (e: any) {
      if (e?.status) {
        res.status(e.status).json({ success: false, message: e.message, field: e.field })
        return
      }
      logger.error('PUT /centro-costos/items/:itemId error:', e)
      res.status(500).json({ success: false, message: 'Error updating item' })
    }
  },
)

// DELETE /items/:itemId
router.delete('/items/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = parseInt(req.params.itemId as string, 10)
    if (Number.isNaN(itemId)) {
      res.status(400).json({ success: false, message: 'itemId debe ser numérico', field: 'itemId' })
      return
    }
    await centroCostosService.deleteItem(itemId)
    res.status(204).send()
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('DELETE /centro-costos/items/:itemId error:', e)
    res.status(500).json({ success: false, message: 'Error deleting item' })
  }
})

/* -------- BALANCE (specific path) ----------------------------------------- */

// GET /balance?periodo=YYYY-MM
router.get('/balance', async (req: Request, res: Response): Promise<void> => {
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
    const data = await centroCostosService.getBalance(periodo)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('GET /centro-costos/balance error:', e)
    res.status(500).json({ success: false, message: 'Error fetching balance' })
  }
})

/* -------- ITEMS UNDER CENTRO ---------------------------------------------- */

// POST /:id/items
router.post('/:id/items', validate(createItemSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const centroId = parseInt(req.params.id as string, 10)
    if (Number.isNaN(centroId)) {
      res.status(400).json({ success: false, message: 'id debe ser numérico', field: 'id' })
      return
    }
    const data = await centroCostosService.createItem(centroId, req.body)
    res.status(201).json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('POST /centro-costos/:id/items error:', e)
    res.status(500).json({ success: false, message: 'Error creating item' })
  }
})

/* -------- CENTRO CRUD (generic :id) --------------------------------------- */

// PUT /:id
router.put('/:id', validate(updateCentroSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10)
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'id debe ser numérico', field: 'id' })
      return
    }
    const data = await centroCostosService.updateCentro(id, req.body)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('PUT /centro-costos/:id error:', e)
    res.status(500).json({ success: false, message: 'Error updating centro' })
  }
})

// DELETE /:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10)
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'id debe ser numérico', field: 'id' })
      return
    }
    await centroCostosService.deleteCentro(id)
    res.status(204).send()
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('DELETE /centro-costos/:id error:', e)
    res.status(500).json({ success: false, message: 'Error deleting centro' })
  }
})

/* -------- ROOT ------------------------------------------------------------- */

// GET /
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tipo = req.query.tipo as string | undefined
    const activoRaw = req.query.activo as string | undefined
    const opts: { tipo?: 'INGRESOS' | 'EGRESOS'; activo?: boolean } = {}
    if (tipo === 'INGRESOS' || tipo === 'EGRESOS') opts.tipo = tipo
    if (activoRaw === 'true') opts.activo = true
    else if (activoRaw === 'false') opts.activo = false
    const data = await centroCostosService.listCentros(opts)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('GET /centro-costos error:', e)
    res.status(500).json({ success: false, message: 'Error fetching centros' })
  }
})

// POST /
router.post('/', validate(createCentroSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await centroCostosService.createCentro(req.body)
    res.status(201).json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('POST /centro-costos error:', e)
    res.status(500).json({ success: false, message: 'Error creating centro' })
  }
})

export { router as centroCostosRoutes }
