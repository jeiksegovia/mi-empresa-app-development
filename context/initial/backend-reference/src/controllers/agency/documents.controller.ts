import { Request, Response, NextFunction } from 'express'
import * as service from '../../services/documents.service'
import * as s3Service from '../../services/s3.service'
import { mapDocument } from '../../utils/responseMapper'
import { MulterFile } from '../../types/common'
import { CompleteUploadEntryRequest, InitiateMultipartUploadRequest, GenerateMultipartPartRequest, CompleteMultipartUploadRequest } from '../../types/documents'
import { getPrisma } from '../../config/database'

const prisma =  getPrisma();

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const docs = await service.listDocuments(req.params.id)
    res.json(docs.map(mapDocument))
  } catch (error) {
    next(error)
  }
}

export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    const files = (req as any).files as MulterFile[] | undefined
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files provided' })
    const created = await service.createDocuments(req.params.id, files)
    res.json(created.map(mapDocument))
  } catch (error) {
    next(error)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const ok = await service.deleteDocument(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Document not found' })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, reviewNotes } = req.body
    const doc = await service.updateDocumentStatus(req.params.id, status, reviewNotes)
    if (!doc) return res.status(404).json({ error: 'Document not found' })
    res.json(mapDocument(doc))
  } catch (error) {
    next(error)
  }
}

export async function initiateUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const { documentName, useMultipart }: InitiateMultipartUploadRequest = req.body
    const requestId = req.params.id

    if (!documentName?.trim()) {
      return res.status(400).json({ error: 'Document name is required' })
    }

    // Validate that the request exists and user can process it
    const canProcess = await service.validateUserCanProcessRequest(
      requestId, 
      (req as any).user?.id, 
      (req as any).user?.permissions
    )
    if (!canProcess) {
      return res.status(403).json({ error: 'You do not have permission to upload documents for this request' })
    }

    if (useMultipart) {
      // Generate multipart upload initiation
      const uploadData = await s3Service.initiateMultipartUpload(requestId, documentName.trim())
      
      res.json({ 
        uploadId: uploadData.uploadId,
        s3Key: uploadData.s3Key,
        isMultipart: true
      })
    } else {
      // Generate regular pre-signed URL
      const uploadData = await s3Service.generateUploadUrl(requestId, documentName.trim())

      res.json({ 
        uploadUrl: uploadData.uploadUrl,
        s3Key: uploadData.s3Key,
        isMultipart: false
      })
    }
  } catch (error) {
    next(error)
  }
}

export async function initiateDownload(req: Request, res: Response, next: NextFunction) {
  try {
    const documentId = req.params.id
    const { expiresIn } = req.body

    // Get document from database first
    const document = await service.getDocumentById(documentId)
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Validate that the document exists and user can access it
    const canAccess = await service.validateUserCanAccessDocument(
      documentId,
      (req as any).user?.id,
      (req as any).user?.permissions
    )
    if (!canAccess) {
      return res.status(403).json({ error: 'You do not have permission to access this document' })
    }

    // Generate pre-signed download URL
    const downloadData = await s3Service.generateDownloadUrl(
      document.filePath, 
      document.filename,
      expiresIn || 3600
    )

    res.json({
      downloadUrl: downloadData.downloadUrl,
      expiresAt: downloadData.expiresAt,
      document: {
        id: document.id,
        filename: document.filename,
        originalFilename: document.originalFilename,
        fileSize: document.fileSize.toString(),
        mimeType: document.mimeType
      }
    })
  } catch (error) {
    next(error)
  }
}

export async function preview(req: Request, res: Response, next: NextFunction) {
  try {
    const documentId = req.params.id
    
    // Get document from database
    const document = await service.getDocumentById(documentId)
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    // Validate that the user can access this document
    const canProcess = await service.validateUserCanProcessRequest(
      document.foiaRequestId, 
      (req as any).user?.id, 
      (req as any).user?.permissions
    )
    if (!canProcess) {
      return res.status(403).json({ error: 'You do not have permission to access this document' })
    }
    
    // Get document from S3 and convert to base64
    const { base64, mimeType } = await s3Service.getDocumentAsBase64(document.filePath)
    
    res.json({
      id: document.id,
      filename: document.filename,
      originalFilename: document.originalFilename,
      mimeType: mimeType,
      base64: base64,
      fileSize: document.fileSize.toString()
    })
  } catch (error) {
    next(error)
  }
}

export async function completeUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const { documentName, s3Key, fileSize, mimeType }: CompleteUploadEntryRequest = req.body
    const requestId = req.params.id

    if (!documentName?.trim()) {
      return res.status(400).json({ error: 'Document name is required' })
    }
    if (!s3Key?.trim()) {
      return res.status(400).json({ error: 'S3 key is required' })
    }
    if (!fileSize || fileSize <= 0) {
      return res.status(400).json({ error: 'Valid file size is required' })
    }

    const canProcess = await service.validateUserCanProcessRequest(
      requestId, 
      (req as any).user?.id, 
      (req as any).user?.permissions
    )
    if (!canProcess) {
      return res.status(403).json({ error: 'You do not have permission to upload documents for this request' })
    }

    // Create document entry in database
    const document = await service.completeUploadFromS3Upload(
      requestId,
      documentName.trim(),
      s3Key.trim(),
      fileSize,
      mimeType || 'application/octet-stream',
      (req as any).user?.id,
      (req as any).user?.permissions
    )

    res.status(201).json(mapDocument(document))
  } catch (error) {
    next(error)
  }
}

