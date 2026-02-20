import { NextFunction, Request, Response } from 'express'
import { logger } from '../config/logger'
import { ZodError } from 'zod'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  let status = err.status || 500
  let message = err.message || 'Server error'
  // detect prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    logger.error('Prisma Error Meta', err?.meta)
    if (err.code === 'P2002') { // Unique constraint failed
      status = 400      
      message = 'Unique constraint failed - primsa error P2002'
    }
  }

  if (err instanceof ZodError) {
    status = 400
    message = err.errors.map(e => e.message).join(', ')
  } else if (err.code === 'P2025') { // Prisma record not found
    status = 404
    message = 'Resource not found'
  }

  logger.error('Error:', { status, message, stack: err.stack })
  res.status(status).json({ error: message })
}
