import { InvoiceStatus } from '../generated/prisma'

export interface InvoiceResponse {
  id: string
  foiaRequestId: string
  invoiceNumber: string
  totalAmount: number
  paidAmount: number
  balance: number
  description: string
  status: InvoiceStatus
  dateCreated: string
  dateDue: string
  paymentPageUrl?: string
  receiptUrl?: string
  payGovReference?: string
  createdAt: string
  updatedAt: string
}

export interface InvoiceListResponse {
  invoices: InvoiceResponse[]
  total: number
}

export interface InvoiceFilterParams {
  status?: InvoiceStatus
  foiaRequestId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface CreateInvoiceRequest {
  foiaRequestId: string
  totalAmount: number
  description: string
  dateDue: string
  paymentPageUrl?: string
  payGovReference?: string
}

export interface UpdateInvoiceRequest {
  totalAmount?: number
  paidAmount?: number
  description?: string
  status?: InvoiceStatus
  dateDue?: string
  paymentPageUrl?: string
  receiptUrl?: string
  payGovReference?: string
}
