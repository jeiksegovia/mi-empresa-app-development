import { Router, Request, Response } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { z } from 'zod'
import * as empresaService from '../services/empresaService.js'
import { logger } from '../config/logger.js'

const router = Router()

router.use(authMiddleware())

const updateEmpresaSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  nit: z.string().min(1).max(50).optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
})

// GET /empresa - get current empresa (admin only)
router.get('/', requireRole('ADMIN'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const empresa = await empresaService.getEmpresa()
    if (!empresa) {
      res.status(404).json({ success: false, message: 'Empresa not found' })
      return
    }
    res.json({ success: true, data: empresa })
  } catch (error) {
    logger.error('Get empresa error:', error)
    res.status(500).json({ success: false, message: 'Error fetching empresa' })
  }
})

// PUT /empresa/:id - update empresa (admin only)
router.put('/:id', requireRole('ADMIN'), validate(updateEmpresaSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid empresa ID' })
      return
    }
    const empresa = await empresaService.updateEmpresa(id, req.body)
    res.json({ success: true, data: empresa })
  } catch (error: any) {
    logger.error('Update empresa error:', error)
    if (error.message === 'Empresa not found') {
      res.status(404).json({ success: false, message: 'Empresa not found' })
      return
    }
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'NIT ya registrado' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating empresa' })
  }
})

export { router as empresaRoutes }
