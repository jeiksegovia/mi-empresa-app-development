import { Router } from 'express'
import * as controller from '../../controllers/public/requests.controller'
import { authMiddleware } from '../../middleware/auth'

const router = Router()

// Public endpoints that don't require authentication
router.get('/exemptions', controller.getExemptions)
router.get('/exclusions', controller.getExclusions)

// Protected endpoints that require authentication
router.use(authMiddleware)

router.get('/', controller.getAll)
router.get('/by-number/:requestNumber', controller.getOneByNumber)
router.get('/:id', controller.getOne)
router.post('/', controller.create)
router.put('/:id', controller.update)

export default router
