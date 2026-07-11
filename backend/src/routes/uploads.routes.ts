import { Router, Request, Response, RequestHandler } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { generateUploadUrl, generateDownloadUrl, CredentialsExpiredError } from '../services/s3Service.js'
import { logger } from '../config/logger.js'

const presignedUrlSchema = z.object({
  contentType: z.string().min(1),
  folder: z.string().optional(),
  filename: z.string().optional(),
})

// W12 (I1): if presigning is refused because the active STS credentials
// are expired or expiring inside the safety margin, map to a 503 with a
// stable `CREDS_EXPIRED` code and a Spanish user-facing message. The
// service throws a typed `CredentialsExpiredError` carrying `.code` and
// `.status`; any other error keeps the legacy 500 behavior.
//
// Spanish per project convention — single source of truth for the
// user-facing copy so future rotations stay consistent.
export function isCredsExpired(error: unknown): boolean {
  return (
    error instanceof CredentialsExpiredError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'CREDS_EXPIRED')
  )
}

/**
 * Build the upload routes router. Accepts an auth middleware so the
 * router is unit-testable with a stub auth (bypassing DB lookups).
 * Production usage in `routes/index.ts` passes the real `authMiddleware()`.
 */
export function createUploadRoutes(authMw: RequestHandler = authMiddleware()): Router {
  const router = Router()
  router.use(authMw)

  // POST /uploads/presigned-url
  router.post('/presigned-url', validate(presignedUrlSchema), async (req: Request, res: Response): Promise<void> => {
    try {
      const { contentType, folder } = req.body
      const ext = contentType.split('/')[1] || 'bin'
      const key = `${folder || 'uploads'}/${crypto.randomUUID()}.${ext}`
      const uploadUrl = await generateUploadUrl(key, contentType)
      res.json({ success: true, data: { uploadUrl, key } })
    } catch (error) {
      if (isCredsExpired(error)) {
        logger.error('Presign refused: AWS credentials expired (CREDS_EXPIRED):', error)
        res.status(503).json({
          success: false,
          message: 'Servicio de archivos temporalmente no disponible',
          code: 'CREDS_EXPIRED',
        })
        return
      }
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
      if (isCredsExpired(error)) {
        logger.error('Presign refused: AWS credentials expired (CREDS_EXPIRED):', error)
        res.status(503).json({
          success: false,
          message: 'Servicio de archivos temporalmente no disponible',
          code: 'CREDS_EXPIRED',
        })
        return
      }
      logger.error('Generate download URL error:', error)
      res.status(500).json({ success: false, message: 'Error generating download URL' })
    }
  })

  return router
}

// Default instance — used by `routes/index.ts` in production.
const router = createUploadRoutes()

export { router as uploadRoutes }
