/**
 * jul-9 D2: Repeatable Educación rows per empleado.
 *
 * Pattern follows contract §3: GET/POST/PATCH/DELETE under
 * /api/v1/empleados/:empleadoId/educacion[/...].
 * Service-throws-Error pattern (routes catch .message === 'Not found').
 */

import { getPrisma } from '../config/database.js'

export interface CreateEducacionInput {
  profesion: string
  universidad?: string | null
  fechaGraduacion?: string | null
  diplomaUrl?: string | null
}

export type UpdateEducacionInput = Partial<CreateEducacionInput>

export async function listEducacion(empleadoId: number) {
  const prisma = getPrisma()
  // Confirm empleado exists so the route can return 404 cleanly when none
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    select: { id: true },
  })
  if (!emp) throw new Error('Empleado not found')
  return prisma.educacionEmpleado.findMany({
    where: { empleadoId },
    orderBy: [{ createdAt: 'asc' }],
  })
}

export async function createEducacion(empleadoId: number, input: CreateEducacionInput) {
  const prisma = getPrisma()
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    select: { id: true },
  })
  if (!emp) throw new Error('Empleado not found')
  return prisma.educacionEmpleado.create({
    data: {
      empleadoId,
      profesion: input.profesion,
      universidad: input.universidad ?? null,
      fechaGraduacion: input.fechaGraduacion ? new Date(input.fechaGraduacion) : null,
      diplomaUrl: input.diplomaUrl ?? null,
    },
  })
}

export async function updateEducacion(
  empleadoId: number,
  educacionId: number,
  input: UpdateEducacionInput,
) {
  const prisma = getPrisma()
  const row = await prisma.educacionEmpleado.findFirst({
    where: { id: educacionId, empleadoId },
  })
  if (!row) throw new Error('EducacionEmpleado not found')

  const data: Record<string, unknown> = {}
  if (input.profesion !== undefined) data.profesion = input.profesion
  if (input.universidad !== undefined) data.universidad = input.universidad
  if (input.diplomaUrl !== undefined) data.diplomaUrl = input.diplomaUrl
  if (input.fechaGraduacion !== undefined) {
    data.fechaGraduacion = input.fechaGraduacion ? new Date(input.fechaGraduacion) : null
  }

  return prisma.educacionEmpleado.update({ where: { id: educacionId }, data })
}

export async function deleteEducacion(empleadoId: number, educacionId: number): Promise<void> {
  const prisma = getPrisma()
  const row = await prisma.educacionEmpleado.findFirst({
    where: { id: educacionId, empleadoId },
  })
  if (!row) throw new Error('EducacionEmpleado not found')
  await prisma.educacionEmpleado.delete({ where: { id: educacionId } })
}
