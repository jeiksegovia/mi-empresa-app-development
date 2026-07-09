import { getPrisma } from '../config/database.js'
import type { Prisma } from '../generated/prisma/index.js'

export interface ContratoInput {
  tipoContrato: 'OPS' | 'OBRA_O_LABOR' | 'TERMINO_FIJO' | 'TERMINO_INDEFINIDO'
  fechaInicio: string
  fechaFin?: string
  archivoUrl?: string
  activo?: boolean
}

export interface NominaPeriodoArchivoInput {
  tipoArchivo: 'CUENTA_COBRO' | 'INFORME_ACTIVIDADES' | 'COMPROBANTE_APORTES' | 'DESPRENDIBLE' | 'OTRO'
  nombre: string
  url: string
}

export interface NominaPeriodoInput {
  empleadoId: number
  periodo: string  // YYYY-MM-01
  salario?: number
  notas?: string
  archivos?: NominaPeriodoArchivoInput[]
}

export async function listContratos(empleadoId: number) {
  const prisma = getPrisma()
  return prisma.contrato.findMany({
    where: { empleadoId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Create a new Contrato.
 * Rule 1: when activo=true (default), nullify any existing active contrato for the same empleado.
 * Rule 2: fechaFin required unless TERMINO_INDEFINIDO.
 */
export async function createContrato(
  empleadoId: number,
  input: ContratoInput,
): Promise<any> {
  const prisma = getPrisma()
  if (input.tipoContrato !== 'TERMINO_INDEFINIDO' && !input.fechaFin) {
    throw Object.assign(new Error('fechaFin es requerido para este tipo de contrato'), { status: 400 })
  }

  const wantsActivo = input.activo !== false  // default true
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (wantsActivo) {
      await tx.contrato.updateMany({
        where: { empleadoId, activo: true },
        data: { activo: false },
      })
    }
    return tx.contrato.create({
      data: {
        empleadoId,
        tipoContrato: input.tipoContrato,
        fechaInicio: new Date(input.fechaInicio),
        fechaFin: input.fechaFin ? new Date(input.fechaFin) : null,
        archivoUrl: input.archivoUrl ?? null,
        activo: wantsActivo,
      },
    })
  })
}

export async function updateContrato(
  empleadoId: number,
  cid: number,
  input: ContratoInput,
): Promise<any> {
  const prisma = getPrisma()
  const existing = await prisma.contrato.findFirst({ where: { id: cid, empleadoId } })
  if (!existing) throw Object.assign(new Error('Contrato not found'), { status: 404 })

  if (input.tipoContrato !== 'TERMINO_INDEFINIDO' && !input.fechaFin) {
    throw Object.assign(new Error('fechaFin es requerido para este tipo de contrato'), { status: 400 })
  }

  const wantsActivo = input.activo !== false
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (wantsActivo) {
      await tx.contrato.updateMany({
        where: { empleadoId, activo: true, NOT: { id: cid } },
        data: { activo: false },
      })
    }
    return tx.contrato.update({
      where: { id: cid },
      data: {
        tipoContrato: input.tipoContrato,
        fechaInicio: new Date(input.fechaInicio),
        fechaFin: input.fechaFin ? new Date(input.fechaFin) : null,
        archivoUrl: input.archivoUrl ?? null,
        activo: wantsActivo,
      },
    })
  })
}

export async function deleteContrato(empleadoId: number, cid: number) {
  const prisma = getPrisma()
  const existing = await prisma.contrato.findFirst({ where: { id: cid, empleadoId } })
  if (!existing) throw Object.assign(new Error('Contrato not found'), { status: 404 })
  await prisma.contrato.delete({ where: { id: cid } })
}

/**
 * GET /nomina?periodo=YYYY-MM[&tipoContrato=OPS,OBRA_O_LABOR,TERMINO_FIJO,TERMINO_INDEFINIDO,NONE]
 *
 * - Default (no tipoContrato param): only empleados WITH an active contract.
 * - With `tipoContrato` param: filter includes any empleado whose active
 *   contrato.tipoContrato ∈ the list, OR (if "NONE" is in the list) empleados
 *   with NO active contrato.
 *
 * Returns each ACTIVO empleado with their contrato activo + period entry status.
 */
const VALID_TIPOS_CONTRATO = ['OPS', 'OBRA_O_LABOR', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'NONE'] as const

