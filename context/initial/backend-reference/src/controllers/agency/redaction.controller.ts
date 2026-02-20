import { Request, Response, NextFunction } from 'express'
import { redactionInitiateSchema } from '../../utils/validation'
import * as redactionService from '../../services/redaction.service'
import { mapDocument } from '../../utils/responseMapper'
import { getPrisma } from '../../config/database'

export async function initiateRedaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { flow } = redactionInitiateSchema.parse(req.body)
    const documentId = req.params.id

    const updatedDocument = await redactionService.initiateRedaction(documentId, flow)
    
    res.json({ document: mapDocument(updatedDocument) })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Document not found') {
        return res.status(404).json({ error: 'Document not found' })
      }
      if (error.message === 'Redaction already in progress for this document') {
        return res.status(409).json({ error: 'Redaction already in progress for this document' })
      }
    }
    next(error)
  }
}

export async function getRedactionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const documentId = req.params.documentId
    const prisma = getPrisma()

    // Get document with redaction information
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        foiaRequest: {
          select: {
            id: true,
            requestNumber: true,
            status: true
          }
        }
      }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Determine redaction status
    let redactionStatus = 'not_started'
    let redactionProgress = 0

    if (document.redactionFlow && !document.redactedFilePath) {
      redactionStatus = 'in_progress'
      redactionProgress = 50
    } else if (document.redactedFilePath) {
      redactionStatus = 'completed'
      redactionProgress = 100
    }

    // Prepare response
    const response = {
      documentId: document.id,
      filename: document.filename,
      originalFilename: document.originalFilename,
      status: document.status,
      redactionStatus,
      redactionProgress,
      redactionFlow: document.redactionFlow,
      redactedFilePath: document.redactedFilePath,
      redactedAt: document.redactedAt,
      redactionMetadata: document.redactionMetadata,
      foiaRequest: {
        id: document.foiaRequest.id,
        requestNumber: document.foiaRequest.requestNumber,
        status: document.foiaRequest.status
      },
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    }

    res.json(response)
  } catch (error) {
    next(error)
  }
}
