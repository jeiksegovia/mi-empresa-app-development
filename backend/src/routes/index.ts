import { Router } from 'express'
import { authRoutes } from './auth.js'
import { dashboardRoutes } from './dashboard.routes.js'
import { employeeRoutes } from './employees.routes.js'
import { patientRoutes } from './patients.routes.js'
import { instrumentRoutes } from './instruments.routes.js'
import { empresaRoutes } from './empresa.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/employees', employeeRoutes)
router.use('/patients', patientRoutes)
router.use('/instruments', instrumentRoutes)
router.use('/empresa', empresaRoutes)

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export { router as apiRoutes }
