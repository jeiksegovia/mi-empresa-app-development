import { DocumentStatus } from '../generated/prisma'
import { FOIAUserSummary, ISODateString } from './common'

// Public-facing document shape: safe fields for requesters/externals
export interface DocumentPublic {
  id: string
  filename: string
  fileSize: string
  mimeType: string
  status: DocumentStatus
  previewDataUrl: string | null
  previewType: string | null
  pageCount: number | null
}

// Internal document shape: aligns with mapDocument() output used by API
export interface DocumentInternal {
  id: string
  foiaRequestId: string
  filename: string
  originalFilename: string
  filePath: string
  fileSize: string
  mimeType: string
  status: DocumentStatus
  reviewNotes: string | null
  reviewedBy: string | null
  reviewedAt: ISODateString | null
  redactionFlow: string | null
  redactedFilePath: string | null
  redactedAt: ISODateString | null
  redactionMetadata: any | null
  createdAt: ISODateString | null
  updatedAt: ISODateString | null
  previewDataUrl: string | null
  previewType: string | null
  pageCount: number | null
  additionalInfo: any
  reviewer: FOIAUserSummary | null
}

// Request body for creating document entry after S3 upload
export interface CompleteUploadEntryRequest {
  documentName: string
  s3Key: string
  fileSize: number
  mimeType?: string
}

// Request body for initiating multipart upload
export interface InitiateMultipartUploadRequest {
  documentName: string
  useMultipart?: boolean
}

// Request body for generating multipart upload part URL
export interface GenerateMultipartPartRequest {
  s3Key: string
  uploadId: string
  partNumber: number
}

// Request body for completing multipart upload
export interface CompleteMultipartUploadRequest {
  s3Key: string
  uploadId: string
  parts: { ETag: string; PartNumber: number }[]
  documentName: string
  fileSize: number
  mimeType?: string
}