export async function getNominaMonth(
  periodoYYYYMM: string,
  tipoContratoParam?: string,
) {
  const prisma = getPrisma()
  const [yearStr, monthStr] = periodoYYYYMM.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)
  if (!year || !month) {
    throw Object.assign(new Error('periodo debe tener formato YYYY-MM'), { status: 400 })
  }
  const periodoDate = new Date(Date.UTC(year, month - 1, 1))

  let tipoFilter: readonly string[] | null = null
  let includeNoContract = false
  if (typeof tipoContratoParam === 'string' && tipoContratoParam.trim() !== '') {
    const parts = tipoContratoParam
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    const valid = parts.filter((p) => (VALID_TIPOS_CONTRATO as readonly string[]).includes(p))
    if (valid.length === 0) {
      throw Object.assign(new Error(`tipoContrato must be a comma-separated list of ${VALID_TIPOS_CONTRATO.join(',')}`), { status: 400 })
    }
    tipoFilter = valid.filter((p) => p !== 'NONE')
    includeNoContract = valid.includes('NONE')
  }

  // Filter empleados via contrato relation. When the user requested NONE, we
  // union in empleados whose contrato count is 0 via `contratos: { none: ... }`.
  // Prisma's `OR` between top-level and nested conditions works on findMany.
  const where: any = { estado: 'ACTIVO' }
  const orClauses: any[] = []
  if (tipoFilter && tipoFilter.length > 0) {
    orClauses.push({ contratos: { some: { activo: true, tipoContrato: { in: tipoFilter as any } } } })
  } else if (!tipoContratoParam) {
    // No filter at all → default behaviour: only empleados WITH an active contract.
    orClauses.push({ contratos: { some: { activo: true } } })
  }
  if (includeNoContract) {
    orClauses.push({ contratos: { none: { activo: true } } })
  }
  if (orClauses.length > 0) where.OR = orClauses

  const empleados = await prisma.empleado.findMany({
    where,
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    include: {
      contratos: { where: { activo: true }, take: 1 },
      nominaPeriodos: { where: { periodo: periodoDate }, take: 1, include: { archivos: true } },
      cargos: { orderBy: { fechaIngreso: 'desc' }, take: 1, select: { salario: true } },
    },
  })

  return empleados.map((e: any) => ({
    empleado: {
      id: e.id,
      nombre: e.nombre,
      apellido: e.apellido,
      numeroDocumento: e.numeroDocumento,
    },
    contratoActivo: e.contratos[0] ?? null,
    entrada: e.nominaPeriodos[0] ?? null,
    cargoSalario: e.cargos[0]?.salario ?? null,
  }))
}

export async function getNominaPeriodo(id: number) {
  const prisma = getPrisma()
  return prisma.nominaPeriodo.findUnique({
    where: { id },
    include: { archivos: true, contrato: true, empleado: { select: { id: true, nombre: true, apellido: true } } },
  })
}

/**
 * Create a NominaPeriodo row.
 *  - Periodo = first day of the month from input.periodo (YYYY-MM-DD).
 *  - Resolves contrato activo on the empleado (or fetched explicitly).
 *  - UK(empleadoId, periodo) → P2002 → 409.
 */
export async function createNominaPeriodo(input: NominaPeriodoInput, userId: number): Promise<any> {
  const prisma = getPrisma()
  const [y, m] = input.periodo.split('-')
  const periodo = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1))

  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Resolve contrato activo + snapshot tipo INSIDE the transaction to avoid TOCTOU races.
      const contrato = await tx.contrato.findFirst({
        where: { empleadoId: input.empleadoId, activo: true },
      })
      if (!contrato) {
        throw Object.assign(new Error('El empleado no tiene contrato activo'), { status: 400 })
      }

      // D4: cuenta-de-cobro is mandatory for OPS / OBRA_O_LABOR contratos.
      const requiresCuentaCobro = contrato.tipoContrato === 'OPS' || contrato.tipoContrato === 'OBRA_O_LABOR'
      if (requiresCuentaCobro) {
        const hasCuentaCobro = (input.archivos ?? []).some(
          (a) => a.tipoArchivo === 'CUENTA_COBRO' && a.url && a.url.length > 0,
        )
        if (!hasCuentaCobro) {
          throw Object.assign(
            new Error('Cuenta de cobro requerida para contratos OPS/OBRA_O_LABOR'),
            { status: 400, field: 'archivos.CUENTA_COBRO', code: 'CUENTA_COBRO_REQUIRED' },
          )
        }
      }

      const row = await tx.nominaPeriodo.create({
        data: {
          empleadoId: input.empleadoId,
          contratoId: contrato.id,
          periodo,
          tipoContrato: contrato.tipoContrato,
          salario: input.salario ?? null,
          notas: input.notas ?? null,
        },
      })
      if (input.archivos && input.archivos.length) {
        await tx.archivoNominaPeriodo.createMany({
          data: input.archivos.map((a) => ({
            nominaPeriodoId: row.id,
            tipoArchivo: a.tipoArchivo,
            nombre: a.nombre,
            url: a.url,
          })),
        })
      }
      return tx.nominaPeriodo.findUnique({
        where: { id: row.id },
        include: { archivos: true },
      })
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw Object.assign(new Error('Ya existe entrada para este periodo'), { status: 409 })
    }
    throw e
  }
}

export async function updateNominaPeriodo(id: number, input: Partial<NominaPeriodoInput>): Promise<any> {
  const prisma = getPrisma()
  const existing = await prisma.nominaPeriodo.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error('NominaPeriodo not found'), { status: 404 })
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // `archivos !== undefined` → replace-all (deleteMany + createMany, same conditional as FIX-1).
    if (input.archivos !== undefined) {
      await tx.archivoNominaPeriodo.deleteMany({ where: { nominaPeriodoId: id } })
      if (input.archivos.length) {
        await tx.archivoNominaPeriodo.createMany({
          data: input.archivos.map((a) => ({
            nominaPeriodoId: id,
            tipoArchivo: a.tipoArchivo,
            nombre: a.nombre,
            url: a.url,
          })),
        })
      }
    }
    // `null` → clear column; `undefined` → keep existing.
    const data: Record<string, unknown> = {}
    if (input.salario !== undefined) data.salario = input.salario
    if (input.notas !== undefined) data.notas = input.notas
    return tx.nominaPeriodo.update({
      where: { id },
      data,
      include: { archivos: true },
    })
  })
}

export async function deleteNominaPeriodo(id: number) {
  const prisma = getPrisma()
  const existing = await prisma.nominaPeriodo.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error('NominaPeriodo not found'), { status: 404 })
  await prisma.nominaPeriodo.delete({ where: { id } })
}
