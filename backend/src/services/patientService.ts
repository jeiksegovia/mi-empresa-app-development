import { getPrisma } from '../config/database.js'
import {
  validateAndScore,
  type Respuestas,
  type InstrumentDefinition,
  InstrumentScoringError,
} from './instrumentScoringService.js'

/**
 * jul-10 C4 (decision D-C4): lazy PENDIENTE → VENCIDO flip.
 * No cron — fired inside read paths that surface ficha estado (getPatient,
 * listFichasVencimientos). Idempotent; runs in ONE bulk updateMany (not per-row).
 *
 * @param prisma   the Prisma client (any — passed so callers can share their tx or keep no-op elsewhere)
 * @param clienteId optional — flip only one patient's fichas; otherwise flip across all patients
 * @param now     override for testability (defaults to wall clock)
 * @returns       number of rows flipped
 */
export async function flipExpiredFichas(
  prisma: ReturnType<typeof getPrisma>,
  clienteId?: number,
  now: Date = new Date()
): Promise<number> {
  const where: Record<string, unknown> = {
    estado: 'PENDIENTE',
    fechaVencimiento: { lt: now },
  }
  if (clienteId !== undefined) where.clienteId = clienteId

  const result = await prisma.registroFichaCompletada.updateMany({
    where,
    data: { estado: 'VENCIDO' },
  })

  return result.count
}

export interface PatientListParams {
  page?: number
  limit?: number
  search?: string
  estado?: 'ACTIVO' | 'INACTIVO'
}

export interface PatientSummary {
  id: number
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  fechaNacimiento: Date
  genero: string
  telefono: string | null
  email: string | null
  estado: string
  fechaIngreso: Date
  totalFichas: number
  fichasPendientes: number
}

