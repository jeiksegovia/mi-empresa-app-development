import { getPrisma } from '../config/database.js'
import { Prisma } from '../generated/prisma/index.js'
import { contratosAllowedFechas, serverTodayBogota } from '../utils/dateBogota.js'

// centro-costos-ago-5 + aug-17 service. All data access lives here; routes
// stay thin. Decimal values are passed to Prisma as `Prisma.Decimal`; on
// the way out Prisma already serializes them as strings over JSON
// (contract §1.2).

/* -------------------------------------------------------------------------- */
/*  Helpers — pure string math, no Date() local parsing (WI-3)                */
/* -------------------------------------------------------------------------- */

const PERIODO_FULL = /^(\d{4})-(\d{2})-(\d{2})$/
const PERIODO_SHORT = /^(\d{4})-(\d{2})$/

/**
 * Normalize a periodo string to YYYY-MM-DD with day = 01.
 * Accepts "YYYY-MM" or "YYYY-MM-DD". Throws 400 if malformed.
 * PURE STRING MATH (`"2026-08-17"` → `"2026-08-01"`). Never `new Date(...)`.
 */
export function normalizePeriodo(input: string): string {
  if (PERIODO_FULL.test(input)) {
    return input.slice(0, 7) + '-01'
  }
  if (PERIODO_SHORT.test(input)) {
    return input + '-01'
  }
  throw Object.assign(new Error('periodo debe tener formato YYYY-MM o YYYY-MM-DD'), { status: 400, field: 'periodo' })
}

/** Bounds for a "YYYY-MM" period: [start of month, start of next month). */
export function itemFechaYmd(fecha: Date | string): string {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10)
  return String(fecha).slice(0, 10)
}

export type ContratosFechaPolicy = {
  limitarFechaContratos: boolean
  today: string
  previousBusinessDay: string
  allowed: string[]
}

export async function getContratosFechaPolicy(): Promise<ContratosFechaPolicy> {
  const prisma = getPrisma()
  const empresa = await prisma.empresa.findFirst({
    where: { activa: true },
    orderBy: { id: 'asc' },
    select: { limitarFechaContratos: true },
  })
  const limitar = empresa?.limitarFechaContratos ?? false
  const window = contratosAllowedFechas(serverTodayBogota())
  return {
    limitarFechaContratos: limitar,
    today: window.today,
    previousBusinessDay: window.previousBusinessDay,
    allowed: window.allowed,
  }
}

export function assertContratosFechaAllowed(policy: ContratosFechaPolicy, fechaYmd: string): void {
  if (!policy.limitarFechaContratos) return
  if (policy.allowed.includes(fechaYmd)) return
  throw Object.assign(
    new Error(
      `CONTRATOS solo puede registrar ítems con fecha de hoy (${policy.today}) o el día hábil anterior (${policy.previousBusinessDay})`,
    ),
    { status: 403, field: 'fecha' },
  )
}

export function periodBounds(periodoYYYYMM: string): { start: Date; end: Date } {
  const m = PERIODO_SHORT.exec(periodoYYYYMM)
  if (!m) {
    throw Object.assign(new Error('periodo debe tener formato YYYY-MM'), { status: 400, field: 'periodo' })
  }
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  // Use UTC to avoid TZ drift; cliente normalization ensures day 1.
  const start = new Date(Date.UTC(y, mo - 1, 1))
  const end = new Date(Date.UTC(y, mo, 1)) // exclusive
  return { start, end }
}

/**
 * Accept a JSON number or numeric string and return a Decimal coerced to 2dp.
 * Throws 400 if the input is not a positive number.
 */
function toMoneyDecimal(input: number | string, field: string): Prisma.Decimal {
  let n: number
  if (typeof input === 'number') {
    n = input
  } else if (typeof input === 'string' && input.trim() !== '') {
    n = Number(input)
  } else {
    throw Object.assign(new Error(`${field} debe ser un número positivo`), { status: 400, field })
  }
  if (!Number.isFinite(n) || n <= 0) {
    throw Object.assign(new Error(`${field} debe ser un número positivo`), { status: 400, field })
  }
  // Round to 2dp to match @db.Decimal(15, 2)
  return new Prisma.Decimal(n.toFixed(2))
}

