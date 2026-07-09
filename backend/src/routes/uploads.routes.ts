import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { generateUploadUrl, generateDownloadUrl } from '../services/s3Service.js'
import { logger } from '../config/logger.js'

const router = Router()

router.use(authMiddleware())

const presignedUrlSchema = z.object({
  contentType: z.string().min(1),
  folder: z.string().optional(),
  filename: z.string().optional(),
})

// POST /uploads/presigned-url
router.post('/presigned-url', validate(presignedUrlSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentType, folder } = req.body
    const ext = contentType.split('/')[1] || 'bin'
    const key = `${folder || 'uploads'}/${crypto.randomUUID()}.${ext}`
    const uploadUrl = await generateUploadUrl(key, contentType)
    res.json({ success: true, data: { uploadUrl, key } })
  } catch (error) {
    logger.error('Generate presigned URL error:', error)
    res.status(500).json({ success: false, message: 'Error generating upload URL' })
  }
})

// GET /uploads/download-url?key=... (key is the S3 object key)
router.get('/download-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const key = req.query.key as string
    if (!key) {
      res.status(400).json({ success: false, message: 'Key is required' })
      return
    }
    const downloadUrl = await generateDownloadUrl(key)
    res.json({ success: true, data: { downloadUrl } })
  } catch (error) {
    logger.error('Generate download URL error:', error)
    res.status(500).json({ success: false, message: 'Error generating download URL' })
  }
})

export { router as uploadRoutes }
