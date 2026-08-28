import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requireDomain } from '../middleware/domainAccess.js'
import * as centroCostosService from '../services/centroCostosService.js'
import { logger } from '../config/logger.js'
import { serverTodayBogota } from '../utils/dateBogota.js'

const router = Router()
router.use(authMiddleware())
// centro-costos-ago-5 + aug-17: domain key `centro-costos`
//   D4: ADMIN full, CONTRATOS true, GERONTOLOGA false
//   D14: CONTRATOS has further restrictions — handled inside individual routes below.
router.use(requireDomain('centro-costos'))

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * aug-17 D14: returns true iff the request is from a CONTRATOS-subrole
 * EMPLEADO (i.e. someone whose only domain access is via the matrix
 * CONTRATOS→centro-costos=true cell). ADMIN, AUDITOR, OPERADOR return
 * false (they keep full access).
 */
function isContratosRequest(req: Request): boolean {
  const user = req.user as any
  return user?.rol === 'EMPLEADO' && user?.tipoEmpleado === 'CONTRATOS'
}

/* -------------------------------------------------------------------------- */
/*  Zod schemas                                                               */
/* -------------------------------------------------------------------------- */

const positiveDecimalLike = z
.union([z.number(), z.string()])
.refine(
  (v) => {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) && n > 0
  },
  { message: 'must be a positive number' },
)

const optionalPositiveDecimalLike = z
.union([z.number(), z.string()])
.refine(
  (v) => {
    if (typeof v === 'string' && v.trim() === '') return true
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) && n >= 0
  },
  { message: 'must be a non-negative number or empty' },
)
.optional()
.nullable()

const periodoInput = z.string().refine(
  (s) => /^\d{4}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s),
  { message: 'periodo debe tener formato YYYY-MM o YYYY-MM-DD' },
)

const fechaInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe tener formato YYYY-MM-DD')

const createItemSchema = z.object({
  nombre: z.string().min(1).max(200),
  notas: z.string().max(1000).optional().nullable(),
  cantidad: z.number().int().positive().optional(),
  // EGRESOS-only; on INGRESOS the server copies centro.precioUnitario and ignores this.
  valorUnitario: positiveDecimalLike.optional(),
  // aug-17 D10: required day-level date
  fecha: fechaInput,
  // Optional override; server always recomputes from fecha.
  periodo: periodoInput.optional(),
  numeroFactura: z.string().max(100).optional().nullable(),
  proveedor: z.string().max(200).optional().nullable(),
  fechaFactura: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaFactura debe tener formato YYYY-MM-DD')
    .optional()
    .nullable(),
  // aug-17 D11: INGRESOS-only fields
  pagador: z.string().max(200).optional().nullable(),
  beneficiarioClienteId: z.number().int().positive().optional().nullable(),
  medioPago: z.enum(['EFECTIVO', 'TRANSFERENCIA']).optional().nullable(),
})

const updateItemSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  notas: z.string().max(1000).optional().nullable(),
  cantidad: z.number().int().positive().optional(),
  valorUnitario: positiveDecimalLike.optional(),
  fecha: fechaInput.optional(),
  periodo: periodoInput.optional(),
  numeroFactura: z.string().max(100).optional().nullable(),
  proveedor: z.string().max(200).optional().nullable(),
  fechaFactura: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaFactura debe tener formato YYYY-MM-DD')
    .optional()
    .nullable(),
  pagador: z.string().max(200).optional().nullable(),
  beneficiarioClienteId: z.number().int().positive().optional().nullable(),
  medioPago: z.enum(['EFECTIVO', 'TRANSFERENCIA']).optional().nullable(),
})

const createCentroSchema = z.object({
  nombre: z.string().min(1).max(200),
  tipo: z.enum(['INGRESOS', 'EGRESOS']),
  descripcion: z.string().max(2000).optional().nullable(),
  orden: z.number().int().optional(),
  // aug-17 D11/D13
  precioUnitario: optionalPositiveDecimalLike,
  habilitarRecibo: z.boolean().optional(),
  ocultarBeneficiario: z.boolean().optional(),
})

const updateCentroSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  descripcion: z.string().max(2000).optional().nullable(),
  activo: z.boolean().optional(),
  orden: z.number().int().optional(),
  precioUnitario: optionalPositiveDecimalLike,
  habilitarRecibo: z.boolean().optional(),
  ocultarBeneficiario: z.boolean().optional(),
})

/* -------------------------------------------------------------------------- */
/*  Routes — order matters (trap #2). /items/:itemId BEFORE /:id.            */
/* -------------------------------------------------------------------------- */

/* -------- ITEMS (specific paths) ------------------------------------------ */

