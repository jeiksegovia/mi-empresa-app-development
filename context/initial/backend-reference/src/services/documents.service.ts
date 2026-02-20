import { DocumentStatus } from '../generated/prisma'
import { generatePreview, safeUnlink } from '../utils/file'
import { MulterFile } from '../types/common'
import { Document } from '../generated/prisma'
import * as s3Service from './s3.service'
import { th } from '@faker-js/faker/.'
import { getPrisma } from '../config/database'
import { initiateRedaction } from './redaction.service'

const prisma = getPrisma()

export async function listDocuments(foiaRequestId: string) {
  const docs = await prisma.document.findMany({ where: { foiaRequestId }, include: { reviewer: true } })
  // Attach previews lazily
  return Promise.all(docs.map(async (d: Document & { reviewer?: any }) => {
    const preview = await generatePreview(d.filePath, d.mimeType)
    return { ...d, ...preview }
  }))
}

export async function listDocumentsPublic(foiaRequestId: string) {
  const docs = await prisma.document.findMany({ 
    where: { 
      foiaRequestId,
      status: 'RELEASED' // Only return documents with RELEASED status for public access
    }, 
    include: { reviewer: true } 
  })
  // Attach previews lazily
  return Promise.all(docs.map(async (d: Document & { reviewer?: any }) => {
    const preview = await generatePreview(d.filePath, d.mimeType)
    return { ...d, ...preview }
  }))
}

export async function createDocuments(foiaRequestId: string, files: MulterFile[]) {
  const created = await Promise.all(files.map(f => prisma.document.create({ data: {
    foiaRequestId,
    filename: f.filename,
    originalFilename: f.originalname,
    filePath: f.path,
    fileSize: BigInt(f.size),
    mimeType: f.mimetype
  } })))
  return created
}

export async function deleteDocument(id: string) {
  try{
    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) throw new Error('Document not found')
    await prisma.document.delete({ where: { id } })
    await s3Service.deleteS3Object(doc.filePath)
  } catch (error) {
    console.error('Error deleting document:', error)
    return false
  }
  return true
}

export async function updateDocumentStatus(id: string, status?: DocumentStatus, reviewNotes?: string) {
  try {
    const updateData: { status?: DocumentStatus; reviewNotes?: string } = {}
    if (status) updateData.status = status
    if (reviewNotes) updateData.reviewNotes = reviewNotes
    
    return await prisma.document.update({ 
      where: { id }, 
      data: updateData, 
      include: { reviewer: true } 
    })
  } catch (e: any) {
    if (e.code === 'P2025') return null
    throw e
  }
}

export async function getDocumentById(id: string) {
  try {
    const document = await prisma.document.findUnique({
      where: { id },
      include: { reviewer: true }
    })
    
    if (!document) {
      return null
    }
    
    return document
  } catch (error) {
    console.error('Error retrieving document by ID:', error)
    throw error
  }
}

export async function validateUserCanProcessRequest(requestId: string, userId?: string, userPermissions?: string[]): Promise<boolean> {
  try {
    const request = await prisma.fOIARequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        assignedTo: true,
        status: true
      }
    })

    if (!request) {
      return false
    }

    // If user is assigned to the request, they can process it
    if (request.assignedTo === userId) {
      return true
    }

    // If user has document permissions, they can process the request
    if (userPermissions && (
      userPermissions.includes('review_documents') ||
      userPermissions.includes('upload_documents') ||
      userPermissions.includes('release_documents') ||
      userPermissions.includes('redact_documents')
    )) {
      return true
    }

    return false
  } catch (error) {
    console.error('Error validating user can process request:', error)
    return false
  }
}

export async function completeUploadFromS3Upload(
  foiaRequestId: string, 
  documentName: string, 
  s3Key: string, 
  fileSize: number,
  mimeType: string,
  userId?: string,
  userPermissions?: string[]
) {
  try {
    // Validate that the request exists and user can process it
    const canProcess = await validateUserCanProcessRequest(
      foiaRequestId, 
      userId,
      userPermissions
    )
    if (!canProcess) {
      throw new Error('You do not have permission to upload documents for this request')
    }

    const document = await prisma.document.create({
      data: {
        foiaRequestId,
        filename: s3Key.split('/').pop() || documentName,
        originalFilename: documentName,
        filePath: s3Key, 
        fileSize: BigInt(fileSize),
        mimeType: mimeType || 'application/octet-stream',
        status: 'PENDING' 
      }
    })

    await prisma.fOIARequest.update({
      where: { id: foiaRequestId },
      data: { status: 'IN_PROGRESS' }
    })

    return document
  } catch (error) {
    console.error('Error creating document from S3 upload:', error)
    throw error
  }
}

export async function validateUserCanProcessDocument(documentId: string, userId?: string, userPermissions?: string[]): Promise<boolean> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        foiaRequestId: true,
        foiaRequest: {
          select: {
            assignedTo: true
          }
        }
      }
    })

    if (!document) {
      return false
    }

    // If user is assigned to the request, they can process the document
    if (document.foiaRequest.assignedTo === userId) {
      return true
    }

    // If user has review_documents permission, they can process any document
    if (userPermissions && userPermissions.includes('review_documents')) {
      return true
    }

    return false
  } catch (error) {
    console.error('Error validating user can process document:', error)
    return false
  }
}

