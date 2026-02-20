import { FeeCategory, RequestPriority, RequestStatus, RequestType, RequesterType, ResponseType, SubmissionMethod } from '../generated/prisma'

import { ISODateString, YMDDateString, FOIAUserSummary } from './common'

// Public-facing request shape: fields the requester provides or is allowed to see
// Aligned with common FOIA form fields (see https://www.foia.gov/request/agency-component/9843e5a0-05b2-42a1-a5a1-61e6262b9f8b/)
export interface FOIARequestPublic {
  // Identifiers and status (read-only to the requester)
  id: string
  requestNumber: string
  status: RequestStatus
  trackingNumber: string | null
  confirmationNumber: string | null

  // Requester information
  requesterName: string
  requesterEmail: string
  requesterPhone: string | null
  requesterAddress: string | null
  requesterCity: string | null
  requesterState: string | null
  requesterZipCode: string | null
  requesterCountry: string
  requesterOrganization: string | null
  requesterType: RequesterType

  // Request details
  requestSubject: string
  requestDescription: string | null
  requestDate: YMDDateString
  agencyComponentId: string | null
  agencyComponentName: string | null
  requestType: RequestType

  // Scope and search
  dateRangeStart: YMDDateString | null
  dateRangeEnd: YMDDateString | null
  specificRecords: string | null
  searchTerms: string | null
  fileTypes: string[]

  // Fees and processing options
  feeCategory: FeeCategory
  feeWaiverRequested: boolean
  feeWaiverReason: string | null
  expeditedProcessingRequested: boolean
  expeditedProcessingReason: string | null
  estimatedCompletionDate: YMDDateString | null
  estimatedFees: number | null

  // Metadata
  submissionMethod: SubmissionMethod
  language: string
  partiallyComplete: boolean
  exemptionsApplied: string[]
  exclusionsApplied: string[]

  // Subject of Request
  subjectName: string | null
  subjectPhone: string | null
  subjectEmail: string | null
  subjectAddress: string | null
  subjectDOB: YMDDateString | null
  subjectSSN: string | null
  subjectDODId: string | null
}

// Internal agency view: full API response shape as returned by mapFOIARequest()
export interface FOIARequestInternal {
  id: string
  requestNumber: string

  // Requester Information
  requesterName: string
  requesterEmail: string
  requesterPhone: string | null
  requesterAddress: string | null
  requesterCity: string | null
  requesterState: string | null
  requesterZipCode: string | null
  requesterCountry: string
  requesterOrganization: string | null
  requesterType: RequesterType

  // Request Details
  requestSubject: string
  requestDescription: string | null
  requestDate: YMDDateString
  dueDate: YMDDateString
  status: RequestStatus
  priority: RequestPriority

  // Agency Information
  agencyComponentId: string | null
  agencyComponentName: string | null

  // Type & Fees
  requestType: RequestType
  feeCategory: FeeCategory
  feeWaiverRequested: boolean
  feeWaiverReason: string | null
  expeditedProcessingRequested: boolean
  expeditedProcessingReason: string | null

  // Scope
  dateRangeStart: YMDDateString | null
  dateRangeEnd: YMDDateString | null
  specificRecords: string | null
  searchTerms: string | null
  fileTypes: string[]

  // Processing Timeline
  acknowledgmentSent: ISODateString | null
  estimatedCompletionDate: YMDDateString | null
  actualCompletionDate: YMDDateString | null
  responseLetterSent: ISODateString | null
  appealDeadline: YMDDateString | null

  // Fees/Response
  estimatedFees: number | null
  actualFees: number | null
  feeWaiverGranted: boolean | null
  paymentReceived: ISODateString | null
  responseType: ResponseType | null
  exemptionsCited: string[]
  recordsFound: number | null
  recordsReleased: number | null
  recordsWithheld: number | null
  partiallyComplete: boolean
  exemptionsApplied: string[]
  exclusionsApplied: string[]

  // Additional Fields
  trackingNumber: string | null
  confirmationNumber: string | null
  submissionMethod: SubmissionMethod
  language: string

  // Assignment & Notes
  assignedTo: string | null
  assignedUser: FOIAUserSummary | null

  // Audit
  createdAt: ISODateString | null
  updatedAt: ISODateString | null

  // Subject of Request
  subjectName: string | null
  subjectPhone: string | null
  subjectEmail: string | null
  subjectAddress: string | null
  subjectDOB: YMDDateString | null
  subjectSSN: string | null
  subjectDODId: string | null
}




