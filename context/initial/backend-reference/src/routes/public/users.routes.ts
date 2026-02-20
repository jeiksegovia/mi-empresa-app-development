import { Router } from 'express'
import * as controller from '../../controllers/public/users.controller'
import { authMiddleware } from '../../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/profile/me', controller.getCurrentUserProfile)

router.get('/:id', controller.getById)
router.get('/idme/:idmeId', controller.getByIDMeId)

export default router