export interface PatientListResult {
  data: PatientSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PatientDetail {
  id: number
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  fechaNacimiento: Date
  genero: string
  telefono: string | null
  email: string | null
  estado: string
  fechaIngreso: Date
  notas: string | null
  informacionSeguro: string | null
  observacionesEspeciales: string | null
  // jul-9 B3/B4/B5
  fechaCumpleanos: Date | null
  tipoSangre: string | null
  eps: string | null
  contactosEmergencia: Array<{
    id: number
    nombre: string
    telefono: string
    parentesco: string
  }>
  registrosFichas: Array<{
    id: number
    estado: string
    fechaCompletado: Date | null
    fechaVencimiento: Date | null
    instrumento: {
      id: number
      nombreInstrumento: string
      tipo: string
    }
  }>
  notasCliente: Array<{
    id: number
    contenido: string
    tipo: string
    prioridad: string
    fechaCreacion: Date
    // jul-9 B1
    fechaIncidente: Date
  }>
}

export interface CreatePatientInput {
  nombre: string
  tipoDocumento: 'CC' | 'CE' | 'PASAPORTE' | 'REGISTRO_CIVIL'
  numeroDocumento: string
  fechaNacimiento: string | Date
  genero: string
  telefono?: string
  email?: string
  estado?: 'ACTIVO' | 'INACTIVO'
  notas?: string
  informacionSeguro?: string
  observacionesEspeciales?: string
  // jul-9 B3/B4/B5
  fechaCumpleanos?: string | Date
  tipoSangre?: 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG' | 'O_POS' | 'O_NEG'
  eps?: string
  contactosEmergencia?: Array<{
    nombre: string
    telefono: string
    parentesco: string
  }>
}

export type UpdatePatientInput = Partial<Omit<CreatePatientInput, 'contactosEmergencia'>>

const ALL_RELATIONS = {
  contactosEmergencia: true,
  registrosFichas: {
    include: {
      instrumento: {
        select: {
          id: true,
          nombreInstrumento: true,
          tipo: true,
        },
      },
    },
  },
  notasCliente: {
    orderBy: { fecha: 'desc' as const },
  },
}

export async function listPatients(params: PatientListParams): Promise<PatientListResult> {
  const prisma = getPrisma()
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (params.estado) {
    where.estado = params.estado
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim()
    where.OR = [
      { nombre: { contains: term, mode: 'insensitive' } },
      { numeroDocumento: { contains: term, mode: 'insensitive' } },
    ]
  }

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fechaIngreso: 'desc' },
      include: {
        _count: {
          select: {
            registrosFichas: true,
          },
        },
        registrosFichas: {
          where: { estado: 'PENDIENTE' },
          select: { id: true },
        },
      },
    }),
    prisma.cliente.count({ where }),
  ])

  const data: PatientSummary[] = clientes.map((cliente) => ({
    id: cliente.id,
    nombre: cliente.nombre,
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    fechaNacimiento: cliente.fechaNacimiento,
    genero: cliente.genero,
    telefono: cliente.telefono,
    email: cliente.email,
    estado: cliente.estado,
    fechaIngreso: cliente.fechaIngreso,
    totalFichas: cliente._count.registrosFichas,
    fichasPendientes: cliente.registrosFichas.length,
  }))

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getPatient(id: number): Promise<PatientDetail | null> {
  const prisma = getPrisma()

  // jul-10 C4: lazy flip PENDIENTE→VENCIDO before reading this patient's fichas.
  // One extra bulk updateMany; then read normally — the relation include
  // now reflects the flipped estado.
  await flipExpiredFichas(prisma, id)

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: ALL_RELATIONS,
  })

  if (!cliente) return null

  return {
    id: cliente.id,
    nombre: cliente.nombre,
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    fechaNacimiento: cliente.fechaNacimiento,
    genero: cliente.genero,
    telefono: cliente.telefono,
    email: cliente.email,
    estado: cliente.estado,
    fechaIngreso: cliente.fechaIngreso,
    notas: cliente.notas,
    informacionSeguro: cliente.informacionSeguro,
    observacionesEspeciales: cliente.observacionesEspeciales,
    fechaCumpleanos: cliente.fechaCumpleanos,
    tipoSangre: cliente.tipoSangre,
    eps: cliente.eps,
    contactosEmergencia: cliente.contactosEmergencia.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      parentesco: c.parentesco,
    })),
    registrosFichas: (cliente.registrosFichas as any[]).map((r) => ({
      id: r.id,
      estado: r.estado,
      fechaCompletado: r.fechaCompletado,
      fechaVencimiento: r.fechaVencimiento,
      // W4: archivoCompletado REMOVED (file-flow gone). Historial surfaces the
      // ficha in scoring-result view via GET /patients/:id/fichas/:fichaId instead.
      instrumento: {
        id: r.instrumento.id,
        nombreInstrumento: r.instrumento.nombreInstrumento,
        tipo: r.instrumento.tipo,
      },
    })),
    notasCliente: cliente.notasCliente.map((n) => ({
      id: n.id,
      contenido: n.contenido,
      tipo: n.tipoNota,
      prioridad: n.prioridad,
      fechaCreacion: n.fecha,
      fechaIncidente: n.fechaIncidente,
    })),
  }
}

