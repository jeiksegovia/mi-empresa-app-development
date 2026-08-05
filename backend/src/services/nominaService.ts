import { getPrisma } from '../config/database.js'
import type { Prisma } from '../generated/prisma/index.js'
import { sumMediasForEmpleadoPeriodo } from './asistenciaService.js'

export interface ContratoInput {
  tipoContrato: 'OPS' | 'OBRA_O_LABOR' | 'TERMINO_FIJO' | 'TERMINO_INDEFINIDO'
  fechaInicio: string
  fechaFin?: string
  archivoUrl?: string
  // jul-9 D6: signed-contract file URL
  archivoFirmadoUrl?: string | null
  // jul-10 D7 tighten: cargoId is REQUIRED (the underlying column is NOT NULL);
  // a Zod `.optional()` upstream has been removed in nomina.routes.ts.
  cargoId: number
  activo?: boolean
  // nomina-asistencia-jul-18: required on CREATE for OPS at route layer
  valorJornada?: number | null
  // qa-session-jul-24 R7: required on CREATE for non-OPS at route layer
  valorMensual?: number | null
}

export interface NominaPeriodoArchivoInput {
  tipoArchivo: 'CUENTA_COBRO' | 'INFORME_ACTIVIDADES' | 'COMPROBANTE_APORTES' | 'DESPRENDIBLE' | 'OTRO'
  nombre: string
  url: string
}

export interface NominaPeriodoInput {
  empleadoId: number
  periodo: string // YYYY-MM
  salario?: number
  notas?: string
  archivos?: NominaPeriodoArchivoInput[]
  // nomina-asistencia-jul-18 calc fields
  mediasJornadas?: number
  valorJornada?: number
  subtotalCalculado?: number
  aportesSociales?: number
  totalPagado?: number
  // qa-session-jul-24 R7: optional override for non-OPS base. Per-period
  // `valorMensual` is NOT persisted on nomina_periodos (snapshot per D2);
  // the contract's `valorMensual` lives on the Contrato row.
  valorMensual?: number | null
}

const APORTES_ALLOWED: ReadonlySet<string> = new Set(['TERMINO_FIJO', 'TERMINO_INDEFINIDO'])

export async function listContratos(empleadoId: number) {
  const prisma = getPrisma()
  return prisma.contrato.findMany({
    where: { empleadoId },
    orderBy: { createdAt: 'desc' },
    include: { cargo: true },
  })
}

/**
 * Create a new Contrato.
 * Rule 1: when activo=true (default), nullify any existing active contrato for the same empleado.
 * Rule 2: fechaFin required unless TERMINO_INDEFINIDO.
 * Rule 3 (jul-18): valorJornada required on CREATE (enforced in route Zod + here as safety).
 */