/**
 * Optional-money variant: returns `null` for null/undefined/empty-string,
 * throws 400 for negative/NaN, otherwise a positive 2dp Decimal. Used for
 * `precioUnitario` (aug-17 D11) which is intentionally nullable.
 */
function toOptionalMoneyDecimal(input: number | string | null | undefined, field: string): Prisma.Decimal | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'string' && input.trim() === '') return null
  let n: number
  if (typeof input === 'number') {
    n = input
  } else {
    n = Number(input)
  }
  if (!Number.isFinite(n)) {
    throw Object.assign(new Error(`${field} debe ser un número`), { status: 400, field })
  }
  if (n < 0) {
    throw Object.assign(new Error(`${field} debe ser ≥ 0`), { status: 400, field })
  }
  return new Prisma.Decimal(n.toFixed(2))
}

/* -------------------------------------------------------------------------- */
/*  Centros                                                                   */
/* -------------------------------------------------------------------------- */

export interface CentroCostosDTO {
  id: number
  nombre: string
  tipo: 'INGRESOS' | 'EGRESOS'
  descripcion: string | null
  activo: boolean
  orden: number
  // aug-17 D11/D13: per-centro unit price (INGRESOS only) and recibo flag
  precioUnitario: string | null
  habilitarRecibo: boolean
  // aug-28: hide beneficiario on ítem dialog + skip required check
  ocultarBeneficiario: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCentroInput {
  nombre: string
  tipo: 'INGRESOS' | 'EGRESOS'
  descripcion?: string | null
  orden?: number
  // aug-17 D11/D13: optional on create — INGRESOS only. If absent, stored null.
  precioUnitario?: number | string | null
  habilitarRecibo?: boolean
  ocultarBeneficiario?: boolean
}

export interface UpdateCentroInput {
  nombre?: string
  descripcion?: string | null
  activo?: boolean
  orden?: number
  // aug-17 D11/D13
  precioUnitario?: number | string | null
  habilitarRecibo?: boolean
  ocultarBeneficiario?: boolean
}

function toCentroDTO(c: any): CentroCostosDTO {
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    descripcion: c.descripcion ?? null,
    activo: c.activo,
    orden: c.orden,
    precioUnitario: c.precioUnitario == null ? null : c.precioUnitario.toFixed(2),
    habilitarRecibo: c.habilitarRecibo,
    ocultarBeneficiario: !!c.ocultarBeneficiario,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  }
}

export async function listCentros(opts: {
  tipo?: 'INGRESOS' | 'EGRESOS'
  activo?: boolean
}): Promise<CentroCostosDTO[]> {
  const prisma = getPrisma()
  const where: Prisma.CentroCostosWhereInput = {}
  if (opts.tipo) where.tipo = opts.tipo
  if (typeof opts.activo === 'boolean') where.activo = opts.activo
  const rows = await prisma.centroCostos.findMany({
    where,
    orderBy: [{ tipo: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
  })
  return rows.map(toCentroDTO)
}

export async function createCentro(input: CreateCentroInput): Promise<CentroCostosDTO> {
  const prisma = getPrisma()
  try {
    const created = await prisma.centroCostos.create({
      data: {
        nombre: input.nombre,
        tipo: input.tipo,
        descripcion: input.descripcion ?? null,
        activo: true,
        orden: input.orden ?? 0,
        precioUnitario: toOptionalMoneyDecimal(input.precioUnitario ?? null, 'precioUnitario'),
        habilitarRecibo: input.habilitarRecibo ?? false,
        ocultarBeneficiario: input.ocultarBeneficiario ?? false,
      },
    })
    return toCentroDTO(created)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw Object.assign(new Error('Ya existe un centro con este nombre y tipo'), { status: 409, field: 'nombre' })
    }
    throw e
  }
}

export async function updateCentro(id: number, input: UpdateCentroInput): Promise<CentroCostosDTO> {
  const prisma = getPrisma()
  const existing = await prisma.centroCostos.findUnique({ where: { id } })
  if (!existing) {
    throw Object.assign(new Error('Centro no encontrado'), { status: 404, field: 'id' })
  }
  try {
    const data: Prisma.CentroCostosUpdateInput = {
      ...(input.nombre !== undefined && { nombre: input.nombre }),
      ...(input.descripcion !== undefined && { descripcion: input.descripcion }),
      ...(input.activo !== undefined && { activo: input.activo }),
      ...(input.orden !== undefined && { orden: input.orden }),
    }
    if (input.precioUnitario !== undefined) {
      data.precioUnitario = toOptionalMoneyDecimal(input.precioUnitario, 'precioUnitario')
    }
    if (input.habilitarRecibo !== undefined) {
      data.habilitarRecibo = input.habilitarRecibo
    }
    if (input.ocultarBeneficiario !== undefined) {
      data.ocultarBeneficiario = input.ocultarBeneficiario
    }
    const updated = await prisma.centroCostos.update({
      where: { id },
      data,
    })
    return toCentroDTO(updated)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw Object.assign(new Error('Ya existe un centro con este nombre y tipo'), { status: 409, field: 'nombre' })
    }
    throw e
  }
}

