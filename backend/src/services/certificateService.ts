import { getPrisma } from '../config/database.js'
import type { Prisma } from '../generated/prisma/index.js'

export interface CertificateListParams {
  page?: number
  limit?: number
  tipo?: string
  estado?: string
}

export interface CertificateSummary {
  id: number
  empresaId: number
  tipoCertificado: string
  nombre: string
  descripcion: string | null
  estado: string
  fechaEmision: Date | null
  fechaVencimiento: Date | null
  archivoUrl: string | null
  periodicidad: string
  periodo: Date | null
  comprobantePagoUrl: string | null
  creadoPor: number
  createdAt: Date
}

export interface CreateCertificateInput {
  empresaId?: number
  tipoCertificado: 'ALCALDIA' | 'GOBERNACION' | 'SECRETARIAS' | 'TRIBUTARIOS' | 'REGISTRO_MERCANTIL' | 'OTRO'
  nombre: string
  descripcion?: string
  estado?: 'VIGENTE' | 'VENCIDO' | 'PENDIENTE'
  fechaEmision?: string
  fechaVencimiento?: string
  archivoUrl?: string

  periodicidad?: 'UNICA' | 'MENSUAL' | 'ANUAL'
  periodo?: string
  comprobantePagoUrl?: string
  duplicateFromId?: number
}

export type UpdateCertificateInput = Partial<Omit<CreateCertificateInput, 'duplicateFromId'>>

export interface CertificateUpdateInput {
  archivoUrl?: string
  notas?: string
  fechaEmision?: string
  fechaVencimiento?: string
}

export interface CertificateUpdateRecord {
  id: number
  certificadoId: number
  archivoUrl: string | null
  notas: string | null
  fechaEmision: Date | null
  fechaVencimiento: Date | null
  creadoPor: number
  createdAt: Date
}

/**
 * Custom error class with HTTP-style `status` property so routes can
 * differentiate CUENTA_COBRO_REQUIRED from generic Prisma errors.
 */
export class CertificateError extends Error {
  status: number
  field?: string
  constructor(message: string, status: number, field?: string) {
    super(message)
    this.name = 'CertificateError'
    this.status = status
    this.field = field
  }
}

export async function listCertificates(params: CertificateListParams) {
  const prisma = getPrisma()
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (params.tipo) where.tipoCertificado = params.tipo
  if (params.estado) where.estado = params.estado

  const [certs, total] = await Promise.all([
    prisma.certificadoEmpresa.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.certificadoEmpresa.count({ where }),
  ])

  return {
    data: certs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getCertificate(id: number) {
  const prisma = getPrisma()
  return prisma.certificadoEmpresa.findUnique({ where: { id } })
}

/**
 * Single-tenant app: derive the empresaId server-side from the sole empresas row
 * when the client does not send one. Throws if no empresa exists.
 */
export async function getDefaultEmpresaId(): Promise<number> {
  const prisma = getPrisma()
  const empresa = await prisma.empresa.findFirst({ select: { id: true } })
  if (!empresa) throw new Error('No empresa found')
  return empresa.id
}

/**

 * Copies tipo/nombre/descripcion/periodicidad from source. Estado is forced to PENDIENTE
 * (no archivo/comprobante until admin uploads). Periodo defaults to first day of current month.
 */
export async function duplicateCertificate(
  sourceId: number,
  userId: number,
  periodoOverride?: string
) {
  const prisma = getPrisma()
  const source = await prisma.certificadoEmpresa.findUnique({ where: { id: sourceId } })
  if (!source) throw new Error('Certificate not found')

  const periodo = periodoOverride
    ? new Date(periodoOverride)
    : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1))

  return prisma.certificadoEmpresa.create({
    data: {
      empresaId: source.empresaId,
      tipoCertificado: source.tipoCertificado,
      nombre: source.nombre,
      descripcion: source.descripcion,
      estado: 'PENDIENTE',
      fechaEmision: null,
      fechaVencimiento: null,
      archivoUrl: null,
      comprobantePagoUrl: null,
      periodicidad: source.periodicidad,
      periodo,
      creadoPor: userId,
    },
  })
}

export async function createCertificate(input: CreateCertificateInput, userId: number) {
  const prisma = getPrisma()


  if (input.duplicateFromId) {
    return duplicateCertificate(input.duplicateFromId, userId, input.periodo)
  }

  const empresaId = input.empresaId ?? (await getDefaultEmpresaId())
  return prisma.certificadoEmpresa.create({
    data: {
      empresaId,
      tipoCertificado: input.tipoCertificado as any,
      nombre: input.nombre,
      descripcion: input.descripcion,
      estado: (input.estado ?? 'PENDIENTE') as any,
      fechaEmision: input.fechaEmision ? new Date(input.fechaEmision) : null,
      fechaVencimiento: input.fechaVencimiento ? new Date(input.fechaVencimiento) : null,
      archivoUrl: input.archivoUrl,
      periodicidad: (input.periodicidad ?? 'UNICA') as any,
      periodo: input.periodo ? new Date(input.periodo) : null,
      comprobantePagoUrl: input.comprobantePagoUrl ?? null,
      creadoPor: userId,
    },
  })
}

export async function updateCertificate(id: number, input: UpdateCertificateInput) {
  const prisma = getPrisma()
  const existing = await prisma.certificadoEmpresa.findUnique({ where: { id } })
  if (!existing) throw new Error('Certificate not found')

  const data: Record<string, unknown> = { ...input }
  // Normalize empty-string dates to "no update" so Prisma doesn't 500 on invalid Date
  for (const k of ['fechaEmision', 'fechaVencimiento', 'periodo'] as const) {
    if ((input as any)[k] === '') delete (data as any)[k]
  }
  if (input.tipoCertificado) data.tipoCertificado = input.tipoCertificado as any
  if (input.estado) data.estado = input.estado as any
  if (input.periodicidad) data.periodicidad = input.periodicidad as any
  if (input.fechaEmision) data.fechaEmision = new Date(input.fechaEmision)
  if (input.fechaVencimiento) data.fechaVencimiento = new Date(input.fechaVencimiento)
  if (input.periodo) data.periodo = new Date(input.periodo)

  return prisma.certificadoEmpresa.update({ where: { id }, data })
}

