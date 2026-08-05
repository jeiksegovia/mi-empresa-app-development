import { getPrisma } from '../config/database.js'

export interface EmpresaDetail {
  id: number
  nombre: string
  nit: string
  direccion: string | null
  telefono: string | null
  email: string | null
  activa: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UpdateEmpresaInput {
  nombre?: string
  nit?: string
  direccion?: string
  telefono?: string
  email?: string
}

export interface CreateEmpresaInput {
  nombre: string
  nit: string
  direccion?: string
  telefono?: string
  email?: string
}

// W6: single-empresa system — must match the 10 cargo seeds from the
// qa_jul24_cargos_efectivo_valormensual migration so a fresh DB has the
// same catalog after a bootstrap create. Keep this list in lockstep with
// the migration SQL (under backend/prisma/migrations/<ts>_qa_jul24_*).
// qa-session-jul-24 R4 (decision D1): delete+recreate to target list.
// Base (5): Administrador, Auxiliar de Enfermería, Gerontólogo/Gerontóloga,
//           Servicios Generales, Temporal.
// Profesional (5): Terapeuta Ocupacional, Fisioterapeuta, Psicólogo,
//                  Educador Físico, Artes y Manualidades.
export const DEFAULT_CARGOS = [
  'Administrador',
  'Auxiliar de Enfermería',
  'Gerontólogo/Gerontóloga',
  'Servicios Generales',
  'Temporal',
  'Terapeuta Ocupacional',
  'Fisioterapeuta',
  'Psicólogo',
  'Educador Físico',
  'Artes y Manualidades',
] as const

export async function getEmpresa(): Promise<EmpresaDetail | null> {
  const prisma = getPrisma()
  const empresa = await prisma.empresa.findFirst({
    where: { activa: true },
    orderBy: { id: 'asc' },
  })
  return empresa
}

export async function createEmpresa(input: CreateEmpresaInput): Promise<EmpresaDetail> {
  const prisma = getPrisma()

  // Enforce single-empresa invariant at the service layer (defense in depth —
  // route also checks). This system intentionally supports exactly one empresa.
  const existing = await prisma.empresa.findFirst({ select: { id: true } })
  if (existing) {
    throw Object.assign(new Error('La empresa ya existe'), { status: 409, field: 'empresa' })
  }

  // Atomic: create empresa + seed default cargos together. createMany with
  // skipDuplicates is safe even if cargos_empresa already has rows for this
  // empresaId (the unique constraint (empresa_id, nombre) protects us).
  const result = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: {
        nombre: input.nombre,
        nit: input.nit,
        direccion: input.direccion ?? null,
        telefono: input.telefono ?? null,
        email: input.email ?? null,
        activa: true,
      },
    })
    await tx.cargoEmpresa.createMany({
      data: DEFAULT_CARGOS.map((nombre) => ({
        empresaId: empresa.id,
        nombre,
        activo: true,
      })),
      skipDuplicates: true,
    })
    return empresa
  })

  return result
}

export async function updateEmpresa(id: number, input: UpdateEmpresaInput): Promise<EmpresaDetail> {
  const prisma = getPrisma()
  const existing = await prisma.empresa.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Empresa not found')
  }
  const empresa = await prisma.empresa.update({
    where: { id },
    data: input,
  })
  return empresa
}
