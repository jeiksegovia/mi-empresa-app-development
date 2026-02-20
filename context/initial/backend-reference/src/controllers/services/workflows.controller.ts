import { Request, Response, NextFunction } from 'express'
import * as redactionService from '../../services/redaction.service'

export async function postRedactedNotification(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate content type
    if (req.get('content-type') !== 'application/json') {
      return res.status(400).json({ error: 'Content-Type must be application/json' })
    }

    const payload = req.body

    // Type 3: Redacted notification (has redacted_pdf_link) - most specific
    if (payload.redacted_pdf_link) {
      console.log('Routing to redaction handler (Type 3: Redacted)')
      await redactionService.handleNotifier(payload)
      return res.json({ success: true })
    }

    // Type 1 & 2: Workflow notifications (has state but no redacted_pdf_link)
    if (payload.state) {
      const notificationType = payload.substate ? 'Type 2: Supervision' : 'Type 1: Processing'
      console.log(`Routing to workflow handler (${notificationType})`)
      await redactionService.handleWorkflowNotification(payload)
      return res.json({ success: true })
    }

    // Unknown notification type
    console.warn('Unknown notification type received:', {
      hasState: !!payload.state,
      hasSubstate: !!payload.substate,
      hasRedactedLink: !!payload.redacted_pdf_link
    })
    return res.status(400).json({
      error: 'Unknown notification type - cannot identify handler',
      details: 'Payload must have either redacted_pdf_link or state property'
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Document not found') {
        return res.status(400).json({ error: 'Invalid payload - document not found' })
      }
      if (error.message.includes('Failed to process') || error.message.includes('Failed to update')) {
        return res.status(500).json({ error: error.message })
      }
    }
    next(error)
  }
}
