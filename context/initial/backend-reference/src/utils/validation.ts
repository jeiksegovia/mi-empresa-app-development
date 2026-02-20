import { z } from 'zod'
import { FeeCategory, RequestPriority, RequestStatus, RequestType, RequesterType, ResponseType, SubmissionMethod, NoteType, NotePriority, NoteCategory, InvoiceStatus } from '../generated/prisma'

// Public login schema for ID.me OAuth
export const loginSchema = z.object({
  idme_id: z.string().min(1, 'ID.me ID is required'),
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required')
})

// Agency login schema for username/password
export const agencyLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
})

const dateStr = () => z.string().transform((v, ctx) => {
  const d = new Date(v)
  if (isNaN(d.getTime())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date' })
  return v
})

// Public schema for request creation - only allows fields that public users can set
export const foiaRequestPublicCreateSchema = z.object({
  requesterName: z.string().min(1, 'Requester name is required'),
  requesterEmail: z.string().email('Valid email is required'),
  requesterPhone: z.string().optional().nullable(),
  requesterAddress: z.string().optional().nullable(),
  requesterCity: z.string().optional().nullable(),
  requesterState: z.string().optional().nullable(),
  requesterZipCode: z.string().optional().nullable(),
  requesterCountry: z.string().default('United States'),
  requesterOrganization: z.string().optional().nullable(),
  requesterType: z.nativeEnum(RequesterType),
  requestSubject: z.string().min(1, 'Request subject is required'),
  requestDescription: z.string().optional().nullable(),
  agencyComponentId: z.string().uuid().optional().nullable(),
  requestType: z.nativeEnum(RequestType).optional().default('INITIAL'),
  feeCategory: z.nativeEnum(FeeCategory).optional().default('OTHER'),
  feeWaiverRequested: z.boolean().optional().default(false),
  feeWaiverReason: z.string().optional().nullable(),
  expeditedProcessingRequested: z.boolean().optional().default(false),
  expeditedProcessingReason: z.string().optional().nullable(),
  dateRangeStart: dateStr().optional().nullable(),
  dateRangeEnd: dateStr().optional().nullable(),
  specificRecords: z.string().optional().nullable(),
  searchTerms: z.string().optional().nullable(),
  fileTypes: z.array(z.string()).optional().default([]),
  submissionMethod: z.nativeEnum(SubmissionMethod).optional().default('ONLINE'),
  language: z.string().optional().default('en'),
  confirmationNumber: z.string().optional().nullable(),
  subjectName: z.string().optional().nullable(),
  subjectPhone: z.string().optional().nullable(),
  subjectEmail: z.string().email('Valid subject email is required').optional().nullable(),
  subjectAddress: z.string().optional().nullable(),
  subjectCity: z.string().optional().nullable(),
  subjectState: z.string().optional().nullable(),
  subjectZipCode: z.string().optional().nullable(),
  subjectCountry: z.string().optional().nullable(),
  subjectDOB: z.string().optional().nullable().transform((v, ctx) => {
    if (!v) return v
    const d = new Date(v)
    if (isNaN(d.getTime())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date' })
    return v
  }),
  subjectSSN: z.string().optional().nullable(),
  subjectDODId: z.string().optional().nullable()
}).strict()

// Public schema for request updates - very limited fields that public users can modify
export const foiaRequestPublicUpdateSchema = z.object({
  requesterPhone: z.string().optional().nullable(),
  requesterAddress: z.string().optional().nullable(),
  requesterCity: z.string().optional().nullable(),
  requesterState: z.string().optional().nullable(),
  requesterZipCode: z.string().optional().nullable(),
  requesterOrganization: z.string().optional().nullable(),
  requestDescription: z.string().optional().nullable(),
  feeWaiverReason: z.string().optional().nullable(),
  expeditedProcessingReason: z.string().optional().nullable(),
  dateRangeStart: dateStr().optional().nullable(),
  dateRangeEnd: dateStr().optional().nullable(),
  specificRecords: z.string().optional().nullable(),
  searchTerms: z.string().optional().nullable(),
  fileTypes: z.array(z.string()).optional(),
  subjectName: z.string().optional().nullable(),
  subjectPhone: z.string().optional().nullable(),
  subjectEmail: z.string().email('Valid subject email is required').optional().nullable(),
  subjectAddress: z.string().optional().nullable(),
  subjectCity: z.string().optional().nullable(),
  subjectState: z.string().optional().nullable(),
  subjectZipCode: z.string().optional().nullable(),
  subjectCountry: z.string().optional().nullable(),
  subjectDOB: dateStr().optional().nullable(),
  subjectSSN: z.string().optional().nullable(),
  subjectDODId: z.string().optional().nullable()
}).strict().refine((data) => {
  // Additional validation to ensure no internal fields are present
  const internalFields = [
    'assignedTo', 'priority', 'acknowledgmentSent', 'actualCompletionDate',
    'actualFees', 'responseType', 'exemptionsCited', 'recordsFound',
    'recordsReleased', 'recordsWithheld', 'status', 'dueDate',
    'requestNumber', 'trackingNumber', 'confirmationNumber'
  ]
  
  const hasInternalFields = internalFields.some(field => field in data)
  if (hasInternalFields) {
    throw new Error('Internal-only fields are not allowed in public updates')
  }
  return true
}, {
  message: 'Internal-only fields are not allowed in public updates'
})

// Agency schema for request creation - full access
export const foiaRequestCreateSchema = z.object({
  requestNumber: z.string(),
  requesterName: z.string(),
  requesterEmail: z.string().email(),
  requesterPhone: z.string().optional().nullable(),
  requesterAddress: z.string().optional().nullable(),
  requesterCity: z.string().optional().nullable(),
  requesterState: z.string().length(2).optional().nullable(),
  requesterZipCode: z.string().optional().nullable(),
  requesterCountry: z.string().default('United States'),
  requesterOrganization: z.string().optional().nullable(),
  requesterType: z.nativeEnum(RequesterType),
  requestSubject: z.string(),
  requestDescription: z.string().optional().nullable(),
  requestDate: dateStr(),
  dueDate: dateStr(),
  status: z.nativeEnum(RequestStatus).optional(),
  priority: z.nativeEnum(RequestPriority).optional(),
  agencyComponentId: z.string().uuid().optional().nullable(),
  agencyComponentName: z.string().optional().nullable(),
  requestType: z.nativeEnum(RequestType).optional(),
  feeCategory: z.nativeEnum(FeeCategory).optional(),
  feeWaiverRequested: z.boolean().optional(),
  feeWaiverReason: z.string().optional().nullable(),
  expeditedProcessingRequested: z.boolean().optional(),
  expeditedProcessingReason: z.string().optional().nullable(),
  dateRangeStart: dateStr().optional().nullable(),
  dateRangeEnd: dateStr().optional().nullable(),
  specificRecords: z.string().optional().nullable(),
  searchTerms: z.string().optional().nullable(),
  fileTypes: z.array(z.string()),
  acknowledgmentSent: dateStr().optional().nullable(),
  estimatedCompletionDate: dateStr().optional().nullable(),
  actualCompletionDate: dateStr().optional().nullable(),
  responseLetterSent: dateStr().optional().nullable(),
  appealDeadline: dateStr().optional().nullable(),
  estimatedFees: z.number().optional().nullable(),
  actualFees: z.number().optional().nullable(),
  feeWaiverGranted: z.boolean().optional().nullable(),
  paymentReceived: dateStr().optional().nullable(),
  responseType: z.nativeEnum(ResponseType).optional().nullable(),
  exemptionsCited: z.array(z.string()).optional().default([]),
  recordsFound: z.number().optional().nullable(),
  recordsReleased: z.number().optional().nullable(),
  recordsWithheld: z.number().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  confirmationNumber: z.string().optional().nullable(),
  submissionMethod: z.nativeEnum(SubmissionMethod).optional(),
  language: z.string().optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  subjectName: z.string().optional().nullable(),
  subjectPhone: z.string().optional().nullable(),
  subjectEmail: z.string().email().optional().nullable(),
  subjectAddress: z.string().optional().nullable(),
  subjectDOB: dateStr().optional().nullable(),
  subjectSSN: z.string().optional().nullable(),
  subjectDODId: z.string().optional().nullable()
})

export const foiaRequestUpdateSchema = foiaRequestCreateSchema.partial()

// Document schemas
export const documentUploadSchema = z.object({
  foiaRequestId: z.string().uuid('Valid FOIA request ID is required')
})

export const documentUpdateSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'APPROVED', 'REJECTED']).optional(),
  reviewNotes: z.string().optional().nullable()
})

