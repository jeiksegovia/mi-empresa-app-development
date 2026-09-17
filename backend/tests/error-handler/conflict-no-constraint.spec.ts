/**
 * S8 — `errors.constraint` removed from client response on Prisma P2002.
 *
 * Pure middleware test. We craft a Prisma-shaped error and verify:
 *   1. The 409 response body does NOT include `errors.constraint`
 *      (it would leak the underlying schema name).
 *   2. The 409 response body still has the user-friendly
 *      `{ success: false, message: 'A record with this value already exists' }`
 *      shape — only `errors.constraint` is dropped.
 *   3. The server-side log captures the constraint target (so ops can
 *      still debug uniqueness violations).
 *   4. Other Prisma errors (P2025 not found) keep their existing shape.
 */

import { test, expect } from '@playwright/test'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../../src/middleware/errorHandler.js'
import { logger } from '../../src/config/logger.js'

// Capture warn() calls by replacing the method on the singleton logger.
// We restore after every test so other suites aren't affected.
let warnCalls: string[] = []
let originalWarn: typeof logger.warn | undefined

test.beforeEach(() => {
  warnCalls = []
  originalWarn = logger.warn.bind(logger)
  logger.warn = ((...args: unknown[]) => {
    warnCalls.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  }) as typeof logger.warn
})

test.afterEach(() => {
  if (originalWarn) {
    logger.warn = originalWarn
    originalWarn = undefined
  }
})

function prismaError(code: string, meta?: any): Error {
  const err = new Error(
    code === 'P2002'
      ? 'Unique constraint failed'
      : code === 'P2025'
        ? 'Record not found'
        : 'Prisma error',
  ) as any
  err.name = 'PrismaClientKnownRequestError'
  err.code = code
  err.meta = meta
  return err
}

function buildApp(): express.Express {
  const app = express()
  app.get('/test/p2002', (_req, _res, next) => {
    next(prismaError('P2002', { target: ['email'] }))
  })
  app.get('/test/p2025', (_req, _res, next) => {
    next(prismaError('P2025'))
  })
  app.use(errorHandler)
  return app
}

test.describe('errorHandler — S8 P2002 (constraint not echoed to client)', () => {
  test('409 body has NO errors.constraint field', async () => {
    const app = buildApp()
    const res = await request(app).get('/test/p2002')
    expect(res.status).toBe(409)
    expect(res.body).not.toHaveProperty('errors.constraint')
    expect(res.body).not.toHaveProperty('errors')
  })

  test('409 body still carries the user-facing message + success:false', async () => {
    const app = buildApp()
    const res = await request(app).get('/test/p2002')
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      success: false,
      message: 'A record with this value already exists',
    })
  })

  test('server-side log captures the constraint target', async () => {
    const app = buildApp()
    const res = await request(app).get('/test/p2002')
    expect(res.status).toBe(409)
    // The warn() call records the target so ops can debug uniqueness
    // violations without exposing the schema to the client.
    expect(warnCalls.length).toBeGreaterThan(0)
    const joined = warnCalls.join('\n')
    expect(joined).toMatch(/P2002/)
    expect(joined).toMatch(/email/)
  })

  test('P2025 (not found) is unchanged', async () => {
    const app = buildApp()
    const res = await request(app).get('/test/p2025')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({
      success: false,
      message: 'Record not found',
    })
  })
})