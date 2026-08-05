import { Router, Request, Response } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requireDomain, requireEmployeeUnlocked } from '../middleware/domainAccess.js'
import { z } from 'zod'
import * as employeeService from '../services/employeeService.js'
import * as educacionService from '../services/educacionEmpleadoService.js'
import { logger } from '../config/logger.js'
import { getPrisma } from '../config/database.js'

const router = Router()

// Apply auth to all routes
router.use(authMiddleware())

// fixes-jul17-2 §1.2: empleados domain — CONTRATOS has full access;
// GERONTOLOGA / null-EMPLEADO / AUDITOR / OPERADOR / ADMIN all fall through.
router.use(requireDomain('empleados'))

// Zod schemas for validation
// Base object (no superRefine) so .partial() works for update schema.
const employeeBaseSchema = z.object({
  // jul-10 E1: normalize to upper-case + trim on entity nombre/apellido
  nombre: z.string().min(1).max(100).transform((v) => v.trim().toUpperCase()),
  apellido: z.string().min(1).max(100).transform((v) => v.trim().toUpperCase()),
  tipoDocumento: z.enum(['CC', 'CE', 'PASAPORTE']),
  numeroDocumento: z.string().min(1).max(50),
  genero: z.string().min(1).max(20),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  permisoTrabajo: z.boolean().optional(),
  tipoVivienda: z.enum(['PROPIA', 'ARRENDADA', 'FAMILIAR']).optional(),
  direccion: z.string().optional(),
  estratoSocioeconomico: z.number().int().min(1).max(6).optional(),
  estadoCivil: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  hojaVidaUrl: z.string().optional(),
  // jul-9 D3: identity-document file URL
  documentoIdentificacionUrl: z.string().max(500).optional(),
  cargos: z
    .array(
      z.object({
        fechaIngreso: z.string(),
        nombreCargo: z.string().min(1),
        ubicacion: z.string().min(1),
        fechaTerminacion: z.string().optional(),
        salario: z.number().nonnegative().optional(),
      }),
    )
    .optional(),
  contactosEmergencia: z
    .array(
      z.object({
        nombre: z.string().min(1),
        apellido: z.string().min(1),
        telefono: z.string().min(1),
        parentesco: z.string().min(1),
      }),
    )
    .optional(),
  nucleoFamiliar: z
    .array(
      z.object({
        nombre: z.string().min(1),
        apellido: z.string().min(1),
        tipoDocumento: z.enum(['REGISTRO_CIVIL', 'TI', 'CC', 'CE']),
        fechaNacimiento: z.string(),
        genero: z.string(),
        parentesco: z.string(),
        telefono: z.string().optional(),
        numeroDocumento: z.string().optional(),
      }),
    )
    .optional(),
  experienciasLaborales: z.array(z.object({
    empresa: z.string().min(1),
    telefonoEmpresa: z.string().optional(),
    cargo: z.string().min(1),
    sector: z.string().optional(),
    periodoInicio: z.string(),
    periodoFin: z.string().optional(),
    funcionesLogros: z.string().optional(),
  })).optional(),
  educacionIdiomas: z.array(z.object({
    institucion: z.string().min(1),
    // jul-9 D1: nivelEscritura now optional (column is nullable since M1)
    nivelEscritura: z.string().optional().nullable(),
    nivelHabla: z.string().min(1),
    capacidadTraducir: z.boolean(),
  })).optional(),
  vehiculos: z.array(z.object({
    tipoVehiculo: z.string().min(1),
    placas: z.string().min(1),
    tipoLicencia: z.string().min(1),
    numeroLicencia: z.string().min(1),
  })).optional(),
  certificados: z
    .array(
      z.object({
        tipo: z.enum(['ALTURAS', 'RIESGO_ELECTRICO', 'MANIPULACION_ALIMENTOS', 'OTRO']),
        nombre: z.string().optional(),
        fechaExpedicion: z.string(),
        fechaVencimiento: z.string(),
        archivoUrl: z.string().optional(),
      }),
    )
    .optional(),
  datosMigracion: z.object({
    numeroPasaporte: z.string().optional(),
    pasaporteExpedicion: z.string().optional(),
    pasaporteVencimiento: z.string().optional(),
    numeroVisa: z.string().optional(),
    visaExpedicion: z.string().optional(),
    visaVencimiento: z.string().optional(),
  }).optional(),
  // nomina-asistencia-jul-18 + qa-session-jul-24 R1: medio de pago (optional; conditional fields below).
  // EFECTIVO is a new valid value (no extra fields required).
  medioPagoTipo: z.enum(['NEQUI', 'TRANSFERENCIA_BANCARIA', 'EFECTIVO']).nullable().optional(),
  medioPagoNequi: z.string().max(50).nullable().optional(),
  bancoNombre: z.string().max(100).nullable().optional(),
  bancoTipoCuenta: z.enum(['AHORRO', 'CORRIENTE']).nullable().optional(),
  bancoNumeroCuenta: z.string().max(50).nullable().optional(),
  // qa-session-jul-31 R3: optional EPS / Fondo de pensiones / ARL (free text, no catalog).
  eps: z.string().max(100).nullable().optional(),
  fondoPensiones: z.string().max(100).nullable().optional(),
  arl: z.string().max(100).nullable().optional(),
})

