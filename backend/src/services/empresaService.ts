import { getPrisma } from '../config/database.js'

export interface EmpresaDetail {
  id: number
  nombre: string
  nit: string
  direccion: string | null
  telefono: string | null
  email: string | null
  activa: boolean
  limitarFechaContratos: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UpdateEmpresaInput {
  nombre?: string
  nit?: string
  direccion?: string
  telefono?: string
  email?: string
  limitarFechaContratos?: boolean
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

// centro-costos-ago-5 (R7/R8) + aug-17 (D12): 14 centros (8 INGRESOS, 6 EGRESOS).
// `orden` matches the listed order; the FE's "Ingresos vs Egresos" UI sorts
// by `orden` ascending. Re-running the seed is idempotent thanks to the
// `@@unique([tipo, nombre])` constraint on CentroCostos and the
// `skipDuplicates: true` flag on createMany (R9). aug-17 expanded INGRESOS
// from 5 → 8 (rename `Transporte` → `Transporte completo` + insert
// `Mensualidad por 4 días`, `Mensualidad por 3 días`, `Transporte por 3 días`)
// and resequenced EGRESOS to 9–14.
export const DEFAULT_CENTROS_COSTOS: ReadonlyArray<{
  nombre: string
  tipo: 'INGRESOS' | 'EGRESOS'
  orden: number
}> = [
  // INGRESOS (8) — aug-17 D12
  { nombre: 'Mensualidades completas', tipo: 'INGRESOS', orden: 1 },
  { nombre: 'Mensualidad por 4 días',  tipo: 'INGRESOS', orden: 2 },
  { nombre: 'Mensualidad por 3 días',  tipo: 'INGRESOS', orden: 3 },
  { nombre: 'Mensualidades por día',   tipo: 'INGRESOS', orden: 4 },
  { nombre: 'Transporte completo',     tipo: 'INGRESOS', orden: 5 },
  { nombre: 'Transporte por 3 días',   tipo: 'INGRESOS', orden: 6 },
  { nombre: 'Ingresos adicionales',    tipo: 'INGRESOS', orden: 7 },
  { nombre: 'Valoraciones',            tipo: 'INGRESOS', orden: 8 },
  // EGRESOS (6) — aug-17 resequenced to 9–14
  { nombre: 'Refrigerios',             tipo: 'EGRESOS',  orden: 9 },
  { nombre: 'Aseo',                    tipo: 'EGRESOS',  orden: 10 },
  { nombre: 'Papelería',               tipo: 'EGRESOS',  orden: 11 },
  { nombre: 'Eventos',                 tipo: 'EGRESOS',  orden: 12 },
  { nombre: 'Nómina',                  tipo: 'EGRESOS',  orden: 13 },
  { nombre: 'Mantenimiento',           tipo: 'EGRESOS',  orden: 14 },
]

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

/**
 * centro-costos-ago-5 R9 + aug-17 D12: idempotent seed of the 14 default
 * centros (8 INGRESOS, 6 EGRESOS). Runs on every server startup (called
 * from server.ts). Table-level `@@unique([tipo, nombre])` +
 * `createMany({ skipDuplicates: true })` guarantees:
 *   - running twice leaves exactly 14 rows (8 INGRESOS + 6 EGRESOS),
 *   - user-created centros are preserved (they're not in DEFAULT_CENTROS_COSTOS).
 * The `result.count` is the number of rows actually inserted by THIS call;
 * if the DB already has all 14 seed rows, count === 0.
 *
 * aug-17 added `applyAug17SeedFix()` to (a) rename `Transporte` →
 * `Transporte completo` BEFORE the createMany so the existing row is
 * preserved (along with its ítems) and the unique constraint stays clean,
 * and (b) force the canonical orden on all 14 seed names. The fix is
 * idempotent: a second run is a no-op (rename matches zero rows; UPDATE
 * by name matches 14 rows whose orden already equals the target).
 */
export async function seedCentrosCostos(): Promise<{ inserted: number; renamed: number; reordered: number }> {
  const prisma = getPrisma()
  const renamed = await applyAug17SeedFix()
  const result = await prisma.centroCostos.createMany({
    data: DEFAULT_CENTROS_COSTOS.map((c) => ({
      nombre: c.nombre,
      tipo: c.tipo,
      activo: true,
      orden: c.orden,
    })),
    skipDuplicates: true,
  })
  const reordered = await applyAug17OrdenFix()
  return { inserted: result.count, renamed, reordered }
}

/**
 * aug-17 D12 step 1: rename the legacy `Transporte` INGRESOS row to
 * `Transporte completo` so any historical ítems attached to it stay
 * attached to the renamed row. MUST run before `createMany` so the
 * `@@unique([tipo, nombre])` constraint doesn't block the seed insert
 * of `Transporte completo` (and so we don't end up with both Transporte
 * AND Transporte completo as siblings).
 *
 * Robustness: if a `Transporte completo` row already exists from a
 * previous partial seed, deleting the duplicate BEFORE the rename
 * would risk losing items. Instead, we delete the duplicate
 * `Transporte completo` row that has no items attached (any orphan
 * left over from a half-completed prior migration). The legacy
 * `Transporte` row is preserved (and renamed), so any of its ítems
 * stay attached.
 *
 * Returns the number of rows renamed. Safe to re-run: a second invocation
 * matches zero rows because the name is already `Transporte completo`.
 */
async function applyAug17SeedFix(): Promise<number> {
  const prisma = getPrisma()
  // If a duplicate 'Transporte completo' row exists alongside the legacy
  // 'Transporte' row, drop the duplicate (it's an orphan from a partial
  // seed; the renamed 'Transporte' row will hold the canonical id).
  const dupes = await prisma.centroCostos.findMany({
    where: { tipo: 'INGRESOS', nombre: 'Transporte completo' },
    select: { id: true, _count: { select: { items: true } } },
  })
  for (const d of dupes) {
    if (d._count.items === 0 && (await prisma.centroCostos.count({ where: { tipo: 'INGRESOS', nombre: 'Transporte' } })) > 0) {
      await prisma.centroCostos.delete({ where: { id: d.id } })
    }
  }
  const result = await prisma.centroCostos.updateMany({
    where: { tipo: 'INGRESOS', nombre: 'Transporte' },
    data: { nombre: 'Transporte completo' },
  })
  return result.count
}

/**
 * aug-17 D12 step 2: force the canonical orden on all 14 seed-centro
 * names. We UPDATE by `nombre` (not by id) so a user-created custom
 * centro (e.g. "Navidad") is left at its current orden untouched. Safe
 * to re-run: a second invocation sets every seed row to its already-target
 * orden, so PostgreSQL reports the same UPDATE but with no observable
 * change.
 */
async function applyAug17OrdenFix(): Promise<number> {
  const prisma = getPrisma()
  let count = 0
  for (const c of DEFAULT_CENTROS_COSTOS) {
    const result = await prisma.centroCostos.updateMany({
      where: { tipo: c.tipo, nombre: c.nombre, NOT: { orden: c.orden } },
      data: { orden: c.orden },
    })
    count += result.count
  }
  return count
}
