/**
 * jul-9 D7: CargoEmpresa catalog CRUD.
 *
 * Per-empresa catalog (UNIQUE(empresa_id, nombre)). List/create/archive.
 * Soft-archive only (PATCH activo=false). Hard-delete intentionally not exposed.
 */

import { getPrisma } from '../config/database.js'

export interface ListCargosParams {
  activo?: boolean | 'all'
}

export interface CreateCargoInput {
  nombre: string
}

export interface UpdateCargoInput {
  activo?: boolean
}

async function resolveEmpresaId(): Promise<number> {
  const prisma = getPrisma()
  const e = await prisma.empresa.findFirst({ select: { id: true } })
  if (!e) throw Object.assign(new Error('No empresa configured'), { status: 400 })
  return e.id
}

export async function listCargos(params: ListCargosParams = {}) {
  const prisma = getPrisma()
  const where: Record<string, unknown> = {}
  if (params.activo === true || params.activo === false) {
    where.activo = params.activo
  }
  // 'all' or undefined → no extra filter (return both active and archived)
  return prisma.cargoEmpresa.findMany({
    where,
    orderBy: [{ nombre: 'asc' }],
  })
}

export async function createCargo(input: CreateCargoInput) {
  const prisma = getPrisma()
  const empresaId = await resolveEmpresaId()
  try {
    return await prisma.cargoEmpresa.create({
      data: { empresaId, nombre: input.nombre.trim(), activo: true },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw Object.assign(
        new Error(`Ya existe un cargo con el nombre "${input.nombre}"`),
        { status: 409, field: 'nombre' },
      )
    }
    throw e
  }
}

export async function updateCargo(id: number, input: UpdateCargoInput) {
  const prisma = getPrisma()
  const existing = await prisma.cargoEmpresa.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error('Cargo not found'), { status: 404 })

  const data: Record<string, unknown> = {}
  if (input.activo !== undefined) data.activo = input.activo

  return prisma.cargoEmpresa.update({ where: { id }, data })
}

export async function deleteCargo(id: number): Promise<void> {
  // Soft-delete only: archive via PATCH activo=false. Hard DELETE is forbidden
  // (could orphan existing Contrato references).
  const prisma = getPrisma()
  const existing = await prisma.cargoEmpresa.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error('Cargo not found'), { status: 404 })
  await prisma.cargoEmpresa.update({ where: { id }, data: { activo: false } })
}