// qa-session-jul-24 §3: Nequi "llave" — email OR alphanumeric(6-25 with at least one letter + one digit).
// Reject pure-numeric strings (10-15 digits).
const NEQUI_LLAVE_REGEX =
  /^(?:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{6,25})$/

function refineMedioPago(data: {
  medioPagoTipo?: string | null
  medioPagoNequi?: string | null
  bancoNombre?: string | null
  bancoTipoCuenta?: string | null
  bancoNumeroCuenta?: string | null
}, ctx: z.RefinementCtx) {
  if (data.medioPagoTipo === 'NEQUI') {
    if (!data.medioPagoNequi || !String(data.medioPagoNequi).trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Número Nequi es requerido',
        path: ['medioPagoNequi'],
      })
    } else if (!NEQUI_LLAVE_REGEX.test(String(data.medioPagoNequi).trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Nequi llave no válida: debe ser email o alfanumérica (6-25) con al menos una letra y un dígito',
        path: ['medioPagoNequi'],
      })
    }
  }
  if (data.medioPagoTipo === 'TRANSFERENCIA_BANCARIA') {
    if (!data.bancoNombre || !String(data.bancoNombre).trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nombre del banco es requerido',
        path: ['bancoNombre'],
      })
    }
    if (!data.bancoTipoCuenta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tipo de cuenta es requerido',
        path: ['bancoTipoCuenta'],
      })
    }
    if (!data.bancoNumeroCuenta || !String(data.bancoNumeroCuenta).trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Número de cuenta es requerido',
        path: ['bancoNumeroCuenta'],
      })
    }
  }
}

const createEmployeeSchema = employeeBaseSchema.superRefine(refineMedioPago)

const updateEmployeeSchema = employeeBaseSchema
  .partial()
  .omit({ cargos: true, contactosEmergencia: true, nucleoFamiliar: true, experienciasLaborales: true, educacionIdiomas: true, vehiculos: true, certificados: true, datosMigracion: true })
  .superRefine(refineMedioPago)

// GET /employees - list with pagination/search/filter
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const search = req.query.search as string | undefined
    const estado = req.query.estado as 'ACTIVO' | 'INACTIVO' | undefined

    const result = await employeeService.listEmployees({ page, limit, search, estado })
    res.json({ success: true, ...result })
  } catch (error) {
    logger.error('List employees error:', error)
    res.status(500).json({ success: false, message: 'Error fetching employees' })
  }
})

// GET /employees/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid employee ID' })
      return
    }
    const employee = await employeeService.getEmployee(id)
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found' })
      return
    }
    res.json({ success: true, data: employee })
  } catch (error) {
    logger.error('Get employee error:', error)
    res.status(500).json({ success: false, message: 'Error fetching employee' })
  }
})

// POST /employees
router.post('/', validate(createEmployeeSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const employee = await employeeService.createEmployee(req.body, userId)
    res.status(201).json({ success: true, data: employee })
  } catch (error: any) {
    logger.error('Create employee error:', error)
    if (error.code === 'P2002') {
      const target = Array.isArray(error?.meta?.target) ? (error.meta.target as string[]) : []
      const message = target.includes('numero_documento')
        ? 'Número de documento ya registrado'
        : 'Registro duplicado'
      res.status(409).json({ success: false, message })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating employee' })
  }
})