export async function deleteCertificate(id: number) {
  const prisma = getPrisma()
  const existing = await prisma.certificadoEmpresa.findUnique({ where: { id } })
  if (!existing) throw new Error('Certificate not found')
  await prisma.certificadoEmpresa.delete({ where: { id } })
}

/**

 * For every MENSUAL certificate name (distinct), check if there is a row with
 * `periodo` falling within the current month. Returns the names that are missing.
 *
 * Compare by YYYY-MM string in UTC (matches Prisma's UTC-midnight default
 * for Postgres DATE columns) to be TZ-robust between write and read.
 */
export async function getMissingMonthlyAlerts(): Promise<string[]> {
  const prisma = getPrisma()
  const now = new Date()
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  const mensualCerts = await prisma.certificadoEmpresa.findMany({
    where: { periodicidad: 'MENSUAL' },
    select: { nombre: true, periodo: true },
    orderBy: { nombre: 'asc' },
  })

  const seenNames = new Set<string>()
  const hasMonthFor = new Set<string>()
  for (const c of mensualCerts) {
    seenNames.add(c.nombre)
    if (c.periodo) {
      const rowMonthKey = `${c.periodo.getUTCFullYear()}-${String(c.periodo.getUTCMonth() + 1).padStart(2, '0')}`
      if (rowMonthKey === currentMonthKey) {
        hasMonthFor.add(c.nombre)
      }
    }
  }

  return Array.from(seenNames).filter((n) => !hasMonthFor.has(n))
}

export async function getCertificateStats() {
  const prisma = getPrisma()
  const [vigente, vencido, pendiente, alertasMesFaltante] = await Promise.all([
    prisma.certificadoEmpresa.count({ where: { estado: 'VIGENTE' } }),
    prisma.certificadoEmpresa.count({ where: { estado: 'VENCIDO' } }),
    prisma.certificadoEmpresa.count({ where: { estado: 'PENDIENTE' } }),
    getMissingMonthlyAlerts(),
  ])
  return {
    vigente,
    vencido,
    pendiente,
    total: vigente + vencido + pendiente,
    alertasMesFaltante,
  }
}

/**
 * Append-only history rows for a certificate. Returns rows ordered by createdAt desc.
 */
export async function listCertificateUpdates(certId: number): Promise<CertificateUpdateRecord[]> {
  const prisma = getPrisma()
  const cert = await prisma.certificadoEmpresa.findUnique({ where: { id: certId } })
  if (!cert) throw new CertificateError('Certificate not found', 404)
  return prisma.certificadoUpdate.findMany({
    where: { certificadoId: certId },
    orderBy: { createdAt: 'desc' },
  }) as unknown as CertificateUpdateRecord[]
}

/**
 * Append a new CertificadoUpdate row, and update the parent snapshot with any
 * non-null values from the input. If fechaVencimiento is provided (or already
 * present on the parent), `estado` is recomputed from that date.
 *
 * The "current" view of a certificado is the parent's snapshot fields; the
 * update history table is append-only.
 */
export async function addCertificateUpdate(
  certId: number,
  input: CertificateUpdateInput,
  userId: number,
): Promise<{ update: CertificateUpdateRecord; certificate: any }> {
  const prisma = getPrisma()

  const cert = await prisma.certificadoEmpresa.findUnique({ where: { id: certId } })
  if (!cert) throw new CertificateError('Certificate not found', 404)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const update = await tx.certificadoUpdate.create({
      data: {
        certificadoId: certId,
        archivoUrl: input.archivoUrl ?? null,
        notas: input.notas ?? null,
        fechaEmision: input.fechaEmision ? new Date(input.fechaEmision) : null,
        fechaVencimiento: input.fechaVencimiento ? new Date(input.fechaVencimiento) : null,
        creadoPor: userId,
      },
    })

    const parentPatch: Record<string, unknown> = {}
    if (input.archivoUrl !== undefined) parentPatch.archivoUrl = input.archivoUrl
    if (input.fechaEmision !== undefined) {
      parentPatch.fechaEmision = input.fechaEmision ? new Date(input.fechaEmision) : null
    }
    if (input.fechaVencimiento !== undefined) {
      parentPatch.fechaVencimiento = input.fechaVencimiento ? new Date(input.fechaVencimiento) : null
    }

    // Always recompute estado from the new effective fechaVencimiento.
    const effectiveFechaVencimiento =
      input.fechaVencimiento !== undefined
        ? input.fechaVencimiento
          ? new Date(input.fechaVencimiento)
          : null
        : cert.fechaVencimiento
    if (effectiveFechaVencimiento) {
      const fv = new Date(effectiveFechaVencimiento)
      fv.setHours(0, 0, 0, 0)
      parentPatch.estado = fv.getTime() >= today.getTime() ? 'VIGENTE' : 'VENCIDO'
    } else {
      // No expiration → keep PENDIENTE if there is one, else default PENDIENTE.
      parentPatch.estado = cert.estado ?? 'PENDIENTE'
    }

    const certificate = await tx.certificadoEmpresa.update({
      where: { id: certId },
      data: parentPatch,
    })

    return { update: update as unknown as CertificateUpdateRecord, certificate }
  })
}
