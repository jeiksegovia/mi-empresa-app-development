import { getPrisma } from '../config/database.js'

// List params and result types
export interface EmployeeListParams {
  page?: number
  limit?: number
  search?: string
  estado?: 'ACTIVO' | 'INACTIVO'
}

export interface EmployeeSummary {
  id: number
  nombre: string
  apellido: string
  tipoDocumento: string
  numeroDocumento: string
  genero: string
  telefono: string | null
  email: string | null
  estado: string
  fechaRegistro: Date
  cargo: string | null
  ubicacion: string | null
}

export interface EmployeeListResult {
  data: EmployeeSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Full employee detail with all relations
export interface EmployeeDetail {
  id: number
  nombre: string
  apellido: string
  tipoDocumento: string
  numeroDocumento: string
  permisoTrabajo: boolean
  genero: string
  fechaNacimiento: Date
  tipoVivienda: string | null
  direccion: string | null
  estratoSocioeconomico: number | null
  estadoCivil: string | null
  telefono: string | null
  email: string | null
  estado: string
  fechaRegistro: Date
  nucleoFamiliar: Array<{
    id: number
    nombre: string
    apellido: string
    tipoDocumento: string
    numeroDocumento: string | null
    fechaNacimiento: Date
    genero: string
    telefono: string | null
    parentesco: string
  }>
  contactosEmergencia: Array<{
    id: number
    nombre: string
    apellido: string
    telefono: string
    parentesco: string
  }>
  cargos: Array<{
    id: number
    fechaIngreso: Date
    fechaTerminacion: Date | null
    nombreCargo: string
    ubicacion: string
  }>
  experienciasLaborales: Array<{
    id: number
    empresa: string
    telefonoEmpresa: string | null
    cargo: string
    sector: string | null
    periodoInicio: Date
    periodoFin: Date | null
    funcionesLogros: string | null
  }>
  educacionIdiomas: Array<{
    id: number
    institucion: string
    nivelEscritura: string
    nivelHabla: string
    capacidadTraducir: boolean
  }>
  vehiculos: Array<{
    id: number
    tipoVehiculo: string
    placas: string
    tipoLicencia: string
    numeroLicencia: string
  }>
  certificados: Array<{
    id: number
    tipo: string
    nombre: string | null
    fechaExpedicion: Date
    fechaVencimiento: Date
  }>
  datosMigracion: object | null
}

// Create input
export interface CreateEmployeeInput {
  nombre: string
  apellido: string
  tipoDocumento: 'CC' | 'CE' | 'PASAPORTE'
  numeroDocumento: string
  genero: string
  fechaNacimiento: Date | string
  permisoTrabajo?: boolean
  tipoVivienda?: string
  direccion?: string
  estratoSocioeconomico?: number
  estadoCivil?: string
  telefono?: string
  email?: string
  estado?: 'ACTIVO' | 'INACTIVO'
  cargos?: {
    fechaIngreso: string
    nombreCargo: string
    ubicacion: string
    fechaTerminacion?: string
    salario?: number
  }[]
  contactosEmergencia?: {
    nombre: string
    apellido: string
    telefono: string
    parentesco: string
  }[]
  nucleoFamiliar?: {
    nombre: string
    apellido: string
    tipoDocumento: string
    fechaNacimiento: string
    genero: string
    parentesco: string
    telefono?: string
    numeroDocumento?: string
  }[]
  experienciasLaborales?: {
    empresa: string
    telefonoEmpresa?: string
    cargo: string
    sector?: string
    periodoInicio: string
    periodoFin?: string
    funcionesLogros?: string
  }[]
  educacionIdiomas?: {
    institucion: string
    nivelEscritura: string
    nivelHabla: string
    capacidadTraducir: boolean
  }[]
  vehiculos?: {
    tipoVehiculo: string
    placas: string
    tipoLicencia: string
    numeroLicencia: string
  }[]
  certificados?: {
    tipo: 'ALTURAS' | 'RIESGO_ELECTRICO' | 'MANIPULACION_ALIMENTOS' | 'OTRO'
    nombre?: string
    fechaExpedicion: string
    fechaVencimiento: string
  }[]
  datosMigracion?: {
    numeroPasaporte?: string
    pasaporteExpedicion?: string
    pasaporteVencimiento?: string
    numeroVisa?: string
    visaExpedicion?: string
    visaVencimiento?: string
  }
}

// Update input - top-level fields only
export interface UpdateEmployeeInput extends Partial<Omit<CreateEmployeeInput, 'cargos' | 'contactosEmergencia' | 'nucleoFamiliar'>> {}

const ALL_RELATIONS = {
  nucleoFamiliar: true,
  contactosEmergencia: true,
  cargos: {
    orderBy: { fechaIngreso: 'desc' as const },
  },
  experienciasLaborales: true,
  educacionIdiomas: true,
  vehiculos: true,
  certificados: { orderBy: { fechaExpedicion: 'desc' as const } },
  datosMigracion: true,
}

export async function listEmployees(params: EmployeeListParams): Promise<EmployeeListResult> {
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
      { apellido: { contains: term, mode: 'insensitive' } },
      { numeroDocumento: { contains: term, mode: 'insensitive' } },
    ]
  }

  const [empleados, total] = await Promise.all([
    prisma.empleado.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fechaRegistro: 'desc' },
      include: {
        cargos: {
          orderBy: { fechaIngreso: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.empleado.count({ where }),
  ])

  const data: EmployeeSummary[] = empleados.map((emp) => ({
    id: emp.id,
    nombre: emp.nombre,
    apellido: emp.apellido,
    tipoDocumento: emp.tipoDocumento,
    numeroDocumento: emp.numeroDocumento,
    genero: emp.genero,
    telefono: emp.telefono,
    email: emp.email,
    estado: emp.estado,
    fechaRegistro: emp.fechaRegistro,
    cargo: emp.cargos[0]?.nombreCargo ?? null,
    ubicacion: emp.cargos[0]?.ubicacion ?? null,
  }))

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getEmployee(id: number): Promise<EmployeeDetail | null> {
  const prisma = getPrisma()
  const emp = await prisma.empleado.findUnique({
    where: { id },
    include: ALL_RELATIONS,
  })
  return emp as EmployeeDetail | null
}

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeDetail> {
  const prisma = getPrisma()

  const { cargos, contactosEmergencia, nucleoFamiliar, experienciasLaborales, educacionIdiomas, vehiculos, certificados, datosMigracion, ...baseFields } = input

  const emp = await prisma.empleado.create({
    data: {
      ...baseFields,
      fechaNacimiento: new Date(baseFields.fechaNacimiento),
      permisoTrabajo: baseFields.permisoTrabajo ?? false,
      tipoVivienda: baseFields.tipoVivienda as any,
      ...(cargos && cargos.length > 0
        ? {
            cargos: {
              create: cargos.map((c) => ({
                fechaIngreso: new Date(c.fechaIngreso),
                nombreCargo: c.nombreCargo,
                ubicacion: c.ubicacion,
                fechaTerminacion: c.fechaTerminacion ? new Date(c.fechaTerminacion) : undefined,
                salario: c.salario ?? null,
              })),
            },
          }
        : {}),
      ...(contactosEmergencia && contactosEmergencia.length > 0
        ? {
            contactosEmergencia: {
              create: contactosEmergencia,
            },
          }
        : {}),
      ...(nucleoFamiliar && nucleoFamiliar.length > 0
        ? {
            nucleoFamiliar: {
              create: nucleoFamiliar.map((nf) => ({
                nombre: nf.nombre,
                apellido: nf.apellido,
                tipoDocumento: nf.tipoDocumento as any,
                numeroDocumento: nf.numeroDocumento,
                fechaNacimiento: new Date(nf.fechaNacimiento),
                genero: nf.genero,
                parentesco: nf.parentesco,
                telefono: nf.telefono,
              })),
            },
          }
        : {}),
      ...(experienciasLaborales && experienciasLaborales.length > 0
        ? {
            experienciasLaborales: {
              create: experienciasLaborales.map((e) => ({
                empresa: e.empresa,
                telefonoEmpresa: e.telefonoEmpresa,
                cargo: e.cargo,
                sector: e.sector,
                periodoInicio: new Date(e.periodoInicio),
                periodoFin: e.periodoFin ? new Date(e.periodoFin) : undefined,
                funcionesLogros: e.funcionesLogros,
              })),
            },
          }
        : {}),
      ...(educacionIdiomas && educacionIdiomas.length > 0
        ? {
            educacionIdiomas: {
              create: educacionIdiomas.map((ed) => ({
                institucion: ed.institucion,
                nivelEscritura: ed.nivelEscritura,
                nivelHabla: ed.nivelHabla,
                capacidadTraducir: ed.capacidadTraducir,
              })),
            },
          }
        : {}),
      ...(vehiculos && vehiculos.length > 0
        ? {
            vehiculos: {
              create: vehiculos.map((v) => ({
                tipoVehiculo: v.tipoVehiculo,
                placas: v.placas,
                tipoLicencia: v.tipoLicencia,
                numeroLicencia: v.numeroLicencia,
              })),
            },
          }
        : {}),
      ...(certificados && certificados.length > 0
        ? {
            certificados: {
              create: certificados.map((c) => ({
                tipo: c.tipo as any,
                nombre: c.tipo === 'OTRO' ? c.nombre || null : null,
                fechaExpedicion: new Date(c.fechaExpedicion),
                fechaVencimiento: new Date(c.fechaVencimiento),
              })),
            },
          }
        : {}),
      ...(datosMigracion && (datosMigracion.numeroPasaporte || datosMigracion.pasaporteExpedicion)
        ? {
            datosMigracion: {
              create: {
                numeroPasaporte: datosMigracion.numeroPasaporte || '',
                pasaporteExpedicion: datosMigracion.pasaporteExpedicion ? new Date(datosMigracion.pasaporteExpedicion) : new Date(),
                pasaporteVencimiento: datosMigracion.pasaporteVencimiento ? new Date(datosMigracion.pasaporteVencimiento) : new Date(),
                numeroVisa: datosMigracion.numeroVisa,
                visaExpedicion: datosMigracion.visaExpedicion ? new Date(datosMigracion.visaExpedicion) : undefined,
                visaVencimiento: datosMigracion.visaVencimiento ? new Date(datosMigracion.visaVencimiento) : undefined,
              },
            },
          }
        : {}),
    },
    include: ALL_RELATIONS,
  })

  return emp as unknown as EmployeeDetail
}

export async function updateEmployee(id: number, input: UpdateEmployeeInput): Promise<EmployeeDetail> {
  const prisma = getPrisma()

  const existing = await prisma.empleado.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Employee not found')
  }

  const updateData: Record<string, unknown> = { ...input }

  if (input.fechaNacimiento) {
    updateData.fechaNacimiento = new Date(input.fechaNacimiento)
  }

  if (input.tipoVivienda) {
    updateData.tipoVivienda = input.tipoVivienda as any
  }

  const emp = await prisma.empleado.update({
    where: { id },
    data: updateData,
    include: ALL_RELATIONS,
  })

  return emp as unknown as EmployeeDetail
}

export async function deleteEmployee(id: number): Promise<void> {
  const prisma = getPrisma()

  const existing = await prisma.empleado.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Employee not found')
  }

  await prisma.empleado.update({
    where: { id },
    data: { estado: 'INACTIVO' },
  })
}