// PUT /employees/:id
router.put('/:id', requireEmployeeUnlocked('id'), validate(updateEmployeeSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid employee ID' })
      return
    }
    const userId = req.user!.id
    const employee = await employeeService.updateEmployee(id, req.body, userId)
    res.json({ success: true, data: employee })
  } catch (error: any) {
    logger.error('Update employee error:', error)
    if (error.message === 'Employee not found') {
      res.status(404).json({ success: false, message: 'Employee not found' })
      return
    }
    // qa-session-jul-24: surface service-level validation errors (status + field)
    if (error.status && typeof error.status === 'number') {
      const body: Record<string, unknown> = { success: false, message: error.message }
      if (error.field) body.field = error.field
      res.status(error.status).json(body)
      return
    }
    if (error.code === 'P2002') {
      const target = Array.isArray(error?.meta?.target) ? (error.meta.target as string[]) : []
      const message = target.includes('numero_documento')
        ? 'Número de documento ya registrado'
        : 'Registro duplicado'
      res.status(409).json({ success: false, message })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating employee' })
  }
})

// DELETE /employees/:id (soft delete)
router.delete('/:id', requireEmployeeUnlocked('id'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid employee ID' })
      return
    }
    await employeeService.deleteEmployee(id)
    res.json({ success: true, message: 'Employee deactivated successfully' })
  } catch (error: any) {
    logger.error('Delete employee error:', error)
    if (error.message === 'Employee not found') {
      res.status(404).json({ success: false, message: 'Employee not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error deleting employee' })
  }
})

// qa-session-jul-31 followup (aug-04): admin "bloqueador" lock/unlock.
// ADMIN-only. Sets/clears empleado.bloqueado + audit (bloqueadoPor/bloqueadoEn).
// The lock state is intentionally NOT part of the create/update payload, so a
// non-admin has no request path to change it — only these two endpoints do.
async function handleSetLock(req: Request, res: Response, locked: boolean): Promise<void> {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid employee ID' })
      return
    }
    const employee = await employeeService.setEmployeeLock(id, locked, req.user!.id)
    res.json({ success: true, data: employee })
  } catch (error: any) {
    logger.error('Set employee lock error:', error)
    if (error.message === 'Employee not found') {
      res.status(404).json({ success: false, message: 'Employee not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating employee lock' })
  }
}
router.put('/:id/lock', requireRole('ADMIN'), (req: Request, res: Response) => handleSetLock(req, res, true))
router.put('/:id/unlock', requireRole('ADMIN'), (req: Request, res: Response) => handleSetLock(req, res, false))

// PUT /employees/:id/cargos — replace all cargos
router.put('/:id/cargos', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const { cargos } = req.body
    if (!Array.isArray(cargos)) { res.status(400).json({ success: false, message: 'cargos must be an array' }); return }

    const prisma = getPrisma()
    await prisma.$transaction(async (tx: any) => {
      await tx.cargo.deleteMany({ where: { empleadoId: id } })
      if (cargos.length > 0) {
        await tx.cargo.createMany({
          data: cargos.map((c: any) => ({
            empleadoId: id,
            nombreCargo: c.nombreCargo,
            ubicacion: c.ubicacion,
            fechaIngreso: new Date(c.fechaIngreso),
            fechaTerminacion: c.fechaTerminacion ? new Date(c.fechaTerminacion) : null,
            salario: c.salario != null ? c.salario : null,
          })),
        })
      }
    })
    const updated = await employeeService.getEmployee(id)
    res.json({ success: true, data: updated?.cargos ?? [] })
  } catch (error: any) {
    logger.error('Update employee cargos error:', error)
    res.status(500).json({ success: false, message: 'Error updating cargos' })
  }
})

