import { NextFunction, Request, Response } from 'express'
import * as service from '../../services/support-tickets.service'
import { UpdateSupportTicketRequest, AddSupportTicketMessageRequest } from '../../types/support-tickets'
import { AuthenticatedRequest } from '../../middleware/auth'

// Get all support tickets (admin only)
export async function getAllTickets(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user
    if (!user || !user.isInternal) {
      return res.status(403).json({ error: 'Access denied. Admin access required.' })
    }

    const filters = {
      status: req.query.status as any,
      priority: req.query.priority as any,
      category: req.query.category as any,
      assignedTo: req.query.assignedTo as string,
      search: req.query.search as string
    }

    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters] === undefined) {
        delete filters[key as keyof typeof filters]
      }
    })

    const tickets = await service.listAllSupportTickets(filters)

    res.json({
      success: true,
      tickets: tickets.map((ticket: any) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        foiaRequestId: ticket.foiaRequestId,
        foiaRequest: ticket.foiaRequest,
        requesterName: ticket.creator.name,
        requesterEmail: ticket.creator.email,
        requesterPhone: ticket.foiaRequest?.requesterPhone || null,
        assignedTo: ticket.assignedTo,
        assignedUser: ticket.assignedUser,
        createdBy: ticket.createdBy,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt
      }))
    })
  } catch (error) {
    next(error)
  }
}

// Get support tickets for assigned requests (agent)
export async function getTicketsForAssignedRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user
    if (!user || !user.isInternal) {
      return res.status(403).json({ error: 'Access denied. Internal access required.' })
    }

    const filters = {
      status: req.query.status as any,
      priority: req.query.priority as any,
      category: req.query.category as any,
      search: req.query.search as string
    }

    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters] === undefined) {
        delete filters[key as keyof typeof filters]
      }
    })

    const tickets = await service.listSupportTicketsForAssignedRequests(user.id, filters)

    res.json({
      success: true,
      tickets: tickets.map((ticket: any) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        foiaRequestId: ticket.foiaRequestId,
        foiaRequest: ticket.foiaRequest,
        requesterName: ticket.creator.name,
        requesterEmail: ticket.creator.email,
        requesterPhone: ticket.foiaRequest?.requesterPhone || null,
        assignedTo: ticket.assignedTo,
        assignedUser: ticket.assignedUser,
        createdBy: ticket.createdBy,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt
      }))
    })
  } catch (error) {
    next(error)
  }
}

// Get a specific support ticket
export async function getTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user
    if (!user || !user.isInternal) {
      return res.status(403).json({ error: 'Access denied. Internal access required.' })
    }

    const { ticketId } = req.params
    const ticket = await service.getSupportTicket(ticketId)
    
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found' })
    }

    res.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        foiaRequestId: ticket.foiaRequestId,
        foiaRequest: ticket.foiaRequest,
        requesterName: ticket.creator.name,
        requesterEmail: ticket.creator.email,
        requesterPhone: ticket.foiaRequest?.requesterPhone || null,
        assignedTo: ticket.assignedTo,
        assignedUser: ticket.assignedUser,
        createdBy: ticket.createdBy,
        creator: ticket.creator,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt,
        messages: ticket.messages.map((message: any) => ({
          id: message.id,
          message: message.message,
          senderType: message.senderType,
          senderId: message.senderId,
          senderName: message.senderName,
          senderEmail: message.senderEmail,
          isInternal: message.isInternal,
          createdAt: message.createdAt,
          sender: message.sender
        }))
      }
    })
  } catch (error) {
    next(error)
  }
}

// Update a support ticket
export async function updateTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user
    if (!user || !user.isInternal) {
      return res.status(403).json({ error: 'Access denied. Internal access required.' })
    }

    const { ticketId } = req.params
    const updateData: UpdateSupportTicketRequest = req.body

    const ticket = await service.updateSupportTicket(ticketId, updateData)
    
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found' })
    }

    res.json({
      success: true,
      message: 'Support ticket updated successfully',
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        foiaRequestId: ticket.foiaRequestId,
        requesterName: ticket.creator.name,
        requesterEmail: ticket.creator.email,
        requesterPhone: ticket.foiaRequest?.requesterPhone || null,
        assignedTo: ticket.assignedTo,
        assignedUser: ticket.assignedUser,
        createdBy: ticket.createdBy,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt
      }
    })
  } catch (error) {
    next(error)
  }
}

// Add a message to a support ticket
export async function addMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user
    if (!user || !user.isInternal) {
      return res.status(403).json({ error: 'Access denied. Internal access required.' })
    }

    const { ticketId } = req.params
    const messageData: AddSupportTicketMessageRequest = req.body

    // First check if the ticket exists
    const ticket = await service.getSupportTicket(ticketId)
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found' })
    }

    // Add the message
    const message = await service.addSupportTicketMessage(
      ticketId,
      messageData,
      user.id,
      user.name,
      user.email
    )

    res.status(201).json({
      success: true,
      message: 'Message added successfully',
      data: {
        id: message.id,
        message: message.message,
        senderType: message.senderType,
        senderId: message.senderId,
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        isInternal: message.isInternal,
        createdAt: message.createdAt,
        sender: message.sender
      }
    })
  } catch (error) {
    next(error)
  }
}

// Assign a support ticket
export async function assignTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user
    if (!user || !user.isInternal) {
      return res.status(403).json({ error: 'Access denied. Internal access required.' })
    }

    const { ticketId } = req.params
    const { assignedTo } = req.body

    const updateData: UpdateSupportTicketRequest = { assignedTo }
    const ticket = await service.updateSupportTicket(ticketId, updateData)
    
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found' })
    }

    res.json({
      success: true,
      message: 'Support ticket assigned successfully',
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        assignedTo: ticket.assignedTo,
        assignedUser: ticket.assignedUser,
        updatedAt: ticket.updatedAt
      }
    })
  } catch (error) {
    next(error)
  }
}

// Get support ticket statistics
export async function getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user
    if (!user || !user.isInternal) {
      return res.status(403).json({ error: 'Access denied. Internal access required.' })
    }

    const stats = await service.getSupportTicketStats()

    res.json({
      success: true,
      stats
    })
  } catch (error) {
    next(error)
  }
}

// Get support tickets for a specific request
export async function getTicketsForRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user
    if (!user || !user.isInternal) {
      return res.status(403).json({ error: 'Access denied. Internal access required.' })
    }

    const { requestId } = req.params
    const tickets = await service.listSupportTicketsForRequest(requestId)

    res.json({
      success: true,
      tickets: tickets.map((ticket: any) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        requesterName: ticket.creator.name,
        requesterEmail: ticket.creator.email,
        requesterPhone: ticket.foiaRequest?.requesterPhone || null,
        assignedTo: ticket.assignedTo,
        assignedUser: ticket.assignedUser,
        createdBy: ticket.createdBy,
        creator: ticket.creator,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt
      }))
    })
  } catch (error) {
    next(error)
  }
}
