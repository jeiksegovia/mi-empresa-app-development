import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { z } from 'zod'
import * as employeeService from '../services/employeeService.js'
import { logger } from '../config/logger.js'

const router = Router()

// Apply auth to all routes
router.use(authMiddleware())

// Zod schemas for validation
const createEmployeeSchema = z.object({
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  tipoDocumento: z.enum(['CC', 'CE', 'PASAPORTE']),
  numeroDocumento: z.string().min(1).max(50),
  genero: z.string().min(1).max(20),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  permisoTrabajo: z.boolean().optional(),
  tipoVivienda: z.enum(['CASA', 'APARTAMENTO', 'LOTE']).optional(),
  direccion: z.string().optional(),
  estratoSocioeconomico: z.number().int().min(1).max(6).optional(),
  estadoCivil: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  cargos: z
    .array(
      z.object({
        fechaIngreso: z.string(),
        nombreCargo: z.string().min(1),
        ubicacion: z.string().min(1),
        fechaTerminacion: z.string().optional(),
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
    nivelEscritura: z.string().min(1),
    nivelHabla: z.string().min(1),
    capacidadTraducir: z.boolean(),
  })).optional(),
  vehiculos: z.array(z.object({
    tipoVehiculo: z.string().min(1),
    placas: z.string().min(1),
    tipoLicencia: z.string().min(1),
    numeroLicencia: z.string().min(1),
  })).optional(),
  certificadoAlturas: z.object({
    fechaExpedicion: z.string(),
    fechaVencimiento: z.string(),
  }).optional(),
  certificadoRiesgoElectrico: z.object({
    fechaExpedicion: z.string(),
    fechaVencimiento: z.string(),
  }).optional(),
  datosMigracion: z.object({
    numeroPasaporte: z.string().optional(),
    pasaporteExpedicion: z.string().optional(),
    pasaporteVencimiento: z.string().optional(),
    numeroVisa: z.string().optional(),
    visaExpedicion: z.string().optional(),
    visaVencimiento: z.string().optional(),
  }).optional(),
})

const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .omit({ cargos: true, contactosEmergencia: true, nucleoFamiliar: true, experienciasLaborales: true, educacionIdiomas: true, vehiculos: true, certificadoAlturas: true, certificadoRiesgoElectrico: true, datosMigracion: true })

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
    const employee = await employeeService.createEmployee(req.body)
    res.status(201).json({ success: true, data: employee })
  } catch (error: any) {
    logger.error('Create employee error:', error)
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Número de documento ya registrado' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating employee' })
  }
})

// PUT /employees/:id
router.put('/:id', validate(updateEmployeeSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid employee ID' })
      return
    }
    const employee = await employeeService.updateEmployee(id, req.body)
    res.json({ success: true, data: employee })
  } catch (error: any) {
    logger.error('Update employee error:', error)
    if (error.message === 'Employee not found') {
      res.status(404).json({ success: false, message: 'Employee not found' })
      return
    }
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Número de documento ya registrado' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating employee' })
  }
})

// DELETE /employees/:id (soft delete)
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
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

export { router as employeeRoutes }