// PUT /employees/:id/nucleo-familiar — replace all nucleo familiar
router.put('/:id/nucleo-familiar', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const { nucleoFamiliar } = req.body
    if (!Array.isArray(nucleoFamiliar)) { res.status(400).json({ success: false, message: 'nucleoFamiliar must be an array' }); return }

    const prisma = getPrisma()
    await prisma.$transaction(async (tx: any) => {
      await tx.nucleoFamiliar.deleteMany({ where: { empleadoId: id } })
      if (nucleoFamiliar.length > 0) {
        await tx.nucleoFamiliar.createMany({
          data: nucleoFamiliar.map((nf: any) => ({
            empleadoId: id,
            nombre: nf.nombre,
            apellido: nf.apellido,
            tipoDocumento: nf.tipoDocumento,
            numeroDocumento: nf.numeroDocumento || null,
            fechaNacimiento: new Date(nf.fechaNacimiento),
            genero: nf.genero,
            parentesco: nf.parentesco,
            telefono: nf.telefono || null,
          })),
        })
      }
    })
    const updated = await employeeService.getEmployee(id)
    res.json({ success: true, data: updated?.nucleoFamiliar ?? [] })
  } catch (error: any) {
    logger.error('Update employee nucleo familiar error:', error)
    res.status(500).json({ success: false, message: 'Error updating nucleo familiar' })
  }
})

// PUT /employees/:id/contactos-emergencia — replace all emergency contacts
router.put('/:id/contactos-emergencia', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const { contactosEmergencia } = req.body
    if (!Array.isArray(contactosEmergencia)) { res.status(400).json({ success: false, message: 'contactosEmergencia must be an array' }); return }

    const prisma = getPrisma()
    await prisma.$transaction(async (tx: any) => {
      await tx.contactoEmergenciaEmpleado.deleteMany({ where: { empleadoId: id } })
      if (contactosEmergencia.length > 0) {
        await tx.contactoEmergenciaEmpleado.createMany({
          data: contactosEmergencia.map((c: any) => ({
            empleadoId: id,
            nombre: c.nombre,
            apellido: c.apellido,
            telefono: c.telefono,
            parentesco: c.parentesco,
          })),
        })
      }
    })
    const updated = await employeeService.getEmployee(id)
    res.json({ success: true, data: updated?.contactosEmergencia ?? [] })
  } catch (error: any) {
    logger.error('Update employee contactos emergencia error:', error)
    res.status(500).json({ success: false, message: 'Error updating contactos emergencia' })
  }
})

// PUT /employees/:id/experiencias-laborales — replace all work experiences
router.put('/:id/experiencias-laborales', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const { experienciasLaborales } = req.body
    if (!Array.isArray(experienciasLaborales)) { res.status(400).json({ success: false, message: 'experienciasLaborales must be an array' }); return }

    const prisma = getPrisma()
    await prisma.$transaction(async (tx: any) => {
      await tx.experienciaLaboralExterna.deleteMany({ where: { empleadoId: id } })
      if (experienciasLaborales.length > 0) {
        await tx.experienciaLaboralExterna.createMany({
          data: experienciasLaborales.map((e: any) => ({
            empleadoId: id,
            empresa: e.empresa,
            telefonoEmpresa: e.telefonoEmpresa || null,
            cargo: e.cargo,
            sector: e.sector || null,
            periodoInicio: new Date(e.periodoInicio),
            periodoFin: e.periodoFin ? new Date(e.periodoFin) : null,
            funcionesLogros: e.funcionesLogros || null,
          })),
        })
      }
    })
    const updated = await employeeService.getEmployee(id)
    res.json({ success: true, data: updated?.experienciasLaborales ?? [] })
  } catch (error: any) {
    logger.error('Update employee experiencias laborales error:', error)
    res.status(500).json({ success: false, message: 'Error updating experiencias laborales' })
  }
})

// PUT /employees/:id/educacion-idiomas — replace all education/languages
router.put('/:id/educacion-idiomas', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const { educacionIdiomas } = req.body
    if (!Array.isArray(educacionIdiomas)) { res.status(400).json({ success: false, message: 'educacionIdiomas must be an array' }); return }

    const prisma = getPrisma()
    await prisma.$transaction(async (tx: any) => {
      await tx.educacionIdiomas.deleteMany({ where: { empleadoId: id } })
      if (educacionIdiomas.length > 0) {
        await tx.educacionIdiomas.createMany({
          data: educacionIdiomas.map((e: any) => ({
            empleadoId: id,
            institucion: e.institucion,
            nivelEscritura: e.nivelEscritura,
            nivelHabla: e.nivelHabla,
            capacidadTraducir: e.capacidadTraducir ?? false,
          })),
        })
      }
    })
    const updated = await employeeService.getEmployee(id)
    res.json({ success: true, data: updated?.educacionIdiomas ?? [] })
  } catch (error: any) {
    logger.error('Update employee educacion idiomas error:', error)
    res.status(500).json({ success: false, message: 'Error updating educacion idiomas' })
  }
})

