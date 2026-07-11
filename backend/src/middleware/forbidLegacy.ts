import { Request, Response, NextFunction } from 'express'

/**
 * Middleware: reject payloads that include legacy keys (e.g. `cargo: string`)
 * that were silently dropped by Zod's default `.strip()` mode. Runs BEFORE
 * the validate middleware, while req.body still contains the raw payload.
 *
 * Usage: `router.post('/path', forbidLegacy(['cargo']), validate(schema), handler)`
 */
export function forbidLegacy(forbidden: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      for (const key of forbidden) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          res.status(400).json({
            success: false,
            message: `El campo "${key}" ya no es aceptado`,
            field: 'cargoId', // jul-9 D7: surface the new correct field name
          })
          return
        }
      }
    }
    next()
  }
}
