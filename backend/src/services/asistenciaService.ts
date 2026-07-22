import { getPrisma } from '../config/database.js'

export interface AsistenciaItemInput {
  empleadoId: number
  jornadaAm: boolean
  jornadaPm: boolean
  notas?: string | null
}

export interface PutDiaInput {
  fecha: string // YYYY-MM-DD
  items: AsistenciaItemInput[]
}

function parseDateOnly(yyyyMmDd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd)
  if (!m) {
    throw Object.assign(new Error('fecha debe tener formato YYYY-MM-DD'), { status: 400, field: 'fecha' })
  }
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  return new Date(Date.UTC(y, mo - 1, d))
}

function periodBounds(periodoYYYYMM: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(periodoYYYYMM)
  if (!m) {
    throw Object.assign(new Error('periodo debe tener formato YYYY-MM'), { status: 400, field: 'periodo' })
  }
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const start = new Date(Date.UTC(y, mo - 1, 1))
  const end = new Date(Date.UTC(y, mo, 1)) // exclusive
  return { start, end }
}

export function mediasFromFlags(jornadaAm: boolean, jornadaPm: boolean): number {
  return (jornadaAm ? 1 : 0) + (jornadaPm ? 1 : 0)
}

/**
 * Sum medias jornadas for one empleado in a calendar month (YYYY-MM).
 */
export async function sumMediasForEmpleadoPeriodo(
  empleadoId: number,
  periodoYYYYMM: string,
): Promise<number> {
  const prisma = getPrisma()
  const { start, end } = periodBounds(periodoYYYYMM)
  const rows = await prisma.asistenciaEmpleado.findMany({
    where: {
      empleadoId,
      fecha: { gte: start, lt: end },
    },
    select: { jornadaAm: true, jornadaPm: true },
  })
  return rows.reduce((acc, r) => acc + mediasFromFlags(r.jornadaAm, r.jornadaPm), 0)
}

/**
 * GET /asistencia?fecha=YYYY-MM-DD
 * All ACTIVO employees + that day's flags (synthetic false if none).
 */
export async function getAsistenciaDia(fechaYYYYMMDD: string) {
  const prisma = getPrisma()
  const fecha = parseDateOnly(fechaYYYYMMDD)

  const [empleados, asistencias] = await Promise.all([
    prisma.empleado.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        apellido: true,
        numeroDocumento: true,
        estado: true,
      },
    }),
    prisma.asistenciaEmpleado.findMany({
      where: { fecha },
    }),
  ])

  const byEmp = new Map(asistencias.map((a) => [a.empleadoId, a]))

  return empleados.map((e) => {
    const row = byEmp.get(e.id)
    return {
      id: row?.id ?? null,
      empleadoId: e.id,
      fecha: fechaYYYYMMDD,
      jornadaAm: row?.jornadaAm ?? false,
      jornadaPm: row?.jornadaPm ?? false,
      notas: row?.notas ?? null,
      empleado: e,
    }
  })
}

/**
 * PUT /asistencia/dia — batch upsert.
 */
export async function putAsistenciaDia(input: PutDiaInput, userId: number) {
  const prisma = getPrisma()
  const fecha = parseDateOnly(input.fecha)

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw Object.assign(new Error('items es requerido y no puede estar vacío'), {
      status: 400,
      field: 'items',
    })
  }

  const results = await prisma.$transaction(
    input.items.map((item) =>
      prisma.asistenciaEmpleado.upsert({
        where: {
          empleadoId_fecha: {
            empleadoId: item.empleadoId,
            fecha,
          },
        },
        create: {
          empleadoId: item.empleadoId,
          fecha,
          jornadaAm: !!item.jornadaAm,
          jornadaPm: !!item.jornadaPm,
          notas: item.notas ?? null,
          registradoPor: userId,
        },
        update: {
          jornadaAm: !!item.jornadaAm,
          jornadaPm: !!item.jornadaPm,
          notas: item.notas ?? null,
          registradoPor: userId,
        },
      }),
    ),
  )

  return results
}

/**
 * GET /asistencia/resumen?periodo=YYYY-MM&empleadoId?
 */
export async function getAsistenciaResumen(periodoYYYYMM: string, empleadoId?: number) {
  const prisma = getPrisma()
  const { start, end } = periodBounds(periodoYYYYMM)

  const where: { fecha: { gte: Date; lt: Date }; empleadoId?: number } = {
    fecha: { gte: start, lt: end },
  }
  if (empleadoId !== undefined && !Number.isNaN(empleadoId)) {
    where.empleadoId = empleadoId
  }

  const rows = await prisma.asistenciaEmpleado.findMany({
    where,
    select: { empleadoId: true, jornadaAm: true, jornadaPm: true },
  })

  const map = new Map<number, number>()
  for (const r of rows) {
    const prev = map.get(r.empleadoId) ?? 0
    map.set(r.empleadoId, prev + mediasFromFlags(r.jornadaAm, r.jornadaPm))
  }

  return Array.from(map.entries()).map(([eid, mediasJornadas]) => ({
    empleadoId: eid,
    mediasJornadas,
    horas: mediasJornadas * 4,
  }))
}
