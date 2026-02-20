import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { logger } from '../config/logger'

export async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true })
}

export async function generatePreview(filePath: string, mimeType: string) {
  try {
    if (mimeType.startsWith('image/')) {
      const data = await fs.promises.readFile(filePath)
      const base64 = data.toString('base64')
      return { previewDataUrl: `data:${mimeType};base64,${base64}`, previewType: 'image' }
    }
    if (mimeType === 'application/pdf') {
      // Placeholder: advanced first-page render would load first page to PNG
      return { previewDataUrl: null, previewType: 'pdf-placeholder' }
    }
    return { previewDataUrl: null, previewType: 'placeholder' }
  } catch (e) {
    logger.error('Preview generation failed', e)
    return { previewDataUrl: null, previewType: 'error' }
  }
}

export function safeUnlink(filePath: string) {
  fs.unlink(filePath, (err) => {
    if (err) logger.warn('Failed to delete file', filePath, err.message)
  })
}

export function buildStoredFilename(original: string) {
  const ts = Date.now()
  const base = path.basename(original).replace(/[^a-zA-Z0-9_.-]/g, '_')
  return `${ts}_${base}`
}