export async function createPatient(input: CreatePatientInput): Promise<PatientDetail> {
  const prisma = getPrisma()

  const { contactosEmergencia, fechaCumpleanos, tipoSangre, eps, ...baseFields } = input

  const cliente = await prisma.cliente.create({
    data: {
      ...baseFields,
      fechaNacimiento: new Date(baseFields.fechaNacimiento),
      tipoDocumento: baseFields.tipoDocumento as any,
      estado: (baseFields.estado ?? 'ACTIVO') as any,
      ...(fechaCumpleanos ? { fechaCumpleanos: new Date(fechaCumpleanos) } : {}),
      ...(tipoSangre ? { tipoSangre: tipoSangre as any } : {}),
      ...(eps ? { eps } : {}),
      ...(contactosEmergencia && contactosEmergencia.length > 0
        ? {
            contactosEmergencia: {
              create: contactosEmergencia,
            },
          }
        : {}),
    },
    include: ALL_RELATIONS,
  })

  return {
    id: cliente.id,
    nombre: cliente.nombre,
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    fechaNacimiento: cliente.fechaNacimiento,
    genero: cliente.genero,
    telefono: cliente.telefono,
    email: cliente.email,
    estado: cliente.estado,
    fechaIngreso: cliente.fechaIngreso,
    notas: cliente.notas,
    informacionSeguro: cliente.informacionSeguro,
    observacionesEspeciales: cliente.observacionesEspeciales,
    fechaCumpleanos: cliente.fechaCumpleanos,
    tipoSangre: cliente.tipoSangre,
    eps: cliente.eps,
    contactosEmergencia: cliente.contactosEmergencia.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      parentesco: c.parentesco,
    })),
    registrosFichas: (cliente.registrosFichas as any[]).map((r) => ({
      id: r.id,
      estado: r.estado,
      fechaCompletado: r.fechaCompletado,
      fechaVencimiento: r.fechaVencimiento,
      // W4: archivoCompletado REMOVED (file-flow gone). Historial surfaces the
      // ficha in scoring-result view via GET /patients/:id/fichas/:fichaId instead.
      instrumento: {
        id: r.instrumento.id,
        nombreInstrumento: r.instrumento.nombreInstrumento,
        tipo: r.instrumento.tipo,
      },
    })),
    notasCliente: cliente.notasCliente.map((n) => ({
      id: n.id,
      contenido: n.contenido,
      tipo: n.tipoNota,
      prioridad: n.prioridad,
      fechaCreacion: n.fecha,
      fechaIncidente: n.fechaIncidente,
    })),
  }
}

export async function updatePatient(id: number, input: UpdatePatientInput): Promise<PatientDetail> {
  const prisma = getPrisma()

  const existing = await prisma.cliente.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Patient not found')
  }

  const updateData: Record<string, unknown> = { ...input }

  if (input.fechaNacimiento) {
    updateData.fechaNacimiento = new Date(input.fechaNacimiento)
  }

  if (input.fechaCumpleanos) {
    updateData.fechaCumpleanos = new Date(input.fechaCumpleanos)
  }

  if (input.tipoDocumento) {
    updateData.tipoDocumento = input.tipoDocumento as any
  }

  if (input.estado) {
    updateData.estado = input.estado as any
  }

  if (input.tipoSangre) {
    updateData.tipoSangre = input.tipoSangre as any
  }

  const cliente = await prisma.cliente.update({
    where: { id },
    data: updateData,
    include: ALL_RELATIONS,
  })

  return {
    id: cliente.id,
    nombre: cliente.nombre,
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    fechaNacimiento: cliente.fechaNacimiento,
    genero: cliente.genero,
    telefono: cliente.telefono,
    email: cliente.email,
    estado: cliente.estado,
    fechaIngreso: cliente.fechaIngreso,
    notas: cliente.notas,
    informacionSeguro: cliente.informacionSeguro,
    observacionesEspeciales: cliente.observacionesEspeciales,
    fechaCumpleanos: cliente.fechaCumpleanos,
    tipoSangre: cliente.tipoSangre,
    eps: cliente.eps,
    contactosEmergencia: cliente.contactosEmergencia.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      parentesco: c.parentesco,
    })),
    registrosFichas: (cliente.registrosFichas as any[]).map((r) => ({
      id: r.id,
      estado: r.estado,
      fechaCompletado: r.fechaCompletado,
      fechaVencimiento: r.fechaVencimiento,
      // W4: archivoCompletado REMOVED (file-flow gone). Historial surfaces the
      // ficha in scoring-result view via GET /patients/:id/fichas/:fichaId instead.
      instrumento: {
        id: r.instrumento.id,
        nombreInstrumento: r.instrumento.nombreInstrumento,
        tipo: r.instrumento.tipo,
      },
    })),
    notasCliente: cliente.notasCliente.map((n) => ({
      id: n.id,
      contenido: n.contenido,
      tipo: n.tipoNota,
      prioridad: n.prioridad,
      fechaCreacion: n.fecha,
      fechaIncidente: n.fechaIncidente,
    })),
  }
}

export async function deletePatient(id: number): Promise<void> {
  const prisma = getPrisma()

  const existing = await prisma.cliente.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Patient not found')
  }

  await prisma.cliente.update({
    where: { id },
    data: { estado: 'INACTIVO' },
  })
}