export async function deleteCentro(id: number): Promise<void> {
  const prisma = getPrisma()
  const existing = await prisma.centroCostos.findUnique({ where: { id } })
  if (!existing) {
    throw Object.assign(new Error('Centro no encontrado'), { status: 404, field: 'id' })
  }
  // ON DELETE RESTRICT will fire if there are items; we surface a clean 409.
  try {
    await prisma.centroCostos.delete({ where: { id } })
  } catch (e: any) {
    if (e?.code === 'P2003') {
      throw Object.assign(
        new Error('El centro tiene ítems; desactívelo en lugar de eliminarlo'),
        { status: 409, field: 'centroCostosId' },
      )
    }
    throw e
  }
}

/* -------------------------------------------------------------------------- */
/*  Ítems                                                                     */
/* -------------------------------------------------------------------------- */

export interface CentroCostosItemDTO {
  id: number
  centroCostosId: number
  nombre: string
  notas: string | null
  cantidad: number
  valorUnitario: string
  valorTotal: string
  fecha: string         // YYYY-MM-DD (aug-17 D10)
  periodo: string       // YYYY-MM-DD, always day 1 of fecha's month
  numeroFactura: string | null
  proveedor: string | null
  fechaFactura: string | null
  // aug-17 D11: INGRESOS-only metadata (null on EGRESOS)
  pagador: string | null
  beneficiarioClienteId: number | null
  medioPago: 'EFECTIVO' | 'TRANSFERENCIA' | null
  createdAt: string
  updatedAt: string
}

export interface CreateItemInput {
  nombre: string
  notas?: string | null
  cantidad?: number
  valorUnitario?: number | string    // EGRESOS only; ignored on INGRESOS (server copies centro.precioUnitario)
  fecha: string                     // aug-17 D10: required YYYY-MM-DD
  periodo?: string                  // optional override — server always recomputes from fecha
  numeroFactura?: string | null
  proveedor?: string | null
  fechaFactura?: string | null
  // aug-17 D11: required on INGRESOS, ignored on EGRESOS
  pagador?: string | null
  beneficiarioClienteId?: number | null
  medioPago?: 'EFECTIVO' | 'TRANSFERENCIA' | null
}

export interface UpdateItemInput {
  nombre?: string
  notas?: string | null
  cantidad?: number
  valorUnitario?: number | string
  fecha?: string                     // aug-17 D10: setting fecha also recomputes periodo
  periodo?: string
  numeroFactura?: string | null
  proveedor?: string | null
  fechaFactura?: string | null
  // aug-17 D11
  pagador?: string | null
  beneficiarioClienteId?: number | null
  medioPago?: 'EFECTIVO' | 'TRANSFERENCIA' | null
}

function isoDate(d: any): string | null {
  if (d == null) return null
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  if (typeof d === 'string') return d.slice(0, 10)
  return d
}

function toItemDTO(i: any): CentroCostosItemDTO {
  return {
    id: i.id,
    centroCostosId: i.centroCostosId,
    nombre: i.nombre,
    notas: i.notas ?? null,
    cantidad: i.cantidad,
    valorUnitario: i.valorUnitario.toFixed(2),
    valorTotal: i.valorTotal.toFixed(2),
    fecha: isoDate(i.fecha)!,
    periodo: isoDate(i.periodo)!,
    numeroFactura: i.numeroFactura ?? null,
    proveedor: i.proveedor ?? null,
    fechaFactura: isoDate(i.fechaFactura),
    pagador: i.pagador ?? null,
    beneficiarioClienteId: i.beneficiarioClienteId ?? null,
    medioPago: i.medioPago ?? null,
    createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt,
    updatedAt: i.updatedAt instanceof Date ? i.updatedAt.toISOString() : i.updatedAt,
  }
}