// PUT /employees/:id/vehiculos — replace all vehicles
router.put('/:id/vehiculos', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const { vehiculos } = req.body
    if (!Array.isArray(vehiculos)) { res.status(400).json({ success: false, message: 'vehiculos must be an array' }); return }

    const prisma = getPrisma()
    await prisma.$transaction(async (tx: any) => {
      await tx.vehiculo.deleteMany({ where: { empleadoId: id } })
      if (vehiculos.length > 0) {
        await tx.vehiculo.createMany({
          data: vehiculos.map((v: any) => ({
            empleadoId: id,
            tipoVehiculo: v.tipoVehiculo,
            placas: v.placas,
            tipoLicencia: v.tipoLicencia,
            numeroLicencia: v.numeroLicencia,
          })),
        })
      }
    })
    const updated = await employeeService.getEmployee(id)
    res.json({ success: true, data: updated?.vehiculos ?? [] })
  } catch (error: any) {
    logger.error('Update employee vehiculos error:', error)
    res.status(500).json({ success: false, message: 'Error updating vehiculos' })
  }
})

// PUT /employees/:id/datos-migracion — upsert migration data
router.put('/:id/datos-migracion', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const { datosMigracion } = req.body

    const prisma = getPrisma()
    const data = {
      numeroPasaporte: datosMigracion?.numeroPasaporte || '',
      pasaporteExpedicion: datosMigracion?.pasaporteExpedicion ? new Date(datosMigracion.pasaporteExpedicion) : new Date(),
      pasaporteVencimiento: datosMigracion?.pasaporteVencimiento ? new Date(datosMigracion.pasaporteVencimiento) : new Date(),
      numeroVisa: datosMigracion?.numeroVisa || null,
      visaExpedicion: datosMigracion?.visaExpedicion ? new Date(datosMigracion.visaExpedicion) : null,
      visaVencimiento: datosMigracion?.visaVencimiento ? new Date(datosMigracion.visaVencimiento) : null,
    }

    const result = await prisma.datosMigracion.upsert({
      where: { empleadoId: id },
      create: { empleadoId: id, ...data },
      update: data,
    })
    res.json({ success: true, data: result })
  } catch (error: any) {
    logger.error('Update employee datos migracion error:', error)
    res.status(500).json({ success: false, message: 'Error updating datos migracion' })
  }
})

// PUT /employees/:id/certificados — replace all certificados (generic CertificadoEmpleado)
const certificadosPutSchema = z.object({
  certificados: z.array(z.object({
    tipo: z.enum(['ALTURAS', 'RIESGO_ELECTRICO', 'MANIPULACION_ALIMENTOS', 'OTRO']),
    nombre: z.string().max(200).optional().nullable(),
    fechaExpedicion: z.string().min(1),
    fechaVencimiento: z.string().min(1),
    archivoUrl: z.string().max(500).optional().nullable(),
  })),
})
router.put('/:id/certificados', requireRole('ADMIN'), validate(certificadosPutSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const { certificados } = req.body
    if (!Array.isArray(certificados)) { res.status(400).json({ success: false, message: 'certificados must be an array' }); return }

    const prisma = getPrisma()

    await prisma.$transaction(async (tx: any) => {
      await tx.certificadoEmpleado.deleteMany({ where: { empleadoId: id } })
      if (certificados.length > 0) {
        await tx.certificadoEmpleado.createMany({
          data: certificados.map((c: any) => ({
            empleadoId: id,
            tipo: c.tipo,
            nombre: c.tipo === 'OTRO' ? (c.nombre || null) : null,
            fechaExpedicion: new Date(c.fechaExpedicion),
            fechaVencimiento: new Date(c.fechaVencimiento),
            archivoUrl: c.archivoUrl || null,
          })),
        })
      }
    })

    const updated = await employeeService.getEmployee(id)
    res.json({ success: true, data: updated?.certificados ?? [] })
  } catch (error: any) {
    logger.error('Update employee certificados error:', error)
    res.status(500).json({ success: false, message: 'Error updating certificados' })
  }
})