// jul-10 C7: weekly vencimientos report
export interface FichaVencimientoSummary {
  id: number
  clienteId: number
  clienteNombre: string
  instrumentoId: number
  instrumentoNombre: string
  instrumentoTipo: string
  estado: string
  fechaVencimiento: Date
  fechaCompletado: Date | null
  diasHastaVencimiento: number
}

export interface FichasVencimientoResult {
  generatedAt: Date
  windowDays: number
  total: number
  data: FichaVencimientoSummary[]
}

/**
 * jul-10 C4 + C7: list fiches due/overdue within `days`.
 *  - Runs the lazy flip first so estados are truthful (VENCIDO, not stale PENDIENTE).
 *  - Returns fichas with estado ∈ {PENDIENTE, VENCIDO} AND fechaVencimiento <= today+days.
 *  - Ordered by fechaVencimiento asc (most overdue first).
 */
export async function listFichasVencimientos(days: number = 7): Promise<FichasVencimientoResult> {
  const prisma = getPrisma()
  const now = new Date()
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + Math.max(0, days))

  // jul-10 C4: lazy flip BEFORE the read so the report never carries stale PENDIENTE rows.
  await flipExpiredFichas(prisma, undefined, now)

  const records = await prisma.registroFichaCompletada.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'VENCIDO'] },
      fechaVencimiento: { lte: horizon },
    },
    orderBy: { fechaVencimiento: 'asc' },
    include: {
      cliente: { select: { id: true, nombre: true } },
      instrumento: {
        select: { id: true, nombreInstrumento: true, tipo: true },
      },
    },
  })

  const data: FichaVencimientoSummary[] = records.map((r) => {
    const due = r.fechaVencimiento!
    const diffMs = due.getTime() - now.getTime()
    const diasHastaVencimiento = Math.round(diffMs / (1000 * 60 * 60 * 24))
    return {
      id: r.id,
      clienteId: r.clienteId,
      clienteNombre: r.cliente.nombre,
      instrumentoId: r.instrumento.id,
      instrumentoNombre: r.instrumento.nombreInstrumento,
      instrumentoTipo: r.instrumento.tipo,
      estado: r.estado,
      fechaVencimiento: due,
      fechaCompletado: r.fechaCompletado,
      diasHastaVencimiento,
    }
  })

  return {
    generatedAt: now,
    windowDays: days,
    total: data.length,
    data,
  }
}

// ---------------------------------------------------------------------------
// W4 §4.3 / §4.3b / §4.4 — fichas with dynamic answers.
//
// Two write paths and one read path:
//
//   - createFichaAtomic: POST /patients/:id/fichas
//       - respuestas absent → PENDIENTE (assign only, no scoring).
//       - respuestas present → validate + score + persist as COMPLETADO.
//
//   - completeFichaAtomic: PATCH /patients/:id/fichas/:fichaId/completar
//       - PENDIENTE or VENCIDO → COMPLETADO with validated/scored answers.
//       - already COMPLETADO → throws InvalidStateError.
//
//   - getFicha: GET /patients/:id/fichas/:fichaId
//       - response shape includes respuestas, subtotales, puntajeTotal,
//         clasificacion, skippedSections, instrumentoVersion.
//
// All three return the same response shape (`FichaDetailResponse`) so W3's
// renderer does not have to branch on the endpoint.
// ---------------------------------------------------------------------------

export interface CreateFichaInput {
  instrumentoId: number
  /** Optional explicit version id; if omitted, the currently active version is used. */
  instrumentoVersionId?: number
  /**
   * OPTIONAL (G2-12, 2026-07-17): clients SHOULD omit this. The service derives
   * it server-side as `v{version}` (e.g., `"v1"`) from the resolved active
   * version. If a client does send it, the value is honored (backward compat).
   */
  versionRegistro?: string
  /** W4: respuestas is OPTIONAL — absent → PENDIENTE assign; present → COMPLETADO. */
  respuestas?: Respuestas
  notasObservaciones?: string
  fechaVencimiento?: string
}