// User schemas
export const userCreateSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required'),
  isInternal: z.boolean().default(false)
})

export const userUpdateSchema = userCreateSchema.partial()

// Role assignment schema
export const roleAssignmentSchema = z.object({
  userId: z.string().uuid('Valid user ID is required'),
  roleId: z.string().uuid('Valid role ID is required')
})

// Note schemas
export const noteCreateSchema = z.object({
  foiaRequestId: z.string().uuid('Valid FOIA request ID is required'),
  content: z.string().min(1, 'Note content is required'),
  noteType: z.nativeEnum(NoteType),
  priority: z.nativeEnum(NotePriority).default('MEDIUM'),
  category: z.nativeEnum(NoteCategory).default('GENERAL'),
  isInternal: z.boolean().default(false)
})

export const noteUpdateSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
  noteType: z.nativeEnum(NoteType).optional(),
  priority: z.nativeEnum(NotePriority).optional(),
  category: z.nativeEnum(NoteCategory).optional(),
  isInternal: z.boolean().optional()
})

// Redaction schemas
export const redactionInitiateSchema = z.object({
  flow: z.string().optional()
})

// Hyperscience notifier payload schema (Type 3: Redacted notification)
export const hsNotifierPayloadSchema = z.object({
  redacted_pdf_link: z.string(),
  unredacted_pdf_link: z.string(),
  redaction_bit: z.number(),
  file_name: z.string(),
  external_case_id: z.string(),
  external_id: z.string(),
  submission_id: z.number()
})