// GET /items?periodo=YYYY-MM  (CONTRATOS locked to current Bogotá month, R22)
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
    // aug-27 F4: when the ADMIN lock is on, CONTRATOS may only list the
    // current Bogotá month. When off (backfill), any month is allowed.
    if (isContratosRequest(req)) {
      const policy = await centroCostosService.getContratosFechaPolicy()
      if (policy.limitarFechaContratos) {
        const today = serverTodayBogota()
        if (periodo !== today.slice(0, 7)) {
          res.status(403).json({
            success: false,
            message: 'CONTRATOS solo puede consultar el mes actual en curso',
            field: 'periodo',
          })
          return
        }
      }
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
      // aug-27 F4: CONTRATOS may not invent past fechas when the lock is on.
      if (isContratosRequest(req)) {
        const prisma = (await import('../config/database.js')).getPrisma()
        const item = await prisma.centroCostosItem.findUnique({
          where: { id: itemId },
          select: { fecha: true },
        })
        if (!item) {
          res.status(404).json({ success: false, message: 'Ítem no encontrado', field: 'itemId' })
          return
        }
        const policy = await centroCostosService.getContratosFechaPolicy()
        const existingYmd = centroCostosService.itemFechaYmd(item.fecha)
        centroCostosService.assertContratosFechaAllowed(policy, existingYmd)
        if (req.body?.fecha) {
          centroCostosService.assertContratosFechaAllowed(policy, req.body.fecha)
        }
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
    // aug-27 F4: CONTRATOS never deletes ítems (Paola: "no pueden borrar").
    if (isContratosRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'CONTRATOS no puede eliminar ítems de centro de costos',
        field: 'itemId',
      })
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

// GET /items/:itemId — aug-17 R31: ítem + centro + beneficiario for the recibo page.
// MUST be registered BEFORE the generic /:id route (trap #2).
// aug-17 D14: CONTRATOS may only fetch ítems whose fecha is in the current Bogotá month.
router.get('/items/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = parseInt(req.params.itemId as string, 10)
    if (Number.isNaN(itemId)) {
      res.status(400).json({ success: false, message: 'itemId debe ser numérico', field: 'itemId' })
      return
    }
    if (isContratosRequest(req)) {
      const prisma = (await import('../config/database.js')).getPrisma()
      const item = await prisma.centroCostosItem.findUnique({
        where: { id: itemId },
        select: { fecha: true },
      })
      if (!item) {
        res.status(404).json({ success: false, message: 'Ítem no encontrado', field: 'itemId' })
        return
      }
      const policy = await centroCostosService.getContratosFechaPolicy()
      if (policy.limitarFechaContratos) {
        const today = serverTodayBogota()
        const itemYYYYMM = centroCostosService.itemFechaYmd(item.fecha).slice(0, 7)
        if (itemYYYYMM !== today.slice(0, 7)) {
          res.status(403).json({
            success: false,
            message: 'CONTRATOS solo puede consultar ítems del mes actual en curso',
            field: 'fecha',
          })
          return
        }
      }
    }
    const data = await centroCostosService.getItemWithRelations(itemId)
    res.json({ success: true, data })
  } catch (e: any) {
    if (e?.status) {
      res.status(e.status).json({ success: false, message: e.message, field: e.field })
      return
    }
    logger.error('GET /centro-costos/items/:itemId error:', e)
    res.status(500).json({ success: false, message: 'Error fetching item' })
  }
})

/* -------- BALANCE (specific path) ----------------------------------------- */

// GET /balance?periodo=YYYY-MM  (CONTRATOS denied, R22)
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
    // aug-17 D14/R22: CONTRATOS may not see balance at all.
    if (isContratosRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'CONTRATOS no tiene acceso al balance del centro de costos',
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
    // aug-27 F4: CONTRATOS fecha window when ADMIN lock is on.
    if (isContratosRequest(req)) {
      const policy = await centroCostosService.getContratosFechaPolicy()
      centroCostosService.assertContratosFechaAllowed(policy, req.body.fecha)
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

/* -------- POLICY (aug-27 F4) — BEFORE generic /:id ------------------------ */

router.get('/policy', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await centroCostosService.getContratosFechaPolicy()
    res.json({ success: true, data })
  } catch (e: any) {
    logger.error('GET /centro-costos/policy error:', e)
    res.status(500).json({ success: false, message: 'Error fetching policy' })
  }
})

/* -------- CENTRO CRUD (generic :id) --------------------------------------- */

// PUT /:id — aug-17 D14/R21: CONTRATOS denied.
router.put('/:id', validate(updateCentroSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10)
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'id debe ser numérico', field: 'id' })
      return
    }
    if (isContratosRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'CONTRATOS no puede editar centros de costos',
      })
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

// DELETE /:id — aug-17 D14/R21: CONTRATOS denied.
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10)
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'id debe ser numérico', field: 'id' })
      return
    }
    if (isContratosRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'CONTRATOS no puede eliminar centros de costos',
      })
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

// POST / — aug-17 D14/R21: CONTRATOS denied.
router.post('/', validate(createCentroSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    if (isContratosRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'CONTRATOS no puede crear centros de costos',
      })
      return
    }
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