// ───

// ─── jul-9 D2: EducacionEmpleado CRUD ───

const createEducacionSchema = z.object({
  profesion: z.string().min(1).max(200),
  universidad: z.string().max(200).optional().nullable(),
  fechaGraduacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  diplomaUrl: z.string().max(500).optional().nullable(),
})

const updateEducacionSchema = createEducacionSchema.partial()

router.get('/:id/educacion', async (req: Request, res: Response): Promise<void> => {
  try {
    const empleadoId = parseInt(req.params.id as string)
    if (isNaN(empleadoId)) { res.status(400).json({ success: false, message: 'Invalid empleado ID' }); return }
    const data = await educacionService.listEducacion(empleadoId)
    res.json({ success: true, data })
  } catch (error: any) {
    logger.error('List educacion empleado error:', error)
    if (error.message === 'Empleado not found') { res.status(404).json({ success: false, message: 'Empleado not found' }); return }
    res.status(500).json({ success: false, message: 'Error listing educacion' })
  }
})

router.post('/:id/educacion', requireRole('ADMIN'), validate(createEducacionSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const empleadoId = parseInt(req.params.id as string)
    if (isNaN(empleadoId)) { res.status(400).json({ success: false, message: 'Invalid empleado ID' }); return }
    const data = await educacionService.createEducacion(empleadoId, req.body)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    logger.error('Create educacion empleado error:', error)
    if (error.message === 'Empleado not found') { res.status(404).json({ success: false, message: 'Empleado not found' }); return }
    res.status(500).json({ success: false, message: 'Error creating educacion' })
  }
})

router.patch('/:id/educacion/:eduId', requireRole('ADMIN'), validate(updateEducacionSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const empleadoId = parseInt(req.params.id as string)
    const eduId = parseInt(req.params.eduId as string)
    if (isNaN(empleadoId) || isNaN(eduId)) { res.status(400).json({ success: false, message: 'Invalid IDs' }); return }
    const data = await educacionService.updateEducacion(empleadoId, eduId, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    logger.error('Update educacion empleado error:', error)
    if (error.message === 'EducacionEmpleado not found') { res.status(404).json({ success: false, message: 'EducacionEmpleado not found' }); return }
    res.status(500).json({ success: false, message: 'Error updating educacion' })
  }
})

router.delete('/:id/educacion/:eduId', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const empleadoId = parseInt(req.params.id as string)
    const eduId = parseInt(req.params.eduId as string)
    if (isNaN(empleadoId) || isNaN(eduId)) { res.status(400).json({ success: false, message: 'Invalid IDs' }); return }
    await educacionService.deleteEducacion(empleadoId, eduId)
    // jul-9 D2 (QA GAP-3): contract §3.1 calls for 204 No Content on DELETE.
    res.status(204).end()
  } catch (error: any) {
    logger.error('Delete educacion empleado error:', error)
    if (error.message === 'EducacionEmpleado not found') { res.status(404).json({ success: false, message: 'EducacionEmpleado not found' }); return }
    res.status(500).json({ success: false, message: 'Error deleting educacion' })
  }
})

// GET /employees/:id/pendientes — manual + derived
router.get('/:id/pendientes', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const result = await employeeService.listPendientes(id)
    res.json({ success: true, ...result })
  } catch (error: any) {
    logger.error('List pendientes error:', error)
    if (error.message === 'Employee not found') {
      res.status(404).json({ success: false, message: 'Employee not found' }); return
    }
    res.status(500).json({ success: false, message: 'Error listing pendientes' })
  }
})

// POST /employees/:id/pendientes (ADMIN)
const createPendienteSchema = z.object({
  descripcion: z.string().min(1).max(500),
})
router.post('/:id/pendientes', requireRole('ADMIN'), validate(createPendienteSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const userId = req.user!.id
    const p = await employeeService.createPendiente(id, userId, req.body.descripcion)
    res.status(201).json({ success: true, data: p })
  } catch (error: any) {
    logger.error('Create pendiente error:', error)
    if (error.message === 'Employee not found') {
      res.status(404).json({ success: false, message: 'Employee not found' }); return
    }
    res.status(500).json({ success: false, message: 'Error creating pendiente' })
  }
})