export async function createItem(centroId: number, input: CreateItemInput): Promise<CentroCostosItemDTO> {
  const prisma = getPrisma()
  const centro = await prisma.centroCostos.findUnique({ where: { id: centroId } })
  if (!centro) {
    throw Object.assign(new Error('Centro no encontrado'), { status: 404, field: 'id' })
  }
  // Validate fecha (required, YYYY-MM-DD)
  if (!input.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    throw Object.assign(new Error('fecha debe tener formato YYYY-MM-DD'), { status: 400, field: 'fecha' })
  }
  const fechaDate = new Date(input.fecha + 'T00:00:00.000Z')
  if (Number.isNaN(fechaDate.getTime())) {
    throw Object.assign(new Error('fecha inválida'), { status: 400, field: 'fecha' })
  }
  // Periodo is always first-of-month(fecha)
  const periodoNorm = input.fecha.slice(0, 7) + '-01'

  const cantidad = input.cantidad ?? 1

  let valorUnitario: Prisma.Decimal
  if (centro.tipo === 'INGRESOS') {
    // aug-17 D11/R26: copy centro.precioUnitario; client valorUnitario ignored; 400 if null.
    if (centro.precioUnitario == null) {
      throw Object.assign(
        new Error('El centro de INGRESOS no tiene precio unitario configurado'),
        { status: 400, field: 'precioUnitario' },
      )
    }
    valorUnitario = centro.precioUnitario
    // aug-17 D11/R25: INGRESOS requires pagador + beneficiarioClienteId
    if (!input.pagador || !input.pagador.trim()) {
      throw Object.assign(new Error('pagador es requerido para INGRESOS'), { status: 400, field: 'pagador' })
    }
    // aug-28: beneficiario is required unless the centro hides the field.
    if (!centro.ocultarBeneficiario && input.beneficiarioClienteId == null) {
      throw Object.assign(
        new Error('beneficiarioClienteId es requerido para INGRESOS'),
        { status: 400, field: 'beneficiarioClienteId' },
      )
    }
    if (input.beneficiarioClienteId != null) {
      const clienteExists = await prisma.cliente.findUnique({
        where: { id: input.beneficiarioClienteId },
        select: { id: true },
      })
      if (!clienteExists) {
        throw Object.assign(new Error('Beneficiario (cliente) no existe'), {
          status: 400,
          field: 'beneficiarioClienteId',
        })
      }
    }
  } else {
    // EGRESOS: client-sent valorUnitario required (positive); ingreso fields stored null
    valorUnitario = toMoneyDecimal(input.valorUnitario as number | string, 'valorUnitario')
  }

  const valorTotal = new Prisma.Decimal(cantidad).mul(valorUnitario)
  const created = await prisma.centroCostosItem.create({
    data: {
      centroCostosId: centroId,
      nombre: input.nombre,
      notas: input.notas ?? null,
      cantidad,
      valorUnitario,
      valorTotal,
      fecha: fechaDate,
      periodo: new Date(periodoNorm + 'T00:00:00.000Z'),
      numeroFactura: input.numeroFactura ?? null,
      proveedor: input.proveedor ?? null,
      fechaFactura: input.fechaFactura ? new Date(input.fechaFactura + 'T00:00:00.000Z') : null,
      pagador: centro.tipo === 'INGRESOS' ? input.pagador!.trim() : null,
      beneficiarioClienteId: centro.tipo === 'INGRESOS' ? input.beneficiarioClienteId ?? null : null,
      medioPago: centro.tipo === 'INGRESOS' ? input.medioPago ?? null : null,
    },
  })
  return toItemDTO(created)
}