export interface CompleteFichaInput {
  respuestas: Respuestas
  notasObservaciones?: string
}

export interface FichaDetailResponse {
  id: number
  clienteId: number
  instrumentoId: number
  instrumentoVersionId: number | null
  estado: 'PENDIENTE' | 'COMPLETADO' | 'VENCIDO'
  fechaCompletado: Date | null
  fechaVencimiento: Date | null
  versionRegistro: string
  responsable: { id: number; nombre: string; apellido: string } | number
  notasObservaciones: string | null
  respuestas: Respuestas | null
  subtotales: Record<string, number> | null
  puntajeTotal: number | null
  clasificacion: string | null
  skippedSections: string[]
}

export class InvalidStateError extends Error {
  readonly code: 'INVALID_STATE'
  constructor(message: string) {
    super(message)
    this.name = 'InvalidStateError'
    this.code = 'INVALID_STATE'
  }
}

function calcularFechaVencimientoFromPeriodicidad(periodicidad: string, desde: Date): Date | null {
  const d = new Date(desde)
  switch (periodicidad) {
    case 'MENSUAL':
      d.setMonth(d.getMonth() + 1)
      return d
    case 'TRIMESTRAL':
      d.setMonth(d.getMonth() + 3)
      return d
    case 'SEMESTRAL':
      d.setMonth(d.getMonth() + 6)
      return d
    case 'ANUAL':
      d.setFullYear(d.getFullYear() + 1)
      return d
    case 'UNICA':
    default:
      return null
  }
}

async function loadActiveVersion(
  prisma: ReturnType<typeof getPrisma>,
  instrumentoId: number,
): Promise<{ id: number; version: number; definition: InstrumentDefinition; periodicidad: string }> {
  const inst = await prisma.instrumento.findUnique({
    where: { id: instrumentoId },
    select: { periodicidad: true },
  })
  if (!inst) {
    throw new Error('Instrument not found')
  }
  const version = await prisma.instrumentoVersion.findFirst({
    where: { instrumentoId, activo: true },
  })
  if (!version) {
    throw new Error('NO_ACTIVE_VERSION')
  }
  return {
    id: version.id,
    version: version.version,
    definition: version.definition as unknown as InstrumentDefinition,
    periodicidad: inst.periodicidad,
  }
}

async function buildFichaResponse(
  prisma: ReturnType<typeof getPrisma>,
  fichaRow: Awaited<ReturnType<typeof prisma.registroFichaCompletada.findUnique>>,
): Promise<FichaDetailResponse | null> {
  if (!fichaRow) return null
  // Hydrate the responsible usuario's display name (the field is still an FK
  // integer per the schema; the response surfaces a small summary for W3).
  let responsableSummary: FichaDetailResponse['responsable'] = fichaRow.responsable
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: fichaRow.responsable },
      select: { id: true, nombre: true, apellido: true },
    })
    if (usuario) {
      responsableSummary = { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido }
    }
  } catch {
    /* leave as the integer fallback */
  }

  return {
    id: fichaRow.id,
    clienteId: fichaRow.clienteId,
    instrumentoId: fichaRow.instrumentoId,
    instrumentoVersionId: fichaRow.instrumentoVersionId,
    estado: fichaRow.estado as FichaDetailResponse['estado'],
    fechaCompletado: fichaRow.fechaCompletado,
    fechaVencimiento: fichaRow.fechaVencimiento,
    versionRegistro: fichaRow.versionRegistro,
    responsable: responsableSummary,
    notasObservaciones: fichaRow.notasObservaciones,
    respuestas: (fichaRow.respuestas as Respuestas | null) ?? null,
    subtotales: (fichaRow.subtotales as Record<string, number> | null) ?? null,
    puntajeTotal: fichaRow.puntajeTotal,
    clasificacion: fichaRow.clasificacion,
    skippedSections: [], // derivable on the fly by the engine; not persisted (contract §5.3 step 6)
  }
}