export async function createContrato(
  empleadoId: number,
  input: ContratoInput,
): Promise<any> {
  const prisma = getPrisma()
  if (input.tipoContrato !== 'TERMINO_INDEFINIDO' && !input.fechaFin) {
    throw Object.assign(new Error('fechaFin es requerido para este tipo de contrato'), { status: 400 })
  }
  // qa-session-jul-24 R7: branch required-field on tipoContrato.
  if (input.tipoContrato === 'OPS') {
    if (input.valorJornada === undefined || input.valorJornada === null) {
      throw Object.assign(new Error('valorJornada es requerido para OPS'), {
        status: 400,
        field: 'valorJornada',
      })
    }
    if (typeof input.valorJornada === 'number' && input.valorJornada < 0) {
      throw Object.assign(new Error('valorJornada debe ser ≥ 0'), {
        status: 400,
        field: 'valorJornada',
      })
    }
  } else {
    if (input.valorMensual === undefined || input.valorMensual === null) {
      throw Object.assign(
        new Error(`valorMensual es requerido para ${input.tipoContrato}`),
        { status: 400, field: 'valorMensual' },
      )
    }
    if (typeof input.valorMensual === 'number' && input.valorMensual < 0) {
      throw Object.assign(new Error('valorMensual debe ser ≥ 0'), {
        status: 400,
        field: 'valorMensual',
      })
    }
  }

  const wantsActivo = input.activo !== false // default true
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
        archivoFirmadoUrl: input.archivoFirmadoUrl ?? null,
        cargoId: input.cargoId,
        valorJornada: input.tipoContrato === 'OPS' ? input.valorJornada : null,
        valorMensual: input.tipoContrato === 'OPS' ? null : input.valorMensual,
        activo: wantsActivo,
      },
      include: { cargo: true },
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
    const data: Record<string, unknown> = {
      tipoContrato: input.tipoContrato,
      fechaInicio: new Date(input.fechaInicio),
      fechaFin: input.fechaFin ? new Date(input.fechaFin) : null,
      archivoUrl: input.archivoUrl ?? null,
      archivoFirmadoUrl: input.archivoFirmadoUrl ?? null,
      cargoId: input.cargoId,
      activo: wantsActivo,
    }
    if (input.tipoContrato === 'OPS') {
      if (input.valorJornada !== undefined) {
        data.valorJornada = input.valorJornada
      }
      data.valorMensual = null
    } else {
      if (input.valorMensual !== undefined) {
        data.valorMensual = input.valorMensual
      }
      data.valorJornada = null
    }
    return tx.contrato.update({
      where: { id: cid },
      data,
      include: { cargo: true },
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
 */
const VALID_TIPOS_CONTRATO = ['OPS', 'OBRA_O_LABOR', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'NONE'] as const

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

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

  const where: any = { estado: 'ACTIVO' }
  const orClauses: any[] = []
  if (tipoFilter && tipoFilter.length > 0) {
    orClauses.push({ contratos: { some: { activo: true, tipoContrato: { in: tipoFilter as any } } } })
  } else if (!tipoContratoParam) {
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

  // Batch-load asistencia medias for the month for all empleados in the result
  const start = periodoDate
  const end = new Date(Date.UTC(year, month, 1))
  const empIds = empleados.map((e) => e.id)
  const asistenciaRows =
    empIds.length === 0
      ? []
      : await prisma.asistenciaEmpleado.findMany({
          where: {
            empleadoId: { in: empIds },
            fecha: { gte: start, lt: end },
          },
          select: { empleadoId: true, jornadaAm: true, jornadaPm: true },
        })
  const mediasByEmp = new Map<number, number>()
  for (const r of asistenciaRows) {
    const prev = mediasByEmp.get(r.empleadoId) ?? 0
    mediasByEmp.set(r.empleadoId, prev + (r.jornadaAm ? 1 : 0) + (r.jornadaPm ? 1 : 0))
  }

  return empleados.map((e: any) => {
    const mediasJornadas = mediasByEmp.get(e.id) ?? 0
    const contrato = e.contratos[0] ?? null
    const tipoContrato = contrato?.tipoContrato ?? null
    const isNonOps = tipoContrato && tipoContrato !== 'OPS'
    const valorJornada = contrato ? toNum(contrato.valorJornada) : null
    const valorMensual = contrato ? toNum(contrato.valorMensual) : null
    // qa-session-jul-24 R7: branch sugerido on tipoContrato.
    const subtotal =
      isNonOps ? null : (valorJornada !== null ? mediasJornadas * valorJornada : 0)
    const totalPagado = isNonOps ? valorMensual ?? 0 : subtotal
    return {
      empleado: {
        id: e.id,
        nombre: e.nombre,
        apellido: e.apellido,
        numeroDocumento: e.numeroDocumento,
        medioPagoTipo: e.medioPagoTipo ?? null,
        medioPagoNequi: e.medioPagoNequi ?? null,
        bancoNombre: e.bancoNombre ?? null,
        bancoTipoCuenta: e.bancoTipoCuenta ?? null,
        bancoNumeroCuenta: e.bancoNumeroCuenta ?? null,
      },
      contratoActivo: contrato,
      entrada: e.nominaPeriodos[0] ?? null,
      cargoSalario: e.cargos[0]?.salario ?? null,
      asistenciaMes: {
        mediasJornadas,
        horas: mediasJornadas * 4,
      },
      sugerido: {
        mediasJornadas: isNonOps ? null : mediasJornadas,
        valorJornada: isNonOps ? null : valorJornada,
        valorMensual: isNonOps ? valorMensual : null,
        subtotalCalculado: subtotal,
        aportesSociales: 0,
        totalPagado,
      },
    }
  })
}

export async function getNominaPeriodo(id: number) {
  const prisma = getPrisma()
  return prisma.nominaPeriodo.findUnique({
    where: { id },
    include: { archivos: true, contrato: true, empleado: { select: { id: true, nombre: true, apellido: true } } },
  })
}

/**
 * Resolve calc fields for create/update.
 * qa-session-jul-24 R7: branch on tipoContrato:
 *   - OPS: existing rule (mediasJornadas * valorJornada - aportes).
 *   - non-OPS (OBRA_O_LABOR / TERMINO_FIJO / TERMINO_INDEFINIDO):
 *       totalPagado = valorMensual - aportesSociales.
 *       mediasJornadas/subtotal snapshot may be null (acceptable per D2).
 *
 * Backward compat: existing non-OPS contracts with null valorMensual → treat
 * as 0 so we don't crash; the snapshot remains computable.
 */
async function resolveCalcFields(
  input: Partial<NominaPeriodoInput> & { empleadoId: number; periodo: string },
  tipoContrato: string,
  contratoValorJornada: unknown,
  contratoValorMensual: unknown = null,
): Promise<{
  mediasJornadas: number | null
  valorJornada: number | null
  subtotalCalculado: number | null
  aportesSociales: number
  totalPagado: number | null
  salario: number | null
  valorMensual: number | null
}> {
  const aportes = input.aportesSociales ?? 0
  if (aportes > 0 && !APORTES_ALLOWED.has(tipoContrato)) {
    throw Object.assign(
      new Error('Aportes sociales no aplican para este tipo de contrato'),
      { status: 400, field: 'aportesSociales' },
    )
  }

  const isNonOps = tipoContrato !== 'OPS'

  let medias: number | null
  if (input.mediasJornadas !== undefined && input.mediasJornadas !== null) {
    medias = input.mediasJornadas
  } else if (isNonOps) {
    // non-OPS: snapshot is null (asistencia is per-jornada, not monthly).
    medias = null
  } else {
    medias = await sumMediasForEmpleadoPeriodo(input.empleadoId, input.periodo)
  }

  let valor: number | null
  if (input.valorJornada !== undefined && input.valorJornada !== null) {
    valor = input.valorJornada
  } else if (isNonOps) {
    valor = null
  } else {
    valor = toNum(contratoValorJornada)
  }

  const valorMensual: number | null =
    input.valorMensual !== undefined && input.valorMensual !== null
      ? input.valorMensual
      : toNum(contratoValorMensual)

  let subtotal: number | null
  if (input.subtotalCalculado !== undefined && input.subtotalCalculado !== null) {
    subtotal = input.subtotalCalculado
  } else if (isNonOps) {
    // Per contract §4: mediasJornadas/subtotalCalculado snapshot is null for non-OPS.
    subtotal = null
  } else if (medias !== null && valor !== null) {
    subtotal = medias * valor
  } else {
    subtotal = 0
  }

  let total: number | null
  if (input.totalPagado !== undefined && input.totalPagado !== null) {
    total = input.totalPagado
  } else if (isNonOps) {
    // non-OPS: base = valorMensual (treat null as 0 to avoid crash on legacy rows).
    total = (valorMensual ?? 0) + aportes
  } else {
    total = (subtotal ?? 0) + aportes
  }

  // Dual-write: salario = totalPagado when total is set; else keep client salario if provided
  const salario =
    total !== null && total !== undefined
      ? total
      : input.salario !== undefined
        ? input.salario
        : null

  return {
    mediasJornadas: medias,
    valorJornada: valor,
    subtotalCalculado: subtotal,
    aportesSociales: aportes,
    totalPagado: total,
    salario,
    valorMensual,
  }
}

/**
 * Create a NominaPeriodo row with attendance-based calc defaults.
 */
export async function createNominaPeriodo(input: NominaPeriodoInput, userId: number): Promise<any> {
  const prisma = getPrisma()
  const [y, m] = input.periodo.split('-')
  const periodo = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1))

  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const contrato = await tx.contrato.findFirst({
        where: { empleadoId: input.empleadoId, activo: true },
      })
      if (!contrato) {
        throw Object.assign(new Error('El empleado no tiene contrato activo'), { status: 400 })
      }

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

      const calc = await resolveCalcFields(input, contrato.tipoContrato, contrato.valorJornada, contrato.valorMensual)

      const row = await tx.nominaPeriodo.create({
        data: {
          empleadoId: input.empleadoId,
          contratoId: contrato.id,
          periodo,
          tipoContrato: contrato.tipoContrato,
          salario: calc.salario,
          notas: input.notas ?? null,
          mediasJornadas: calc.mediasJornadas,
          valorJornada: calc.valorJornada,
          subtotalCalculado: calc.subtotalCalculado,
          aportesSociales: calc.aportesSociales,
          totalPagado: calc.totalPagado,
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
  const existing = await prisma.nominaPeriodo.findUnique({
    where: { id },
    include: { contrato: true },
  })
  if (!existing) throw Object.assign(new Error('NominaPeriodo not found'), { status: 404 })

  // periodo stored as Date — convert to YYYY-MM for asistencia sum
  const d = existing.periodo
  const periodoYYYYMM = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (input.archivos !== undefined) {
      // D4: if replacing archivos on OPS/OBRA, still require cuenta cobro
      const tipo = existing.tipoContrato
      const requiresCuentaCobro = tipo === 'OPS' || tipo === 'OBRA_O_LABOR'
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

    const calcTouched =
      input.mediasJornadas !== undefined ||
      input.valorJornada !== undefined ||
      input.subtotalCalculado !== undefined ||
      input.aportesSociales !== undefined ||
      input.totalPagado !== undefined ||
      input.salario !== undefined

    const data: Record<string, unknown> = {}
    if (input.notas !== undefined) data.notas = input.notas

    if (calcTouched) {
      const mergedInput: NominaPeriodoInput = {
        empleadoId: existing.empleadoId,
        periodo: periodoYYYYMM,
        mediasJornadas:
          input.mediasJornadas !== undefined
            ? input.mediasJornadas
            : toNum(existing.mediasJornadas) ?? undefined,
        valorJornada:
          input.valorJornada !== undefined
            ? input.valorJornada
            : toNum(existing.valorJornada) ?? undefined,
        subtotalCalculado:
          input.subtotalCalculado !== undefined
            ? input.subtotalCalculado
            : toNum(existing.subtotalCalculado) ?? undefined,
        aportesSociales:
          input.aportesSociales !== undefined
            ? input.aportesSociales
            : toNum(existing.aportesSociales) ?? 0,
        totalPagado:
          input.totalPagado !== undefined
            ? input.totalPagado
            : toNum(existing.totalPagado) ?? undefined,
        salario: input.salario,
      }
      const calc = await resolveCalcFields(
        mergedInput,
        existing.tipoContrato,
        existing.contrato?.valorJornada ?? existing.valorJornada,
        existing.contrato?.valorMensual ?? null,
      )
      data.mediasJornadas = calc.mediasJornadas
      data.valorJornada = calc.valorJornada
      data.subtotalCalculado = calc.subtotalCalculado
      data.aportesSociales = calc.aportesSociales
      data.totalPagado = calc.totalPagado
      data.salario = calc.salario
    } else if (input.salario !== undefined) {
      data.salario = input.salario
    }

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