export async function updateItem(itemId: number, input: UpdateItemInput): Promise<CentroCostosItemDTO> {
  const prisma = getPrisma()
  const existing = await prisma.centroCostosItem.findUnique({
    where: { id: itemId },
    include: { centroCostos: true },
  })
  if (!existing) {
    throw Object.assign(new Error('Ítem no encontrado'), { status: 404, field: 'itemId' })
  }

  const centro = existing.centroCostos
  const isIngreso = centro.tipo === 'INGRESOS'

  const data: Prisma.CentroCostosItemUpdateInput = {}
  if (input.nombre !== undefined) data.nombre = input.nombre
  if (input.notas !== undefined) data.notas = input.notas
  if (input.numeroFactura !== undefined) data.numeroFactura = input.numeroFactura
  if (input.proveedor !== undefined) data.proveedor = input.proveedor
  if (input.fechaFactura !== undefined) {
    data.fechaFactura = input.fechaFactura ? new Date(input.fechaFactura + 'T00:00:00.000Z') : null
  }
  // aug-17 D11: ingreso fields
  if (input.pagador !== undefined) {
    data.pagador = isIngreso ? input.pagador : null
  }
  if (input.medioPago !== undefined) {
    data.medioPago = isIngreso ? input.medioPago : null
  }
  if (input.beneficiarioClienteId !== undefined) {
    if (isIngreso && input.beneficiarioClienteId != null) {
      const clienteExists = await prisma.cliente.findUnique({
        where: { id: input.beneficiarioClienteId },
        select: { id: true },
      })
      if (!clienteExists) {
        throw Object.assign(new Error('Beneficiario (cliente) no existe'), {
          status: 400,
          field: 'beneficiarioClienteId',
        })
      }
      data.beneficiario = { connect: { id: input.beneficiarioClienteId } }
    } else {
      data.beneficiario = { disconnect: true }
    }
  }

  // aug-17 D10: setting fecha also recomputes periodo
  let fechaDate: Date | undefined
  if (input.fecha !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
      throw Object.assign(new Error('fecha debe tener formato YYYY-MM-DD'), { status: 400, field: 'fecha' })
    }
    fechaDate = new Date(input.fecha + 'T00:00:00.000Z')
    if (Number.isNaN(fechaDate.getTime())) {
      throw Object.assign(new Error('fecha inválida'), { status: 400, field: 'fecha' })
    }
    data.fecha = fechaDate
    data.periodo = new Date(input.fecha.slice(0, 7) + '-01T00:00:00.000Z')
  } else if (input.periodo !== undefined) {
    // allow legacy callers; recomputed deterministically from string math
    data.periodo = new Date(normalizePeriodo(input.periodo) + 'T00:00:00.000Z')
  }

  // Recompute valorTotal whenever cantidad or valorUnitario change.
  let newCantidad = input.cantidad ?? existing.cantidad
  let newValorUnitario: Prisma.Decimal

  if (isIngreso) {
    // Ingresos: server-managed precioUnitario (centro.precioUnitario).
    // If user explicitly sends valorUnitario on update for an ingreso, ignore it.
    newValorUnitario = centro.precioUnitario ?? existing.valorUnitario
  } else {
    newValorUnitario =
      input.valorUnitario !== undefined
        ? toMoneyDecimal(input.valorUnitario, 'valorUnitario')
        : existing.valorUnitario
  }
  if (input.cantidad !== undefined) data.cantidad = input.cantidad
  data.valorUnitario = newValorUnitario
  data.valorTotal = new Prisma.Decimal(newCantidad).mul(newValorUnitario)

  const updated = await prisma.centroCostosItem.update({ where: { id: itemId }, data })
  return toItemDTO(updated)
}

export async function deleteItem(itemId: number): Promise<void> {
  const prisma = getPrisma()
  const existing = await prisma.centroCostosItem.findUnique({ where: { id: itemId } })
  if (!existing) {
    throw Object.assign(new Error('Ítem no encontrado'), { status: 404, field: 'itemId' })
  }
  await prisma.centroCostosItem.delete({ where: { id: itemId } })
}

/**
 * aug-17 R31: GET /centro-costos/items/:itemId — fetch one ítem with its
 * parent centro and the beneficiario (Cliente) hydrated as `{ id, nombre }`
 * (or `null`). 404 if missing. Used by the recibo print page.
 */
export interface ItemWithRelationsDTO extends CentroCostosItemDTO {
  centro: CentroCostosDTO
  beneficiario: { id: number; nombre: string } | null
}

export async function getItemWithRelations(itemId: number): Promise<ItemWithRelationsDTO> {
  const prisma = getPrisma()
  const row = await prisma.centroCostosItem.findUnique({
    where: { id: itemId },
    include: {
      centroCostos: true,
      beneficiario: { select: { id: true, nombre: true } },
    },
  })
  if (!row) {
    throw Object.assign(new Error('Ítem no encontrado'), { status: 404, field: 'itemId' })
  }
  return {
    ...toItemDTO(row),
    centro: toCentroDTO(row.centroCostos),
    beneficiario: row.beneficiario ? { id: row.beneficiario.id, nombre: row.beneficiario.nombre } : null,
  }
}