// Base notification schema for workflow status updates (Types 1 & 2)
const baseWorkflowNotificationSchema = z.object({
  id: z.number(),
  external_id: z.string(),
  state: z.string(),
  halted: z.boolean().optional(),
  exceptions: z.array(z.any()).optional(),
  start_time: z.string(),
  complete_time: z.string().nullable().optional(),
  metadata: z.object({
    agency: z.string().optional(),
    request_type: z.string().optional(),
    priority: z.string().optional(),
    RequestID: z.string().optional(),
    LastName: z.string().optional(),
    FirstName: z.string().optional(),
    MiddleInitial: z.string().optional(),
    SSN: z.string().optional(),
    DODID: z.string().optional(),
    DOB: z.string().optional(),
    RequestType: z.string().optional()
  }).passthrough(),
  supervision_url: z.string().optional()
})

// Type 1: Processing start notification (no substate)
export const hsProcessingNotificationSchema = baseWorkflowNotificationSchema

// Type 2: Supervision notification (has substate and output)
export const hsSupervisionNotificationSchema = baseWorkflowNotificationSchema.extend({
  substate: z.string(),
  output: z.object({
    id: z.number(),
    external_id: z.string(),
    state: z.string(),
    substate: z.string().optional(),
    goal_time: z.string().optional(),
    goal_time_source: z.string().optional(),
    sla_rule_name: z.string().optional(),
    supervision_url: z.string().optional(),
    documents: z.array(z.any()).optional(),
    cases: z.array(z.object({
      external_case_id: z.string(),
      documents: z.array(z.number()).optional(),
      submission_files: z.array(z.string()).optional()
    })).optional()
  }).passthrough().optional()
})

// Invoice schemas
export const invoiceCreateSchema = z.object({
  foiaRequestId: z.string().uuid('Valid FOIA request ID is required'),
  totalAmount: z.number().positive('Total amount must be positive'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  dateDue: dateStr(),
  paymentPageUrl: z.string().url().optional(),
  payGovReference: z.string().optional()
})

export const invoiceUpdateSchema = z.object({
  totalAmount: z.number().positive('Total amount must be positive').optional(),
  paidAmount: z.number().min(0, 'Paid amount cannot be negative').optional(),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long').optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  dateDue: dateStr().optional(),
  paymentPageUrl: z.string().url().optional(),
  receiptUrl: z.string().url().optional(),
  payGovReference: z.string().optional()
})

export const invoiceFilterSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  foiaRequestId: z.string().uuid().optional(),
  dateFrom: dateStr().optional(),
  dateTo: dateStr().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional()
})

// Request workflow action schemas
export const requestWorkflowActionSchema = z.discriminatedUnion('action', [
  // Reopen action: requires note, category and priority are optional
  z.object({
    action: z.literal('reopen'),
    note: z.string().min(1, 'Note is required when reopening a request'),
    category: z.nativeEnum(NoteCategory).optional(), // Made optional
    priority: z.nativeEnum(NotePriority).optional(), // Made optional
    removeExemptions: z.boolean().optional().default(false), // Whether to remove exemptions when reopening
    removeExclusions: z.boolean().optional().default(false), // Whether to remove exclusions when reopening
    isInternal: z.boolean().optional().default(true)
  }),

  // Complete action: requires note
  z.object({
    action: z.literal('complete'),
    note: z.string().min(1, 'Note is required when completing a request'),
    partiallyComplete: z.boolean().optional().default(false),
    exemptionsApplied: z.array(z.string()).optional(),
    exclusionsApplied: z.array(z.string()).optional(),
    isInternal: z.boolean().optional().default(true)
  }),

  // Close action: requires status (CANCELLED or DENIED) and note
  z.object({
    action: z.literal('close'),
    status: z.enum(['CANCELLED', 'DENIED']),
    note: z.string().min(1, 'Note is required when closing a request'),
    exemptionsApplied: z.array(z.string()).optional().default([]),
    exclusionsApplied: z.array(z.string()).optional().default([]),
    isInternal: z.boolean().optional().default(true)
  })
])
