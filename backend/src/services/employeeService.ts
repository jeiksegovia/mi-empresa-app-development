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
  certificadoAlturas: object | null
  certificadoRiesgoElectrico: object | null
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
  certificadoAlturas?: {
    fechaExpedicion: string
    fechaVencimiento: string
  }
  certificadoRiesgoElectrico?: {
    fechaExpedicion: string
    fechaVencimiento: string
  }
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
  certificadoAlturas: true,
  certificadoRiesgoElectrico: true,
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

  const { cargos, contactosEmergencia, nucleoFamiliar, experienciasLaborales, educacionIdiomas, vehiculos, certificadoAlturas, certificadoRiesgoElectrico, datosMigracion, ...baseFields } = input

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
      ...(certificadoAlturas
        ? {
            certificadoAlturas: {
              create: {
                fechaExpedicion: new Date(certificadoAlturas.fechaExpedicion),
                fechaVencimiento: new Date(certificadoAlturas.fechaVencimiento),
              },
            },
          }
        : {}),
      ...(certificadoRiesgoElectrico
        ? {
            certificadoRiesgoElectrico: {
              create: {
                fechaExpedicion: new Date(certificadoRiesgoElectrico.fechaExpedicion),
                fechaVencimiento: new Date(certificadoRiesgoElectrico.fechaVencimiento),
              },
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
