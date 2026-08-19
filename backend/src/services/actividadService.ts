/**
 * actividadService — qa-session-aug-17 R6 / contract §4.
 *
 * Service-layer rules (NOT matrix cells — contract D7):
 *   - Own-item filter for PROFESORES / AUXILIARES
 *   - Today-only write (America/Bogotá) for those tipos
 *   - ADMIN any-date / any-empleado
 *   - EMPLEADO_REQUIRED when writer has no Usuario.empleadoId
 */

import { getPrisma } from '../config/database.js'
import { serverTodayBogota } from '../utils/dateBogota.js'

export interface ActividadCaller {
  userId: number
  rol: string
  tipoEmpleado: string | null
  /** From Usuario.empleadoId — may be null. */
  empleadoId: number | null
}

export interface CreateActividadInput {
  fecha: string // YYYY-MM-DD
  texto: string
  empleadoId?: number
}

export interface UpdateActividadInput {
  texto?: string
  fecha?: string // YYYY-MM-DD
}

export interface RegistroActividadDto {
  id: number
  empleadoId: number
  fecha: string
  texto: string
  registradoPor: number
  createdAt: string
  updatedAt: string
}

function toDateOnly(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map((n) => parseInt(n, 10))
  return new Date(Date.UTC(y, m - 1, d))
}

function formatFecha(d: Date): string {
  // Stored as @db.Date — Prisma returns midnight UTC; format as YYYY-MM-DD UTC.
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toDto(row: {
  id: number
  empleadoId: number
  fecha: Date
  texto: string
  registradoPor: number
  createdAt: Date
  updatedAt: Date
}): RegistroActividadDto {
  return {
    id: row.id,
    empleadoId: row.empleadoId,
    fecha: formatFecha(row.fecha),
    texto: row.texto,
    registradoPor: row.registradoPor,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function isOwnOnlyWriter(caller: ActividadCaller): boolean {
  return (
    caller.rol !== 'ADMIN' &&
    (caller.tipoEmpleado === 'PROFESORES' || caller.tipoEmpleado === 'AUXILIARES')
  )
}

/**
 * Resolve caller's linked empleadoId from DB when not already on the request.
 */
export async function loadCallerEmpleadoId(userId: number): Promise<number | null> {
  const prisma = getPrisma()
  const u = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { empleadoId: true },
  })
  return u?.empleadoId ?? null
}

export async function listActividades(
  caller: ActividadCaller,
  query: { fecha?: string; empleadoId?: number },
): Promise<RegistroActividadDto[]> {
  const prisma = getPrisma()
  const where: Record<string, unknown> = {}

  if (query.fecha) {
    where.fecha = toDateOnly(query.fecha)
  }

  if (isOwnOnlyWriter(caller)) {
    if (caller.empleadoId == null) {
      throw Object.assign(new Error('Empleado requerido'), {
        status: 400,
        code: 'EMPLEADO_REQUIRED',
      })
    }
    // Force own-item; ignore (or could 403) foreign query param.
    if (query.empleadoId !== undefined && query.empleadoId !== caller.empleadoId) {
      throw Object.assign(new Error('Acceso no permitido para su perfil'), {
        status: 403,
        code: 'DOMAIN_FORBIDDEN',
      })
    }
    where.empleadoId = caller.empleadoId
  } else if (query.empleadoId !== undefined) {
    where.empleadoId = query.empleadoId
  }

  const rows = await prisma.registroActividad.findMany({
    where,
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  })
  return rows.map(toDto)
}

export async function createActividad(
  caller: ActividadCaller,
  input: CreateActividadInput,
): Promise<RegistroActividadDto> {
  const prisma = getPrisma()
  const texto = (input.texto ?? '').trim()
  if (!texto) {
    throw Object.assign(new Error('texto es requerido'), {
      status: 400,
      field: 'texto',
    })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    throw Object.assign(new Error('fecha must be YYYY-MM-DD'), {
      status: 400,
      field: 'fecha',
    })
  }

  let targetEmpleadoId: number | null = null

  if (isOwnOnlyWriter(caller)) {
    if (caller.empleadoId == null) {
      throw Object.assign(new Error('Empleado requerido'), {
        status: 400,
        code: 'EMPLEADO_REQUIRED',
      })
    }
    if (input.empleadoId !== undefined && input.empleadoId !== caller.empleadoId) {
      throw Object.assign(new Error('Acceso no permitido para su perfil'), {
        status: 403,
        code: 'DOMAIN_FORBIDDEN',
      })
    }
    targetEmpleadoId = caller.empleadoId

    const today = serverTodayBogota()
    if (input.fecha !== today) {
      throw Object.assign(new Error('Solo puede registrar la fecha de hoy'), {
        status: 403,
        code: 'DOMAIN_FORBIDDEN',
      })
    }
  } else if (caller.rol === 'ADMIN') {
    // Prefer explicit body.empleadoId; fall back to admin's own link if present.
    if (input.empleadoId !== undefined && input.empleadoId !== null) {
      targetEmpleadoId = input.empleadoId
    } else if (caller.empleadoId != null) {
      targetEmpleadoId = caller.empleadoId
    } else {
      throw Object.assign(new Error('Empleado requerido'), {
        status: 400,
        code: 'EMPLEADO_REQUIRED',
      })
    }
  } else {
    // Other roles that somehow pass matrix (should not for POST) — still require link.
    if (caller.empleadoId == null) {
      throw Object.assign(new Error('Empleado requerido'), {
        status: 400,
        code: 'EMPLEADO_REQUIRED',
      })
    }
    targetEmpleadoId = caller.empleadoId
  }

  try {
    const row = await prisma.registroActividad.create({
      data: {
        empleadoId: targetEmpleadoId!,
        fecha: toDateOnly(input.fecha),
        texto,
        registradoPor: caller.userId,
      },
    })
    return toDto(row)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw Object.assign(new Error('Ya existe un registro para este día'), {
        status: 409,
        code: 'DUPLICATE_DAY',
      })
    }
    throw e
  }
}

export async function updateActividad(
  id: number,
  input: UpdateActividadInput,
): Promise<RegistroActividadDto> {
  const prisma = getPrisma()
  const existing = await prisma.registroActividad.findUnique({ where: { id } })
  if (!existing) {
    throw Object.assign(new Error('Registro de actividad not found'), { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (input.texto !== undefined) {
    const texto = input.texto.trim()
    if (!texto) {
      throw Object.assign(new Error('texto es requerido'), {
        status: 400,
        field: 'texto',
      })
    }
    data.texto = texto
  }
  if (input.fecha !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
      throw Object.assign(new Error('fecha must be YYYY-MM-DD'), {
        status: 400,
        field: 'fecha',
      })
    }
    data.fecha = toDateOnly(input.fecha)
  }

  try {
    const row = await prisma.registroActividad.update({ where: { id }, data })
    return toDto(row)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw Object.assign(new Error('Ya existe un registro para este día'), {
        status: 409,
        code: 'DUPLICATE_DAY',
      })
    }
    throw e
  }
}

export async function deleteActividad(id: number): Promise<void> {
  const prisma = getPrisma()
  try {
    await prisma.registroActividad.delete({ where: { id } })
  } catch (e: any) {
    if (e?.code === 'P2025') {
      throw Object.assign(new Error('Registro de actividad not found'), { status: 404 })
    }
    throw e
  }
}