// ─── 

export interface DerivedPendiente {
  id: string
  tipo: 'CERT_VENCIDO' | 'CERT_POR_VENCER' | 'HOJA_VIDA_FALTANTE' | 'SIN_CONTRATO_ACTIVO'
  descripcion: string
  severity: 'danger' | 'warn' | 'info'
  derived: true
}

const TIPO_LABEL: Record<string, string> = {
  ALTURAS: 'Trabajo en Alturas',
  RIESGO_ELECTRICO: 'Riesgo Eléctrico',
  MANIPULACION_ALIMENTOS: 'Manipulación de Alimentos',
  OTRO: 'Otro',
}

function diffDays(target: Date, ref: Date): number {
  const ms = target.getTime() - ref.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export async function listPendientes(empleadoId: number) {
  const prisma = getPrisma()

  const empleado = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    include: { certificados: true },
  })
  if (!empleado) throw new Error('Employee not found')

  const manuales = await prisma.pendienteEmpleado.findMany({
    where: { empleadoId },
    orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
  })

  // Derived: certs VENCIDO / POR_VENCER (≤30d)
  const now = new Date()
  const derivados: DerivedPendiente[] = []
  for (const cert of empleado.certificados) {
    if (!cert.fechaVencimiento) continue
    const days = diffDays(cert.fechaVencimiento, now)
    const tipoLabel = TIPO_LABEL[cert.tipo] || cert.tipo
    if (days < 0) {
      derivados.push({
        id: `cert-vencido-${cert.id}`,
        tipo: 'CERT_VENCIDO',
        descripcion: `Certificado ${tipoLabel} vencido hace ${Math.abs(days)} días`,
        severity: 'danger',
        derived: true,
      })
    } else if (days <= 30) {
      derivados.push({
        id: `cert-por-vencer-${cert.id}`,
        tipo: 'CERT_POR_VENCER',
        descripcion: `Certificado ${tipoLabel} vence en ${days} días`,
        severity: 'warn',
        derived: true,
      })
    }
  }

  // Derived: hoja de vida faltante
  if (!empleado.hojaVidaUrl) {
    derivados.push({
      id: 'hv-faltante',
      tipo: 'HOJA_VIDA_FALTANTE',
      descripcion: 'Adjuntar hoja de vida',
      severity: 'info',
      derived: true,
    })
  }

  // Derived: sin contrato activo (P6)
  const contratoActivo = await prisma.contrato.findFirst({
    where: { empleadoId, activo: true },
    select: { id: true },
  })
  if (!contratoActivo) {
    derivados.push({
      id: 'sin-contrato',
      tipo: 'SIN_CONTRATO_ACTIVO',
      descripcion: 'Sin contrato activo',
      severity: 'warn',
      derived: true,
    })
  }

  const openCount =
    manuales.filter((m) => m.estado === 'PENDIENTE').length +
    derivados.filter((d) => d.tipo !== 'CERT_POR_VENCER').length

  return { manuales, derivados, openCount }
}