/**
 * W4 §4.3 — POST /patients/:id/fichas.
 *
 * - respuestas absent → PENDIENTE assign (legacy behavior preserved).
 * - respuestas present → validate + score + persist as COMPLETADO.
 *   - instrumentoVersionId is SERVER-RESOLVED (contract G2-11): any value the
 *     client sends is ignored; we always use the currently active version.
 *     The route still accepts the key in the Zod schema (it's optional) so
 *     W3's payload doesn't trip validation, but the persisted row carries
 *     the resolved id.
 *   - fechaVencimiento is computed from instrumento.periodicidad (UNICA → null).
 *   - skippedSections is computed at score time and is part of the response.
 *
 * Throws `InstrumentScoringError` on validation failure (route maps to 400).
 */
export async function createFichaAtomic(
  patientId: number,
  responsableId: number,
  input: CreateFichaInput,
): Promise<FichaDetailResponse> {
  const prisma = getPrisma()
  const patient = await prisma.cliente.findUnique({ where: { id: patientId } })
  if (!patient) {
    throw new Error('Patient not found')
  }

  // Resolve the InstrumentoVersion up-front so both branches (assign-only and
  // assign+complete) record the same FK row. Per G2-11 the client-supplied
  // version id (if any) is intentionally ignored — the active version wins.
  const { id: resolvedVersionId, version: resolvedVersionNumber, definition, periodicidad } =
    await loadActiveVersion(prisma, input.instrumentoId)

  // G2-12: server-default `versionRegistro` to `v{version}` when the caller omitted it.
  const effectiveVersionRegistro = input.versionRegistro?.trim()
    ? input.versionRegistro
    : `v${resolvedVersionNumber}`

  // Branch A — assign only (legacy PENDIENTE behavior).
  if (!input.respuestas || Object.keys(input.respuestas).length === 0) {
    const now = new Date()
    const ficha = await prisma.registroFichaCompletada.create({
      data: {
        clienteId: patientId,
        instrumentoId: input.instrumentoId,
        instrumentoVersionId: resolvedVersionId,
        estado: 'PENDIENTE',
        versionRegistro: effectiveVersionRegistro,
        responsable: responsableId,
        ...(input.notasObservaciones ? { notasObservaciones: input.notasObservaciones } : {}),
        ...(input.fechaVencimiento
          ? { fechaVencimiento: new Date(input.fechaVencimiento) }
          : { fechaVencimiento: calcularFechaVencimientoFromPeriodicidad(periodicidad, now) }),
      },
    })
    const response = await buildFichaResponse(prisma, ficha)
    if (!response) {
      throw new Error('Failed to load created ficha')
    }
    return response
  }

  // Branch B — single-step assign + complete.
  const scoreResult = validateAndScore(definition, input.respuestas)
  const now = new Date()
  const ficha = await prisma.registroFichaCompletada.create({
    data: {
      clienteId: patientId,
      instrumentoId: input.instrumentoId,
      instrumentoVersionId: resolvedVersionId,
      estado: 'COMPLETADO',
      versionRegistro: effectiveVersionRegistro,
      responsable: responsableId,
      fechaCompletado: now,
      respuestas: input.respuestas as object,
      puntajeTotal: scoreResult.puntajeTotal,
      subtotales: scoreResult.subtotales as object,
      clasificacion: scoreResult.clasificacion,
      ...(input.notasObservaciones ? { notasObservaciones: input.notasObservaciones } : {}),
      ...(input.fechaVencimiento
        ? { fechaVencimiento: new Date(input.fechaVencimiento) }
        : { fechaVencimiento: calcularFechaVencimientoFromPeriodicidad(periodicidad, now) }),
    },
  })
  const response = await buildFichaResponse(prisma, ficha)
  if (!response) {
    throw new Error('Failed to load created ficha')
  }
  response.skippedSections = scoreResult.skippedSections
  return response
}

/**
 * W4 §4.3b — PATCH /patients/:id/fichas/:fichaId/completar.
 *
 * Completes an existing PENDIENTE (or VENCIDO) ficha with answers.
 * - already COMPLETADO → throws InvalidStateError.
 * - validation/scoring happens identically to createFichaAtomic.
 * - instrumentoVersionId is SERVER-RESOLVED (G2-11): the version recorded on
 *   the row at completion time is ALWAYS the currently active version, even
 *   if the row previously held a different value (e.g., a stale v1 → v2 bump).
 *
 * On success, the row is updated in place and the new full response is returned.
 */
