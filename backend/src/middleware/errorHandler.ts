import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../config/logger.js'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error:', err)

  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any
    if (prismaError.code === 'P2002') {
      // S8: do NOT echo Prisma's `meta.target` (the underlying constraint
      // name) to the client — it leaks the schema. Keep it in the server
      // log (the top-level `logger.error` already captured `err`).
      logger.warn(
        `Prisma P2002 unique-constraint violation on target=${JSON.stringify(
          prismaError.meta?.target,
        )}`,
      )
      res.status(409).json({
        success: false,
        message: 'A record with this value already exists',
      })
      return
    }
    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Record not found',
      })
      return
    }
  }

  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {}
    err.errors.forEach((e) => {
      const path = e.path.join('.')
      if (!errors[path]) errors[path] = []
      errors[path].push(e.message)
    })
    // contract §2.3: 400 with field. Use the first error path as the canonical
    // field for the simple {success,message,field} envelope; full per-field
    // detail is still in `errors`.
    const firstPath = err.errors[0]?.path?.join('.') || ''
    res.status(400).json({
      success: false,
      message: 'Validation error',
      ...(firstPath ? { field: firstPath } : {}),
      errors,
    })
    return
  }

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  })
}