export async function createPendiente(empleadoId: number, userId: number, descripcion: string) {
  const prisma = getPrisma()
  const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } })
  if (!empleado) throw new Error('Employee not found')
  return prisma.pendienteEmpleado.create({
    data: { empleadoId, creadoPor: userId, descripcion, estado: 'PENDIENTE' },
  })
}

export async function patchPendiente(empleadoId: number, pid: number, estado: 'PENDIENTE' | 'RESUELTO') {
  const prisma = getPrisma()
  const existing = await prisma.pendienteEmpleado.findFirst({ where: { id: pid, empleadoId } })
  if (!existing) throw new Error('Pendiente not found')
  return prisma.pendienteEmpleado.update({
    where: { id: pid },
    data: {
      estado,
      fechaResuelto: estado === 'RESUELTO' ? new Date() : null,
    },
  })
}

export async function deletePendiente(empleadoId: number, pid: number) {
  const prisma = getPrisma()
  const existing = await prisma.pendienteEmpleado.findFirst({ where: { id: pid, empleadoId } })
  if (!existing) throw new Error('Pendiente not found')
  await prisma.pendienteEmpleado.delete({ where: { id: pid } })
}

// ─── 

export interface NovedadArchivo {
  nombre: string
  url: string
}

export interface NovedadInput {
  tipo: 'LLAMADO_ATENCION' | 'MEMORANDO' | 'PERMISO' | 'VACACIONES' | 'OTRA'
  titulo: string
  descripcion?: string
  fechaInicio: string
  fechaFin?: string
  archivos?: NovedadArchivo[]
}