// PATCH /employees/:id/pendientes/:pid (ADMIN) — resolver
const patchPendienteSchema = z.object({
  estado: z.enum(['PENDIENTE', 'RESUELTO']),
})
router.patch('/:id/pendientes/:pid', requireRole('ADMIN'), validate(patchPendienteSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    const pid = parseInt(req.params.pid as string)
    if (isNaN(id) || isNaN(pid)) { res.status(400).json({ success: false, message: 'Invalid IDs' }); return }
    const updated = await employeeService.patchPendiente(id, pid, req.body.estado)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    logger.error('Patch pendiente error:', error)
    if (error.message === 'Pendiente not found') {
      res.status(404).json({ success: false, message: 'Pendiente not found' }); return
    }
    res.status(500).json({ success: false, message: 'Error updating pendiente' })
  }
})

// DELETE /employees/:id/pendientes/:pid (ADMIN)
router.delete('/:id/pendientes/:pid', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    const pid = parseInt(req.params.pid as string)
    if (isNaN(id) || isNaN(pid)) { res.status(400).json({ success: false, message: 'Invalid IDs' }); return }
    await employeeService.deletePendiente(id, pid)
    res.json({ success: true, message: 'Pendiente eliminado' })
  } catch (error: any) {
    logger.error('Delete pendiente error:', error)
    if (error.message === 'Pendiente not found') {
      res.status(404).json({ success: false, message: 'Pendiente not found' }); return
    }
    res.status(500).json({ success: false, message: 'Error deleting pendiente' })
  }
})

// ─── 

router.get('/:id/novedades', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const data = await employeeService.listNovedades(id)
    res.json({ success: true, data })
  } catch (error: any) {
    logger.error('List novedades error:', error)
    if (error.message === 'Employee not found') { res.status(404).json({ success: false, message: 'Employee not found' }); return }
    res.status(500).json({ success: false, message: 'Error listing novedades' })
  }
})

const createNovedadSchema = z.object({
  tipo: z.enum(['LLAMADO_ATENCION', 'MEMORANDO', 'PERMISO', 'VACACIONES', 'OTRA']),
  titulo: z.string().min(1).max(200),
  descripcion: z.string().optional(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  archivos: z
    .array(z.object({ nombre: z.string().min(1).max(200), url: z.string().min(1) }))
    .optional(),
})

router.post('/:id/novedades', requireRole('ADMIN'), validate(createNovedadSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid employee ID' }); return }
    const userId = req.user!.id
    const created = await employeeService.createNovedad(id, userId, req.body)
    res.status(201).json({ success: true, data: created })
  } catch (error: any) {
    logger.error('Create novedad error:', error)
    if (error.message === 'Employee not found') { res.status(404).json({ success: false, message: 'Employee not found' }); return }
    res.status(500).json({ success: false, message: 'Error creating novedad' })
  }
})

router.put('/:id/novedades/:nid', requireRole('ADMIN'), validate(createNovedadSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    const nid = parseInt(req.params.nid as string)
    if (isNaN(id) || isNaN(nid)) { res.status(400).json({ success: false, message: 'Invalid IDs' }); return }
    const updated = await employeeService.updateNovedad(id, nid, req.body)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    logger.error('Update novedad error:', error)
    if (error.message === 'Novedad not found') { res.status(404).json({ success: false, message: 'Novedad not found' }); return }
    res.status(500).json({ success: false, message: 'Error updating novedad' })
  }
})

router.delete('/:id/novedades/:nid', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    const nid = parseInt(req.params.nid as string)
    if (isNaN(id) || isNaN(nid)) { res.status(400).json({ success: false, message: 'Invalid IDs' }); return }
    await employeeService.deleteNovedad(id, nid)
    res.json({ success: true, message: 'Novedad eliminada' })
  } catch (error: any) {
    logger.error('Delete novedad error:', error)
    if (error.message === 'Novedad not found') { res.status(404).json({ success: false, message: 'Novedad not found' }); return }
    res.status(500).json({ success: false, message: 'Error deleting novedad' })
  }
})

export { router as employeeRoutes }
