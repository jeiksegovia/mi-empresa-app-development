import { Router } from 'express'
import { authRoutes } from './auth.js'
import { dashboardRoutes } from './dashboard.routes.js'
import { employeeRoutes } from './employees.routes.js'
import { patientRoutes } from './patients.routes.js'
import { nominaRoutes } from './nomina.routes.js'
import { instrumentRoutes } from './instruments.routes.js'
import { empresaRoutes } from './empresa.routes.js'
import { uploadRoutes } from './uploads.routes.js'
import { certificateRoutes } from './certificates.routes.js'
import { userRoutes } from './users.routes.js'
import { asistenciaRoutes } from './asistencia.routes.js'
import { centroCostosRoutes } from './centroCostos.routes.js'
import { actividadesRoutes } from './actividades.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/employees', employeeRoutes)
router.use('/nomina', nominaRoutes)
router.use('/asistencia', asistenciaRoutes)
router.use('/patients', patientRoutes)
router.use('/instruments', instrumentRoutes)
router.use('/empresa', empresaRoutes)
router.use('/uploads', uploadRoutes)
router.use('/certificates', certificateRoutes)
router.use('/users', userRoutes)
router.use('/centro-costos', centroCostosRoutes)
router.use('/actividades', actividadesRoutes)

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export { router as apiRoutes }
