import { Request, Response, NextFunction } from 'express'
import { invoicesService } from '../../services/invoices.service'
import { AuthenticatedRequest } from '../../middleware/auth'

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.createInvoice(req.body)
    res.status(201).json(invoice)
  } catch (error) {
    next(error)
  }
}

export async function getAllInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      status: req.query.status as any,
      foiaRequestId: req.query.foiaRequestId as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10
    }

    const result = await invoicesService.getInvoices(filters)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export async function getInvoiceById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const invoice = await invoicesService.getInvoiceById(id)
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }
    
    res.json(invoice)
  } catch (error) {
    next(error)
  }
}

export async function getInvoicesByRequestId(req: Request, res: Response, next: NextFunction) {
  try {
    const { requestId } = req.params
    const invoices = await invoicesService.getInvoicesByRequestId(requestId)
    res.json({ invoices, total: invoices.length })
  } catch (error) {
    next(error)
  }
}

export async function updateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const invoice = await invoicesService.updateInvoice(id, req.body)
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }
    
    res.json(invoice)
  } catch (error) {
    next(error)
  }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const success = await invoicesService.deleteInvoice(id)
    
    if (!success) {
      return res.status(404).json({ error: 'Invoice not found' })
    }
    
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