export async function generateMultipartPart(req: Request, res: Response, next: NextFunction) {
  try {
    const { s3Key, uploadId, partNumber }: GenerateMultipartPartRequest = req.body
    const requestId = req.params.id

    if (!s3Key?.trim()) {
      return res.status(400).json({ error: 'S3 key is required' })
    }
    if (!uploadId?.trim()) {
      return res.status(400).json({ error: 'Upload ID is required' })
    }
    if (!partNumber || partNumber < 1) {
      return res.status(400).json({ error: 'Valid part number is required' })
    }

    // Validate that the request exists and user can process it
    const canProcess = await service.validateUserCanProcessRequest(
      requestId, 
      (req as any).user?.id, 
      (req as any).user?.permissions
    )
    if (!canProcess) {
      return res.status(403).json({ error: 'You do not have permission to upload documents for this request' })
    }

    // Generate presigned URL for the part
    const partData = await s3Service.generateMultipartUploadPartUrl(
      s3Key.trim(),
      uploadId.trim(),
      partNumber
    )

    res.json({
      uploadUrl: partData.uploadUrl,
      partNumber: partData.partNumber
    })
  } catch (error) {
    next(error)
  }
}

export async function completeMultipartUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const { s3Key, uploadId, parts, documentName, fileSize, mimeType }: CompleteMultipartUploadRequest = req.body
    const requestId = req.params.id

    if (!documentName?.trim()) {
      return res.status(400).json({ error: 'Document name is required' })
    }
    if (!s3Key?.trim()) {
      return res.status(400).json({ error: 'S3 key is required' })
    }
    if (!uploadId?.trim()) {
      return res.status(400).json({ error: 'Upload ID is required' })
    }
    if (!parts || parts.length === 0) {
      return res.status(400).json({ error: 'Parts are required' })
    }
    if (!fileSize || fileSize <= 0) {
      return res.status(400).json({ error: 'Valid file size is required' })
    }

    const canProcess = await service.validateUserCanProcessRequest(
      requestId, 
      (req as any).user?.id, 
      (req as any).user?.permissions
    )
    if (!canProcess) {
      return res.status(403).json({ error: 'You do not have permission to upload documents for this request' })
    }

    // Complete the multipart upload in S3
    await s3Service.completeMultipartUpload(
      s3Key.trim(),
      uploadId.trim(),
      parts
    )

    // Create document entry in database
    const document = await service.completeUploadFromS3Upload(
      requestId,
      documentName.trim(),
      s3Key.trim(),
      fileSize,
      mimeType || 'application/octet-stream',
      (req as any).user?.id,
      (req as any).user?.permissions
    )

    res.status(201).json(mapDocument(document))
  } catch (error) {
    next(error)
  }
}

export async function abortMultipartUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const { s3Key, uploadId } = req.body
    const requestId = req.params.id

    if (!s3Key?.trim()) {
      return res.status(400).json({ error: 'S3 key is required' })
    }
    if (!uploadId?.trim()) {
      return res.status(400).json({ error: 'Upload ID is required' })
    }

    const canProcess = await service.validateUserCanProcessRequest(
      requestId, 
      (req as any).user?.id, 
      (req as any).user?.permissions
    )
    if (!canProcess) {
      return res.status(403).json({ error: 'You do not have permission to upload documents for this request' })
    }

    // Abort the multipart upload in S3
    await s3Service.abortMultipartUpload(
      s3Key.trim(),
      uploadId.trim()
    )

    res.json({ success: true, message: 'Multipart upload aborted successfully' })
  } catch (error) {
    next(error)
  }
}

export async function handleWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const { action } = req.body
    const documentId = req.params.id

    if (!action) {
      return res.status(400).json({ error: 'Action is required' })
    }

    // Validate that the user can process this document
    const canProcess = await service.validateUserCanProcessDocument(
      documentId,
      (req as any).user?.id,
      (req as any).user?.permissions
    )
    if (!canProcess) {
      return res.status(403).json({ error: 'You do not have permission to process this document' })
    }

    // Handle different workflow actions
    const result = await service.handleDocumentWorkflow(documentId, action, (req as any).user?.id)
    
    if (!result) {
      return res.status(404).json({ error: 'Document not found' })
    }

    res.json({
      success: true,
      document: mapDocument(result.document),
      message: result.message
    })
  } catch (error) {
    next(error)
  }
}

export async function mockRedactionFlow(req: Request, res: Response, next: NextFunction) {
  try {
    const documentId = req.params.id

    // Validate that the user can process this document
    const canProcess = await service.validateUserCanProcessDocument(
      documentId,
      (req as any).user?.id,
      (req as any).user?.permissions
    )
    if (!canProcess) {
      return res.status(403).json({ error: 'You do not have permission to process this document' })
    }

    // Get the specific document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { foiaRequest: true }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (document.status !== 'NEEDS_REDACTION') {
      return res.status(400).json({ 
        error: `Document must be in NEEDS_REDACTION status to process redaction. Current status: ${document.status}` 
      })
    }

    const requestId = document.foiaRequestId
    const filename = document.filename

    try {
      // Simulate Hyperscience redaction process
      // 1. Move from hyperscience/{requestId}/ready/ to hyperscience/{requestId}/redacted/
      const sourceKey = `hyperscience/${requestId}/ready/${filename}`
      const destinationKey = `hyperscience/${requestId}/redacted/${filename}`
      
      await s3Service.moveS3Object(sourceKey, destinationKey)
      
      // 2. Simulate the listener function that detects redacted documents
      const result = await service.handleHyperscienceRedactionComplete(requestId, filename)
      
      res.json({
        success: true,
        message: 'Document successfully redacted',
        document: mapDocument(result.document)
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during redaction process'
      })
    }
  } catch (error) {
    next(error)
  }
}