export async function listNovedades(empleadoId: number) {
  const prisma = getPrisma()
  const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } })
  if (!empleado) throw new Error('Employee not found')
  const list = await prisma.novedadEmpleado.findMany({
    where: { empleadoId },
    orderBy: { createdAt: 'desc' },
    include: { archivos: true },
  })
  return list
}

export async function createNovedad(empleadoId: number, userId: number, input: NovedadInput) {
  const prisma = getPrisma()
  const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } })
  if (!empleado) throw new Error('Employee not found')
  return prisma.novedadEmpleado.create({
    data: {
      empleadoId,
      creadoPor: userId,
      tipo: input.tipo,
      titulo: input.titulo,
      descripcion: input.descripcion ?? null,
      fechaInicio: new Date(input.fechaInicio),
      fechaFin: input.fechaFin ? new Date(input.fechaFin) : null,
      archivos: input.archivos
        ? { create: input.archivos.map((a) => ({ nombre: a.nombre, url: a.url })) }
        : undefined,
    },
    include: { archivos: true },
  })
}

export async function updateNovedad(empleadoId: number, nid: number, input: NovedadInput) {
  const prisma = getPrisma()
  const existing = await prisma.novedadEmpleado.findFirst({ where: { id: nid, empleadoId } })
  if (!existing) throw new Error('Novedad not found')
  return prisma.$transaction(async (tx) => {
    if (input.archivos !== undefined) {
      await tx.archivoNovedad.deleteMany({ where: { novedadId: nid } })
      if (input.archivos.length > 0) {
        await tx.archivoNovedad.createMany({
          data: input.archivos.map((a) => ({ novedadId: nid, nombre: a.nombre, url: a.url })),
        })
      }
    }
    return tx.novedadEmpleado.update({
      where: { id: nid },
      data: {
        tipo: input.tipo,
        titulo: input.titulo,
        descripcion: input.descripcion ?? null,
        fechaInicio: new Date(input.fechaInicio),
        fechaFin: input.fechaFin ? new Date(input.fechaFin) : null,
      },
      include: { archivos: true },
    })
  })
}

export async function deleteNovedad(empleadoId: number, nid: number) {
  const prisma = getPrisma()
  const existing = await prisma.novedadEmpleado.findFirst({ where: { id: nid, empleadoId } })
  if (!existing) throw new Error('Novedad not found')
  await prisma.novedadEmpleado.delete({ where: { id: nid } })
}

