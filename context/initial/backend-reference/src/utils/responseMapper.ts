import { FOIARequest, Document, User, Note } from '../generated/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { FOIARequestPublic, FOIARequestInternal } from '../types/requests'
import { DocumentInternal, DocumentPublic } from '../types/documents'
import { NotePublic, NoteInternal } from '../types/notes'

function iso(d: Date | null | undefined) { return d ? d.toISOString() : null }
function dec(n: any) { return n instanceof Decimal ? parseFloat(n.toString()) : n }

export function mapUser(user: User | null | undefined) {
  if (!user) return null
  return {
    id: user.id,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || ''
  }
}

// Common mapping functions to avoid duplication
function mapRequesterInfo(r: FOIARequest) {
  return {
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    requesterPhone: r.requesterPhone,
    requesterAddress: r.requesterAddress,
    requesterCity: r.requesterCity,
    requesterState: r.requesterState,
    requesterZipCode: r.requesterZipCode,
    requesterCountry: r.requesterCountry,
    requesterOrganization: r.requesterOrganization,
    requesterType: r.requesterType
  }
}

function mapRequestDetails(r: FOIARequest) {
  return {
    requestSubject: r.requestSubject,
    requestDescription: r.requestDescription,
    requestDate: r.requestDate.toISOString().split('T')[0],
    agencyComponentId: r.agencyComponentId,
    agencyComponentName: r.agencyComponentName,
    requestType: r.requestType
  }
}

function mapScopeAndSearch(r: FOIARequest) {
  return {
    dateRangeStart: r.dateRangeStart ? r.dateRangeStart.toISOString().split('T')[0] : null,
    dateRangeEnd: r.dateRangeEnd ? r.dateRangeEnd.toISOString().split('T')[0] : null,
    specificRecords: r.specificRecords,
    searchTerms: r.searchTerms,
    fileTypes: r.fileTypes
  }
}

function mapFeesAndProcessing(r: FOIARequest) {
  return {
    feeCategory: r.feeCategory,
    feeWaiverRequested: r.feeWaiverRequested,
    feeWaiverReason: r.feeWaiverReason,
    expeditedProcessingRequested: r.expeditedProcessingRequested,
    expeditedProcessingReason: r.expeditedProcessingReason,
    estimatedCompletionDate: r.estimatedCompletionDate ? r.estimatedCompletionDate.toISOString().split('T')[0] : null,
    estimatedFees: dec(r.estimatedFees)
  }
}

function mapMetadata(r: FOIARequest) {
  return {
    submissionMethod: r.submissionMethod,
    language: r.language
  }
}

function mapSubjectOfRequest(r: FOIARequest) {
  return {
    subjectName: r.subjectName,
    subjectPhone: r.subjectPhone,
    subjectEmail: r.subjectEmail,
    subjectAddress: r.subjectAddress,
    subjectCity: r.subjectCity,
    subjectState: r.subjectState,
    subjectZipCode: r.subjectZipCode,
    subjectCountry: r.subjectCountry,
    subjectDOB: r.subjectDOB ? r.subjectDOB.toISOString().split('T')[0] : null,
    subjectSSN: r.subjectSSN,
    subjectDODId: r.subjectDODId
  }
}

// Public-facing mapper - returns only permitted fields for requesters
export function mapFOIARequestPublic(r: FOIARequest): FOIARequestPublic {
  return {
    // Identifiers and status (read-only to the requester)
    id: r.id,
    requestNumber: r.requestNumber,
    status: r.status,
    trackingNumber: r.trackingNumber,
    confirmationNumber: r.confirmationNumber,

    // Reuse common mapping functions
    ...mapRequesterInfo(r),
    ...mapRequestDetails(r),
    ...mapScopeAndSearch(r),
    ...mapFeesAndProcessing(r),
    ...mapMetadata(r),
    partiallyComplete: !!(r as any).partiallyComplete,
    exemptionsApplied: (r as any).exemptionsApplied || [],
    exclusionsApplied: (r as any).exclusionsApplied || [],
    ...mapSubjectOfRequest(r)
  }
}

