import { NextFunction, Request, Response } from 'express'
import * as service from '../../services/requests.service'
import { mapFOIARequest } from '../../utils/responseMapper'
import { getPrisma } from '../../config/database'

const prisma = getPrisma()

export async function getAll(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listRequests()
    res.json(data.map(mapFOIARequest))
  } catch (error) {
    next(error)
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await service.getRequest(req.params.id)
    if (!r) return res.status(404).json({ error: 'Request not found' })
    res.json(mapFOIARequest(r))
  } catch (error) {
    next(error)
  }
}

export async function getOneByNumber(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await service.getRequestByNumber(req.params.requestNumber)
    if (!r) return res.status(404).json({ error: 'Request not found' })
    res.json(mapFOIARequest(r))
  } catch (error) {
    next(error)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await service.createRequest(req.body)
    res.json(mapFOIARequest(r))
  } catch (error) {
    next(error)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await service.updateRequest(req.params.id, req.body)
    if (!r) return res.status(404).json({ error: 'Request not found' })
    res.json(mapFOIARequest(r))
  } catch (error) {
    next(error)
  }
}

export async function deleteRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const success = await service.deleteRequest(req.params.id)
    if (!success) return res.status(404).json({ error: 'Request not found' })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

export async function assignRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { assignedTo } = req.body
    const r = await service.assignRequest(req.params.id, assignedTo)
    if (!r) return res.status(404).json({ error: 'Request not found' })
    res.json(mapFOIARequest(r))
  } catch (error) {
    next(error)
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, priority } = req.body
    const r = await service.updateRequestStatus(req.params.id, status, priority)
    if (!r) return res.status(404).json({ error: 'Request not found' })
    res.json(mapFOIARequest(r))
  } catch (error) {
    next(error)
  }
}

export async function handleWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const requestId = req.params.id
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const result = await service.handleRequestWorkflow(requestId, req.body, userId)

    if (!result) {
      return res.status(404).json({ error: 'Request not found' })
    }

    res.json({
      success: true,
      request: mapFOIARequest(result.request),
      message: result.message
    })
  } catch (error) {
    next(error)
  }
}

export async function getExemptions(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.exemption.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' }
    })
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function getExclusions(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.exclusion.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' }
    })
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function getRequestExemptionsExclusionsInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getRequestExemptionsExclusionsInfo(req.params.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}