export async function validateUserCanAccessDocument(documentId: string, userId?: string, userPermissions?: string[]): Promise<boolean> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        foiaRequestId: true,
        foiaRequest: {
          select: {
            assignedTo: true,
            requesterEmail: true
          }
        }
      }
    })

    if (!document) {
      return false
    }

    // If user is assigned to the request, they can access the document
    if (document.foiaRequest.assignedTo === userId) {
      return true
    }

    // If user has document permissions, they can access the document
    if (userPermissions && (
      userPermissions.includes('review_documents') ||
      userPermissions.includes('upload_documents') ||
      userPermissions.includes('release_documents') ||
      userPermissions.includes('redact_documents')
    )) {
      return true
    }

    // For public access, check if the user is the requester of the FOIA request
    // This would require the user to be authenticated and match the requester email
    if (userId && document.foiaRequest.requesterEmail) {
      // Note: This assumes the user's email is available in the user object
      // You may need to adjust this based on your user data structure
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })
      
      if (user && user.email === document.foiaRequest.requesterEmail) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Error validating user can access document:', error)
    return false
  }
}

export async function handleDocumentWorkflow(documentId: string, action: string, userId?: string) {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { foiaRequest: true }
    })

    if (!document) {
      return null
    }

    let newStatus: DocumentStatus
    let message: string
    let s3Action: string | null = null

    switch (action) {
      case 'ready_for_redaction':
        // Validate that document is in PENDING status (maps to "new" in the flow)
        if (document.status !== 'PENDING') {
          throw new Error(`Document must be in PENDING status to mark as ready for redaction. Current status: ${document.status}`)
        }
        newStatus = 'NEEDS_REDACTION'
        message = 'Document marked as ready for redaction'
        s3Action = 'move_to_hyperscience_ready'
        break

      
      case 'mark_reviewed':
        if (document.status !== 'REDACTED') {
          throw new Error(`Document must be in REDACTED status to mark as reviewed. Current status: ${document.status}`)
        }
        newStatus = 'REVIEWED'
        message = 'Document marked as reviewed'
        s3Action = null // No S3 movement needed for review
        break

      case 'unmark_reviewed':
        if (document.status !== 'REVIEWED') {
          throw new Error(`Document must be in REVIEWED status to unmark as reviewed. Current status: ${document.status}`)
        }
        newStatus = 'REDACTED'
        message = 'Document unmarked as reviewed'
        s3Action = null // No S3 movement needed for unmarking review
        break
      
      case 'release_document':
        // Validate that document is in REVIEWED status
        if (document.status !== 'REVIEWED') {
          throw new Error(`Document must be in REVIEWED status to release. Current status: ${document.status}`)
        }
        newStatus = 'RELEASED'
        message = 'Document released'
        s3Action = null // Document already in final location
        break
      
      default:
        throw new Error(`Invalid action: ${action}`)
    }

    // Handle S3 operations if needed and get new file path
    let newFilePath: string | undefined
    if (s3Action) {
      newFilePath = await s3Service.handleDocumentWorkflowS3Action(document, s3Action)
    }

    // Update document status and file path if changed
    const updateData: any = {
      status: newStatus
    }

    // Only set reviewer information for mark_reviewed action
    if (action === 'mark_reviewed') {
      updateData.reviewedBy = userId
      updateData.reviewedAt = new Date()
    }

    if (action === 'unmark_reviewed') {
      updateData.reviewedBy = null
      updateData.reviewedAt = null
    }

    // Update file path if S3 operation was performed
    if (newFilePath) {
      updateData.filePath = newFilePath
    }

    let updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: updateData,
      include: { reviewer: true }
    })

    // HS workflow actions
    switch (action) {
      case 'ready_for_redaction':
        if(updatedDocument.status === 'NEEDS_REDACTION'){
          updatedDocument = await initiateRedaction(documentId)
        }
        break
    }

    return {
      document: updatedDocument,
      message
    }
  } catch (error) {
    console.error('Error handling document workflow:', error)
    throw error
  }
}

async function checkAndCompleteRequest(requestId: string) {
  try {
    // Get all documents for this request
    const documents = await prisma.document.findMany({
      where: { foiaRequestId: requestId }
    })

    if (documents.length === 0) {
      return // No documents to check
    }

    // Check if all documents are released
    const allReleased = documents.every(doc => doc.status === 'RELEASED')
    
    if (allReleased) {
      // Get the request to check current status
      const request = await prisma.fOIARequest.findUnique({
        where: { id: requestId }
      })

      if (request && request.status !== 'COMPLETED') {
        // Update request status to completed and set completion date
        await prisma.fOIARequest.update({
          where: { id: requestId },
          data: {
            status: 'COMPLETED',
            actualCompletionDate: new Date()
          }
        })

        console.log(`Request ${requestId} automatically marked as completed - all documents released`)
      }
    }
  } catch (error) {
    console.error('Error checking and completing request:', error)
    // Don't throw error to avoid breaking the document release process
  }
}

export async function handleHyperscienceRedactionComplete(requestId: string, filename: string) {
  try {
    // Find the document by request ID and filename
    const document = await prisma.document.findFirst({
      where: {
        foiaRequestId: requestId,
        filename: filename,
        status: 'NEEDS_REDACTION'
      }
    })

    if (!document) {
      throw new Error(`Document not found or not in NEEDS_REDACTION status: ${filename}`)
    }

    // Move document from hyperscience/{requestId}/redacted/ to {requestId}/redacted/
    const hyperscienceRedactedKey = `hyperscience/${requestId}/redacted/${filename}`
    const finalRedactedKey = `${requestId}/redacted/${filename}`
    
    await s3Service.moveS3Object(hyperscienceRedactedKey, finalRedactedKey)

    // Update document status to REDACTED and file path
    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: {
        status: 'REDACTED',
        filePath: finalRedactedKey,
        updatedAt: new Date()
      }
    })

    console.log(`Document ${filename} redaction completed and moved to final location`)

    return {
      document: updatedDocument,
      message: 'Document redaction completed successfully'
    }
  } catch (error) {
    console.error('Error handling Hyperscience redaction completion:', error)
    throw error
  }
}