// Internal/Agency mapper - returns full information for agency staff
export function mapFOIARequest(r: FOIARequest & { assignedUser?: User | null }): FOIARequestInternal {
  return {
    // Identifiers and status
    id: r.id,
    requestNumber: r.requestNumber,
    status: r.status,
    trackingNumber: r.trackingNumber,
    confirmationNumber: r.confirmationNumber,

    // Reuse common mapping functions
    ...mapRequesterInfo(r),
    ...mapRequestDetails(r),
    ...mapScopeAndSearch(r),
    ...mapFeesAndProcessing(r),
    ...mapMetadata(r),
    ...mapSubjectOfRequest(r),

    // Agency-specific fields
    dueDate: r.dueDate.toISOString().split('T')[0],
    priority: r.priority,
    acknowledgmentSent: iso(r.acknowledgmentSent),
    actualCompletionDate: r.actualCompletionDate ? r.actualCompletionDate.toISOString().split('T')[0] : null,
    responseLetterSent: iso(r.responseLetterSent),
    appealDeadline: r.appealDeadline ? r.appealDeadline.toISOString().split('T')[0] : null,
    actualFees: dec(r.actualFees),
    feeWaiverGranted: r.feeWaiverGranted,
    paymentReceived: iso(r.paymentReceived),
    responseType: r.responseType,
    exemptionsCited: r.exemptionsCited,
    recordsFound: r.recordsFound,
    recordsReleased: r.recordsReleased,
    recordsWithheld: r.recordsWithheld,
    partiallyComplete: !!(r as any).partiallyComplete,
    exemptionsApplied: (r as any).exemptionsApplied || [],
    exclusionsApplied: (r as any).exclusionsApplied || [],
    assignedTo: r.assignedTo,

    // Timestamps
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    assignedUser: mapUser(r.assignedUser)
  }
}

export function mapDocument(d: Document & { reviewer?: User | null } & { previewDataUrl?: string | null, previewType?: string | null, pageCount?: number | null, additionalInfo?: any }): DocumentInternal {
  return {
    id: d.id,
    foiaRequestId: d.foiaRequestId,
    filename: d.filename,
    originalFilename: d.originalFilename,
    filePath: d.filePath,
    fileSize: d.fileSize.toString(),
    mimeType: d.mimeType,
    status: d.status,
    reviewNotes: d.reviewNotes,
    reviewedBy: d.reviewedBy,
    reviewedAt: iso(d.reviewedAt),
    redactionFlow: d.redactionFlow,
    redactedFilePath: d.redactedFilePath,
    redactedAt: iso(d.redactedAt),
    redactionMetadata: d.redactionMetadata,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
    previewDataUrl: (d as any).previewDataUrl || null,
    previewType: (d as any).previewType || null,
    pageCount: (d as any).pageCount || null,
    additionalInfo: (d as any).additionalInfo || {},
    reviewer: mapUser((d as any).reviewer)
  }
}

// Public-facing document mapper - returns only permitted fields for requesters
export function mapDocumentPublic(d: Document & { previewDataUrl?: string | null, previewType?: string | null, pageCount?: number | null }): DocumentPublic {
  return {
    id: d.id,
    filename: d.filename,
    fileSize: d.fileSize.toString(),
    mimeType: d.mimeType,
    status: d.status,
    previewDataUrl: (d as any).previewDataUrl || null,
    previewType: (d as any).previewType || null,
    pageCount: (d as any).pageCount || null
  }
}

// Public-facing note mapper - returns only permitted fields for requesters
export function mapNotePublic(n: Note & { creator?: User | null }): NotePublic {
  return {
    id: n.id,
    content: n.content,
    noteType: n.noteType,
    priority: n.priority,
    category: n.category,
    isInternal: n.isInternal,
    deletedAt: iso(n.deletedAt),
    createdAt: iso(n.createdAt),
    updatedAt: iso(n.updatedAt)
  }
}

// Internal note mapper - returns full note data for authenticated staff
export function mapNote(n: Note & { creator?: User | null }): NoteInternal {
  return {
    id: n.id,
    foiaRequestId: n.foiaRequestId,
    content: n.content,
    noteType: n.noteType,
    priority: n.priority,
    category: n.category,
    createdBy: n.createdBy,
    isInternal: n.isInternal,
    deletedAt: iso(n.deletedAt),
    createdAt: iso(n.createdAt),
    updatedAt: iso(n.updatedAt),
    creator: mapUser(n.creator)
  }
}
