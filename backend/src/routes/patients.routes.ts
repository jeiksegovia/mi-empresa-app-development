import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { z } from 'zod'
import * as patientService from '../services/patientService.js'
import { logger } from '../config/logger.js'

const router = Router()

// Apply auth to all routes
router.use(authMiddleware())

// Zod schemas for validation
const createPatientSchema = z.object({
  nombre: z.string().min(1).max(100),
  tipoDocumento: z.enum(['CC', 'CE', 'PASAPORTE', 'REGISTRO_CIVIL']),
  numeroDocumento: z.string().min(1).max(50),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  genero: z.string().min(1).max(20),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  notas: z.string().optional(),
  informacionSeguro: z.string().optional(),
  observacionesEspeciales: z.string().optional(),
  contactosEmergencia: z
    .array(
      z.object({
        nombre: z.string().min(1),
        telefono: z.string().min(1),
        parentesco: z.string().min(1),
      }),
    )
    .optional(),
})

const updatePatientSchema = createPatientSchema
  .partial()
  .omit({ contactosEmergencia: true })

// GET /patients - list with pagination/search/filter
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const search = req.query.search as string | undefined
    const estado = req.query.estado as 'ACTIVO' | 'INACTIVO' | undefined

    const result = await patientService.listPatients({ page, limit, search, estado })
    res.json({ success: true, ...result })
  } catch (error) {
    logger.error('List patients error:', error)
    res.status(500).json({ success: false, message: 'Error fetching patients' })
  }
})

// GET /patients/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' })
      return
    }
    const patient = await patientService.getPatient(id)
    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    res.json({ success: true, data: patient })
  } catch (error) {
    logger.error('Get patient error:', error)
    res.status(500).json({ success: false, message: 'Error fetching patient' })
  }
})

// POST /patients
router.post('/', validate(createPatientSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patient = await patientService.createPatient(req.body)
    res.status(201).json({ success: true, data: patient })
  } catch (error: any) {
    logger.error('Create patient error:', error)
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Número de documento ya registrado' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating patient' })
  }
})

// PUT /patients/:id
router.put('/:id', validate(updatePatientSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' })
      return
    }
    const patient = await patientService.updatePatient(id, req.body)
    res.json({ success: true, data: patient })
  } catch (error: any) {
    logger.error('Update patient error:', error)
    if (error.message === 'Patient not found') {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Número de documento ya registrado' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating patient' })
  }
})

// DELETE /patients/:id (soft delete)
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' })
      return
    }
    await patientService.deletePatient(id)
    res.json({ success: true, message: 'Patient deactivated successfully' })
  } catch (error: any) {
    logger.error('Delete patient error:', error)
    if (error.message === 'Patient not found') {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error deleting patient' })
  }
})

export { router as patientRoutes }
