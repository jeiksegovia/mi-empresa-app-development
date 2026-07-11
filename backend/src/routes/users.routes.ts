import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { getPrisma } from '../config/database.js'
import { logger } from '../config/logger.js'

const router = Router()

router.use(authMiddleware())

// jul-10 C6 / T3: usuario create + update now pass through tipoEmpleado (L2).
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  rol: z.enum(['ADMIN', 'EMPLEADO', 'AUDITOR', 'OPERADOR']),
  // jul-10 E1: upper-case + trim on entity name fields
  nombre: z.string().min(1).max(100).transform((v) => v.trim().toUpperCase()),
  apellido: z.string().min(1).max(100).transform((v) => v.trim().toUpperCase()),
  empleadoId: z.number().int().positive().optional().nullable(),
  // jul-10 C6/L2: nullable — only meaningful when rol='EMPLEADO'
  tipoEmpleado: z.enum(['GERONTOLOGA']).optional().nullable(),
})

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  rol: z.enum(['ADMIN', 'EMPLEADO', 'AUDITOR', 'OPERADOR']).optional(),
  nombre: z.string().min(1).max(100).transform((v) => v.trim().toUpperCase()).optional(),
  apellido: z.string().min(1).max(100).transform((v) => v.trim().toUpperCase()).optional(),
  empleadoId: z.number().int().positive().optional().nullable(),
  // tipoEmpleado can be set OR cleared (null). Lock to ADMIN/GERONTOLOGA-present pairing rule.
  tipoEmpleado: z.enum(['GERONTOLOGA']).nullable().optional(),
  activo: z.boolean().optional(),
})

function shapeUsuario(u: any) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    apellido: u.apellido,
    rol: u.rol,
    tipoEmpleado: u.tipoEmpleado ?? null,
    empleadoId: u.empleadoId ?? null,
    activo: u.activo,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }
}

// GET /api/v1/users — list (ADMIN only)
router.get('/', requireRole('ADMIN'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const prisma = getPrisma()
    const data = await prisma.usuario.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        tipoEmpleado: true,
        empleadoId: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    res.json({ success: true, data: data.map(shapeUsuario), total: data.length })
  } catch (error) {
    logger.error('List users error:', error)
    res.status(500).json({ success: false, message: 'Error listing users' })
  }
})

// POST /api/v1/users — create (ADMIN only)
router.post('/', requireRole('ADMIN'), validate(createUserSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const prisma = getPrisma()
    const passwordHash = await bcrypt.hash(req.body.password, 10)

    // Only allow tipoEmpleado when rol='EMPLEADO'. Reject mismatches.
    if (req.body.tipoEmpleado && req.body.rol !== 'EMPLEADO') {
      res.status(400).json({
        success: false,
        message: 'tipoEmpleado is only valid when rol="EMPLEADO"',
        field: 'tipoEmpleado',
      })
      return
    }

    const created = await prisma.usuario.create({
      data: {
        email: req.body.email,
        password: passwordHash,
        rol: req.body.rol as any,
        nombre: req.body.nombre,
        apellido: req.body.apellido,
        empleadoId: req.body.empleadoId ?? null,
        // explicit: only set when rol=EMPLEADO; otherwise null in DB even if absent in body
        tipoEmpleado: req.body.rol === 'EMPLEADO' ? (req.body.tipoEmpleado as any) : null,
      },
    })
    res.status(201).json({ success: true, data: shapeUsuario(created) })
  } catch (error: any) {
    logger.error('Create user error:', error)
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Email already registered', field: 'email' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating user' })
  }
})

// PATCH /api/v1/users/:id — update (ADMIN only)
router.patch('/:id', requireRole('ADMIN'), validate(updateUserSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid user ID' })
      return
    }

    const prisma = getPrisma()
    const existing = await prisma.usuario.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }

    const nextRol = req.body.rol ?? existing.rol
    let nextTipo: any = req.body.tipoEmpleado === undefined ? existing.tipoEmpleado : req.body.tipoEmpleado

    // Normalize: if nextRol is not EMPLEADO, force tipoEmpleado=null even if payload set it.
    if (nextRol !== 'EMPLEADO') {
      nextTipo = null
    }
    // If nextRol is EMPLEADO but payload tried to set non-GERONTOLOGA, reject
    if (nextRol === 'EMPLEADO' && req.body.tipoEmpleado && req.body.tipoEmpleado !== 'GERONTOLOGA') {
      res.status(400).json({
        success: false,
        message: 'tipoEmpleado must be "GERONTOLOGA" (only enum value)',
        field: 'tipoEmpleado',
      })
      return
    }

    const updateData: Record<string, unknown> = {
      ...req.body,
      tipoEmpleado: nextTipo,
    }
    if (req.body.password) {
      updateData.password = await bcrypt.hash(req.body.password, 10)
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: updateData as any,
    })
    res.json({ success: true, data: shapeUsuario(updated) })
  } catch (error: any) {
    logger.error('Update user error:', error)
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Email already registered', field: 'email' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating user' })
  }
})

export { router as userRoutes }