export async function completeFichaAtomic(
  patientId: number,
  fichaId: number,
  input: CompleteFichaInput,
): Promise<FichaDetailResponse> {
  const prisma = getPrisma()

  const existing = await prisma.registroFichaCompletada.findFirst({
    where: { id: fichaId, clienteId: patientId },
  })
  if (!existing) {
    throw new Error('Ficha not found')
  }
  if (existing.estado === 'COMPLETADO') {
    throw new InvalidStateError('La ficha ya está en estado COMPLETADO')
  }

  // G2-11: server-resolved active version. We do NOT honor the previously
  // recorded version (it may be stale if the active version was bumped
  // between assign and complete). The active version at completion time wins.
  const { id: versionId, version: resolvedVersionNumber, definition } =
    await loadActiveVersion(prisma, existing.instrumentoId)

  // G2-12: ensure `versionRegistro` reflects the active version (legacy assign
  // rows may predate G2-12; older runs set a hardcoded string. We re-derive
  // from the active version when the row's value is missing/empty.)
  const effectiveVersionRegistro =
    existing.versionRegistro && existing.versionRegistro.trim().length > 0
      ? existing.versionRegistro
      : `v${resolvedVersionNumber}`

  const scoreResult = validateAndScore(definition, input.respuestas)
  const now = new Date()
  const updated = await prisma.registroFichaCompletada.update({
    where: { id: fichaId },
    data: {
      estado: 'COMPLETADO',
      fechaCompletado: now,
      instrumentoVersionId: versionId,
      versionRegistro: effectiveVersionRegistro,
      respuestas: input.respuestas as object,
      puntajeTotal: scoreResult.puntajeTotal,
      subtotales: scoreResult.subtotales as object,
      clasificacion: scoreResult.clasificacion,
      ...(input.notasObservaciones !== undefined
        ? { notasObservaciones: input.notasObservaciones }
        : {}),
    },
  })
  const response = await buildFichaResponse(prisma, updated)
  if (!response) {
    throw new Error('Failed to load completed ficha')
  }
  response.skippedSections = scoreResult.skippedSections
  return response
}

/**
 * W4 §4.4 — GET /patients/:id/fichas/:fichaId (detail).
 * Returns the new response shape including respuestas, scoring fields, and
 * instrumentoVersion metadata.
 */
export async function getFicha(
  patientId: number,
  fichaId: number,
): Promise<FichaDetailResponse | null> {
  const prisma = getPrisma()

  // jul-10 C4: lazy flip — same as getPatient. Keeps the detail response truthful.
  await flipExpiredFichas(prisma, patientId)

  const row = await prisma.registroFichaCompletada.findFirst({
    where: { id: fichaId, clienteId: patientId },
  })
  if (!row) return null
  return buildFichaResponse(prisma, row)
}

/**
 * W4 helper — re-export the scoring error so callers don't need a separate import.
 */
export { InstrumentScoringError }

export interface CreateNoteInput {
  tipo: 'POSITIVA' | 'NEGATIVA' | 'NEUTRAL' | 'ALERTA'
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA'
  contenido: string
  // jul-9 B1: required, must satisfy L3 2-business-day rule (validated upstream in route)
  fechaIncidente: string
}

export async function createNote(
  clienteId: number,
  usuarioId: number,
  input: CreateNoteInput
) {
  const prisma = getPrisma()

  // Verify patient exists
  const patient = await prisma.cliente.findUnique({ where: { id: clienteId } })
  if (!patient) {
    throw new Error('Patient not found')
  }

  return await prisma.notaCliente.create({
    data: {
      clienteId,
      autor: usuarioId,
      tipoNota: input.tipo,
      prioridad: input.prioridad,
      contenido: input.contenido,
      fechaIncidente: new Date(input.fechaIncidente),
    },
  })
}
