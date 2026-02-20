import { getPrisma } from '../config/database'
import { 
  CreateInvoiceRequest, 
  UpdateInvoiceRequest, 
  InvoiceFilterParams, 
  InvoiceResponse, 
  InvoiceListResponse
} from '../types/invoices'
import { logger } from '../config/logger'
import { InvoiceStatus } from '../generated/prisma'

const prisma = getPrisma()

export class InvoicesService {
  async createInvoice(data: CreateInvoiceRequest): Promise<InvoiceResponse> {
    try {
      // Generate unique invoice number
      const invoiceNumber = await this.generateInvoiceNumber()
      
      const invoice = await prisma.invoice.create({
        data: {
          foiaRequestId: data.foiaRequestId,
          invoiceNumber,
          totalAmount: data.totalAmount,
          paidAmount: 0,
          balance: data.totalAmount,
          description: data.description,
          dateCreated: new Date(),
          dateDue: new Date(data.dateDue),
          paymentPageUrl: data.paymentPageUrl || this.generateMockPaymentUrl(invoiceNumber),
          payGovReference: data.payGovReference || this.generateMockPayGovReference(invoiceNumber)
        }
      })

      return this.mapInvoiceToResponse(invoice)
    } catch (error) {
      logger.error('Error creating invoice:', error)
      throw error
    }
  }

  async getInvoices(filters: InvoiceFilterParams): Promise<InvoiceListResponse> {
    try {
      const where: any = {}
      
      if (filters.status) {
        where.status = filters.status
      }
      
      if (filters.foiaRequestId) {
        where.foiaRequestId = filters.foiaRequestId
      }
      
      if (filters.dateFrom || filters.dateTo) {
        where.dateCreated = {}
        if (filters.dateFrom) {
          where.dateCreated.gte = new Date(filters.dateFrom)
        }
        if (filters.dateTo) {
          where.dateCreated.lte = new Date(filters.dateTo)
        }
      }

      const page = filters.page || 1
      const limit = filters.limit || 10
      const skip = (page - 1) * limit

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.invoice.count({ where })
      ])

      return {
        invoices: invoices.map(invoice => this.mapInvoiceToResponse(invoice)),
        total
      }
    } catch (error) {
      logger.error('Error getting invoices:', error)
      throw error
    }
  }

  async getInvoiceById(id: string): Promise<InvoiceResponse | null> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id }
      })

      if (!invoice) {
        return null
      }

      return this.mapInvoiceToResponse(invoice)
    } catch (error) {
      logger.error('Error getting invoice by ID:', error)
      throw error
    }
  }

  async getInvoicesByRequestId(foiaRequestId: string): Promise<InvoiceResponse[]> {
    try {
      const invoices = await prisma.invoice.findMany({
        where: { foiaRequestId },
        orderBy: { createdAt: 'desc' }
      })

      return invoices.map(invoice => this.mapInvoiceToResponse(invoice))
    } catch (error) {
      logger.error('Error getting invoices by request ID:', error)
      throw error
    }
  }

  async getInvoicesByUserEmail(userEmail: string): Promise<InvoiceResponse[]> {
    try {
      const invoices = await prisma.invoice.findMany({
        where: {
          foiaRequest: {
            requesterEmail: userEmail
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return invoices.map(invoice => this.mapInvoiceToResponse(invoice))
    } catch (error) {
      logger.error('Error getting invoices by user email:', error)
      throw error
    }
  }

  async getInvoicesByUserEmailAndRequestId(userEmail: string, requestId: string): Promise<InvoiceResponse[]> {
    try {
      const invoices = await prisma.invoice.findMany({
        where: {
          foiaRequestId: requestId,
          foiaRequest: {
            requesterEmail: userEmail
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return invoices.map(invoice => this.mapInvoiceToResponse(invoice))
    } catch (error) {
      logger.error('Error getting invoices by user email and request ID:', error)
      throw error
    }
  }

  async getInvoiceByIdForUser(invoiceId: string, userEmail: string): Promise<InvoiceResponse | null> {
    try {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          foiaRequest: {
            requesterEmail: userEmail
          }
        }
      })

      if (!invoice) {
        return null
      }

      return this.mapInvoiceToResponse(invoice)
    } catch (error) {
      logger.error('Error getting invoice by ID for user:', error)
      throw error
    }
  }

  async updateInvoice(id: string, data: UpdateInvoiceRequest): Promise<InvoiceResponse | null> {
    try {
      const updateData: any = { ...data }
      
      // If paidAmount is being updated, recalculate balance
      if (data.paidAmount !== undefined) {
        const invoice = await prisma.invoice.findUnique({
          where: { id },
          select: { totalAmount: true }
        })
        
        if (invoice) {
          updateData.balance = Number(invoice.totalAmount) - data.paidAmount
          
          // Update status based on payment
          if (data.paidAmount >= Number(invoice.totalAmount)) {
            updateData.status = InvoiceStatus.PAID
          } else if (data.paidAmount > 0) {
            updateData.status = InvoiceStatus.PENDING
          }
        }
      }

      const invoice = await prisma.invoice.update({
        where: { id },
        data: updateData
      })

      return this.mapInvoiceToResponse(invoice)
    } catch (error) {
      logger.error('Error updating invoice:', error)
      throw error
    }
  }

  async deleteInvoice(id: string): Promise<boolean> {
    try {
      await prisma.invoice.delete({
        where: { id }
      })
      return true
    } catch (error) {
      logger.error('Error deleting invoice:', error)
      throw error
    }
  }

  private async generateInvoiceNumber(): Promise<string> {
    const count = await prisma.invoice.count()
    const invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`
    
    // Check if invoice number already exists (very unlikely but safe)
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber }
    })
    
    if (existing) {
      return this.generateInvoiceNumber() // Recursive call to generate new number
    }
    
    return invoiceNumber
  }

  private mapInvoiceToResponse(invoice: any): InvoiceResponse {
    // Generate mock Pay.gov URLs if not provided
    const paymentPageUrl = invoice.paymentPageUrl || this.generateMockPaymentUrl(invoice.invoiceNumber)
    const receiptUrl = invoice.receiptUrl || this.generateMockReceiptUrl(invoice.invoiceNumber)
    const payGovReference = invoice.payGovReference || this.generateMockPayGovReference(invoice.invoiceNumber)

    return {
      id: invoice.id,
      foiaRequestId: invoice.foiaRequestId,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: Number(invoice.totalAmount),
      paidAmount: Number(invoice.paidAmount),
      balance: Number(invoice.balance),
      description: invoice.description,
      status: invoice.status,
      dateCreated: invoice.dateCreated.toISOString(),
      dateDue: invoice.dateDue.toISOString(),
      paymentPageUrl,
      receiptUrl,
      payGovReference,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString()
    }
  }

  private generateMockPaymentUrl(invoiceNumber: string): string {
    // Generate a mock Pay.gov payment URL
    return `https://pay.gov/payment/invoice/${invoiceNumber}?amount=${Math.floor(Math.random() * 500) + 50}`
  }

  private generateMockReceiptUrl(invoiceNumber: string): string {
    // Generate a mock Pay.gov receipt URL (only for paid invoices)
    return `https://pay.gov/receipt/invoice/${invoiceNumber}/receipt.pdf`
  }

  private generateMockPayGovReference(invoiceNumber: string): string {
    // Generate a mock Pay.gov reference number
    const timestamp = Date.now().toString().slice(-6)
    return `PAYGOV-${invoiceNumber}-${timestamp}`
  }
}

// Export singleton instance
export const invoicesService = new InvoicesService()
