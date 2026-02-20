import { NextFunction, Request, Response } from 'express'
import * as service from '../../services/notes.service'
import { mapNote } from '../../utils/responseMapper'

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const notes = await service.getInternalNotes(req.params.requestId)
    res.json(notes.map(mapNote))
  } catch (error) {
    next(error)
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await service.getNote(req.params.id)
    if (!note) return res.status(404).json({ error: 'Note not found' })
    res.json(mapNote(note))
  } catch (error) {
    next(error)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const createdBy = (req as any).user?.id
    if (!createdBy) return res.status(401).json({ error: 'Authentication required' })
    
    const note = await service.createNote(req.body, createdBy)
    res.json(mapNote(note))
  } catch (error) {
    next(error)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await service.updateNote(req.params.id, req.body)
    if (!note) return res.status(404).json({ error: 'Note not found' })
    res.json(mapNote(note))
  } catch (error) {
    next(error)
  }
}

export async function deleteNote(req: Request, res: Response, next: NextFunction) {
  try {
    const success = await service.deleteNote(req.params.id)
    if (!success) return res.status(404).json({ error: 'Note not found' })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
