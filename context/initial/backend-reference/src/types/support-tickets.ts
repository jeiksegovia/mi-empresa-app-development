import { 
  SupportTicketStatus, 
  SupportTicketPriority, 
  SupportTicketCategory,
  MessageSenderType 
} from '../generated/prisma'
import { FOIAUserSummary, ISODateString } from './common'

// Public-facing support ticket shape: safe fields for requesters/externals
export interface SupportTicketPublic {
  id: string
  ticketNumber: string
  title: string
  description: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: SupportTicketCategory
  foiaRequestId: string
  requesterName: string
  requesterEmail: string
  requesterPhone: string | null
  resolvedAt: ISODateString | null
  createdAt: ISODateString
  updatedAt: ISODateString
  messages: SupportTicketMessagePublic[]
}

// Internal support ticket shape: full ticket data for authenticated staff
export interface SupportTicketInternal {
  id: string
  ticketNumber: string
  title: string
  description: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: SupportTicketCategory
  foiaRequestId: string
  assignedTo: string | null
  createdBy: string
  resolvedAt: ISODateString | null
  createdAt: ISODateString
  updatedAt: ISODateString
  assignedUser: FOIAUserSummary | null
  creator: FOIAUserSummary
  messages: SupportTicketMessageInternal[]
}

// Public-facing support ticket message shape
export interface SupportTicketMessagePublic {
  id: string
  message: string
  senderType: MessageSenderType
  senderName: string
  senderEmail: string | null
  isInternal: boolean
  createdAt: ISODateString
  updatedAt: ISODateString
}

// Internal support ticket message shape
export interface SupportTicketMessageInternal {
  id: string
  supportTicketId: string
  message: string
  senderType: MessageSenderType
  senderId: string | null
  senderName: string
  senderEmail: string | null
  isInternal: boolean
  createdAt: ISODateString
  updatedAt: ISODateString
  sender: FOIAUserSummary | null
}

// Create support ticket request (public API)
export interface CreateSupportTicketRequest {
  title: string
  description: string
  category: SupportTicketCategory
  foiaRequestId: string
}

// Update support ticket request (agency API)
export interface UpdateSupportTicketRequest {
  title?: string
  description?: string
  status?: SupportTicketStatus
  priority?: SupportTicketPriority
  category?: SupportTicketCategory
  assignedTo?: string | null
}

// Add message to support ticket request
export interface AddSupportTicketMessageRequest {
  message: string
  isInternal?: boolean
}

// Support ticket summary for lists
export interface SupportTicketSummary {
  id: string
  ticketNumber: string
  title: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: SupportTicketCategory
  foiaRequestId: string
  requesterName: string
  requesterEmail: string
  assignedTo: string | null
  assignedUserName: string | null
  createdAt: ISODateString
  updatedAt: ISODateString
  resolvedAt: ISODateString | null
}

// Support ticket statistics
export interface SupportTicketStats {
  total: number
  open: number
  inProgress: number
  waitingForResponse: number
  resolved: number
  closed: number
  urgent: number
  high: number
  normal: number
  low: number
}
