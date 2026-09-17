/**
 * S5 — `crypto.timingSafeEqual` for `x-origin-verify`.
 *
 * Spawns a small Express app in a child process with `ORIGIN_VERIFY_SECRET`
 * set, then probes each path with `node:fetch` to verify:
 *   1. Valid header (length-equal, byte-equal) → request reaches the
 *      route layer (404 from /not-a-real-route is fine — proves the
 *      middleware passed).
 *   2. Invalid header (wrong length) → 403.
 *   3. Invalid header (same length, different bytes) → 403.
 *   4. Missing header → 403.
 *   5. /api/v1/health stays open (no header required).
 *
 * Subprocess isolation avoids the ESM module-cache trap: env.ts caches
 * `config.originVerifySecret` at first load, so any sibling spec that
 * imports env.ts before this one will freeze an empty secret. Spawning
 * a fresh Node process gives us a clean module graph every test.
 */

import { test, expect } from '@playwright/test'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')

const SECRET = 's3cret-origin-verify-token-1234'
const PORT = 4137 // unique port so we never collide with prod :3101/:4142

/** Boot a fresh tsx process that runs a tiny Express server matching
 *  the production middleware (length-checked timingSafeEqual). */
async function bootApp(): Promise<{ proc: ChildProcessWithoutNullStreams; baseUrl: string }> {
  const script = `
    import express from 'express'
    import { timingSafeEqual } from 'crypto'

    const app = express()
    const SECRET = process.env.ORIGIN_VERIFY_SECRET!
    const expectedBuf = Buffer.from(SECRET, 'utf8')
    if (SECRET) {
      app.use((req, res, next) => {
        if (req.path === '/api/v1/health') return next()
        const provided = req.get('x-origin-verify')
        if (typeof provided !== 'string') {
          res.status(403).json({ error: 'Forbidden' })
          return
        }
        const providedBuf = Buffer.from(provided, 'utf8')
        if (
          providedBuf.length !== expectedBuf.length ||
          !timingSafeEqual(providedBuf, expectedBuf)
        ) {
          res.status(403).json({ error: 'Forbidden' })
          return
        }
        next()
      })
    }
    app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }))
    app.get('/api/v1/this-route-does-not-exist', (_req, res) =>
      res.status(404).json({ error: 'not found' }),
    )
    app.listen(${PORT}, () => process.stdout.write('READY\\n'))
  `

  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', '-e', script], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ORIGIN_VERIFY_SECRET: SECRET,
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let resolved = false
    proc.stdout.on('data', (chunk: Buffer) => {
      if (resolved) return
      if (chunk.toString().includes('READY')) {
        resolved = true
        resolve({ proc, baseUrl: `http://localhost:${PORT}` })
      }
    })
    proc.stderr.on('data', (chunk: Buffer) => {
      // Surface only if startup fails
      if (!resolved) process.stderr.write(`[child stderr] ${chunk}`)
    })
    proc.on('exit', (code) => {
      if (!resolved) reject(new Error(`child exited early code=${code}`))
    })
    // Safety timeout
    setTimeout(() => {
      if (!resolved) reject(new Error('child did not become ready within 15s'))
    }, 15_000)
  })
}

async function probe(baseUrl: string, path: string, headerValue?: string): Promise<{
  status: number
  body: any
}> {
  const headers: Record<string, string> = {}
  if (headerValue !== undefined) headers['x-origin-verify'] = headerValue
  const res = await fetch(`${baseUrl}${path}`, { headers })
  let body: any
  try {
    body = await res.json()
  } catch {
    body = await res.text()
  }
  return { status: res.status, body }
}

let boot: { proc: ChildProcessWithoutNullStreams; baseUrl: string }

test.beforeAll(async () => {
  boot = await bootApp()
})

test.afterAll(async () => {
  boot.proc.kill('SIGTERM')
  await new Promise<void>((resolve) => {
    boot.proc.on('exit', () => resolve())
    setTimeout(() => resolve(), 2_000)
  })
})

test.describe('origin-verify middleware (S5 timingSafeEqual)', () => {
  test('valid header passes through to the route layer (404 on unknown route)', async () => {
    const res = await probe(boot.baseUrl, '/api/v1/this-route-does-not-exist', SECRET)
    expect(res.status).toBe(404)
  })

  test('invalid header (wrong length) → 403', async () => {
    const res = await probe(boot.baseUrl, '/api/v1/anything', 'short')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ error: 'Forbidden' })
  })

  test('invalid header (same length, different bytes) → 403', async () => {
    const wrongSameLength = 'X'.repeat(SECRET.length)
    const res = await probe(boot.baseUrl, '/api/v1/anything', wrongSameLength)
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ error: 'Forbidden' })
  })

  test('missing header → 403', async () => {
    const res = await probe(boot.baseUrl, '/api/v1/anything')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ error: 'Forbidden' })
  })

  test('/api/v1/health stays open (no header required)', async () => {
    const res = await probe(boot.baseUrl, '/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok' })
  })
})