/* -------------------------------------------------------------------------- */
/*  Listings by month + balance                                               */
/* -------------------------------------------------------------------------- */

export interface GrupoCentro {
  centro: CentroCostosDTO
  items: CentroCostosItemDTO[]
  subtotal: string
}

export async function listItemsByMonth(periodoYYYYMM: string): Promise<{ periodo: string; grupos: GrupoCentro[] }> {
  const prisma = getPrisma()
  const { start, end } = periodBounds(periodoYYYYMM) // upper bound is end-exclusive
  const periodoNorm = normalizePeriodo(periodoYYYYMM)

  const rows = await prisma.centroCostosItem.findMany({
    where: { periodo: { gte: start, lt: end } },
    orderBy: [{ centroCostosId: 'asc' }, { id: 'asc' }],
    include: {
      centroCostos: true,
    },
  })

  const byCentro = new Map<number, GrupoCentro>()
  for (const r of rows) {
    let g = byCentro.get(r.centroCostosId)
    if (!g) {
      g = {
        centro: toCentroDTO(r.centroCostos),
        items: [],
        subtotal: '0.00',
      }
      byCentro.set(r.centroCostosId, g)
    }
    g.items.push(toItemDTO(r))
  }
  // Compute subtotals as Decimal.
  for (const g of byCentro.values()) {
    const total = g.items.reduce(
      (acc, it) => acc.add(new Prisma.Decimal(it.valorTotal)),
      new Prisma.Decimal(0),
    )
    g.subtotal = total.toFixed(2)
  }
  // Stable order: by tipo, then orden, then nombre.
  const grupos = Array.from(byCentro.values()).sort((a, b) => {
    if (a.centro.tipo !== b.centro.tipo) return a.centro.tipo.localeCompare(b.centro.tipo)
    if (a.centro.orden !== b.centro.orden) return a.centro.orden - b.centro.orden
    return a.centro.nombre.localeCompare(b.centro.nombre)
  })
  return { periodo: periodoNorm, grupos }
}

export interface BalanceMesDTO {
  periodo: string
  porCentro: Array<{ centroId: number; nombre: string; tipo: 'INGRESOS' | 'EGRESOS'; subtotal: string }>
  totalIngresos: string
  totalEgresos: string
  balance: string
}

export async function getBalance(periodoYYYYMM: string): Promise<BalanceMesDTO> {
  const prisma = getPrisma()
  const { start, end } = periodBounds(periodoYYYYMM)
  const periodoNorm = normalizePeriodo(periodoYYYYMM)

  const rows = await prisma.centroCostosItem.findMany({
    where: { periodo: { gte: start, lt: end } },
    include: { centroCostos: true },
  })

  const buckets = new Map<number, { nombre: string; tipo: 'INGRESOS' | 'EGRESOS'; subtotal: Prisma.Decimal }>()
  let totalIngresos = new Prisma.Decimal(0)
  let totalEgresos = new Prisma.Decimal(0)
  for (const r of rows) {
    const cur = buckets.get(r.centroCostosId) ?? {
      nombre: r.centroCostos.nombre,
      tipo: r.centroCostos.tipo,
      subtotal: new Prisma.Decimal(0),
    }
    cur.subtotal = cur.subtotal.add(r.valorTotal)
    buckets.set(r.centroCostosId, cur)
    if (r.centroCostos.tipo === 'INGRESOS') {
      totalIngresos = totalIngresos.add(r.valorTotal)
    } else {
      totalEgresos = totalEgresos.add(r.valorTotal)
    }
  }

  const porCentro = Array.from(buckets.entries())
    .map(([centroId, b]) => ({
      centroId,
      nombre: b.nombre,
      tipo: b.tipo,
      subtotal: b.subtotal.toFixed(2),
    }))
    .sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo)
      return a.nombre.localeCompare(b.nombre)
    })

  const balance = totalIngresos.sub(totalEgresos)
  return {
    periodo: periodoNorm,
    porCentro,
    totalIngresos: totalIngresos.toFixed(2),
    totalEgresos: totalEgresos.toFixed(2),
    balance: balance.toFixed(2),
  }
}
