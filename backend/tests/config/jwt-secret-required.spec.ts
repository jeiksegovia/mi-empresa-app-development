/**
 * S1 — env.ts crash-fast on missing JWT_SECRET in production.
 *
 * The `config` module is read once at import time, so we can't easily
 * bust the cache from inside Playwright. Instead we spawn a one-shot
 * Node child process that imports env.ts with a controlled environment
 * and inspect the exit code / stderr:
 *   - production + no JWT_SECRET → process exits non-zero with stderr
 *     containing "JWT_SECRET"
 *   - production + whitespace JWT_SECRET → same throw
 *   - production + real JWT_SECRET → exits 0, prints config.jwt.secret
 *   - dev + no JWT_SECRET → exits 0, config.jwt.secret is the placeholder
 *
 * This keeps the spec fast (subprocess boot is <500ms) and side-effect
 * free — the child exits cleanly so no module state leaks back into the
 * parent.
 */

import { test, expect } from '@playwright/test'
import { spawnSync } from 'child_process'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const ENV_TS = path.join(REPO_ROOT, 'src', 'config', 'env.ts')

/**
 * Run `tsx -e "<inline script>"` with the given extra env vars.
 *
 * `tsx` is already a dev dependency and handles TS on the fly without a
 * build step. We use `tsx -e` so the child loads env.ts in its own
 * process; no module cache pollution.
 */
function runEnvProbe(extraEnv: Record<string, string | undefined>): {
  status: number
  stdout: string
  stderr: string
} {
  const script = `
    import { config } from '${ENV_TS}'
    process.stdout.write(JSON.stringify({
      nodeEnv: config.nodeEnv,
      isDev: config.isDev,
      jwtSecret: config.jwt.secret,
    }))
  `
  const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv }
  // Drop undefined values so the child sees the right key absence.
  for (const [k, v] of Object.entries(extraEnv)) {
    if (v === undefined) delete env[k]
  }
  // Spawn the child in /tmp (which has no .env) so dotenv.config() in
  // env.ts can't re-populate JWT_SECRET from backend/.env. We pass the
  // absolute path to env.ts in the inline script, so cwd only affects
  // dotenv's file lookup, not module resolution.
  const res = spawnSync('npx', ['tsx', '-e', script], {
    cwd: '/tmp',
    env,
    encoding: 'utf8',
    timeout: 15_000,
  })
  return {
    status: res.status ?? -1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  }
}

test.describe('config/env — JWT_SECRET enforcement (S1)', () => {
  test('throws at import time when NODE_ENV=production and JWT_SECRET is unset', () => {
    const res = runEnvProbe({
      NODE_ENV: 'production',
      JWT_SECRET: undefined,
    })
    expect(res.status).not.toBe(0)
    expect(res.stderr).toMatch(/JWT_SECRET/)
  })

  test('throws when NODE_ENV=production and JWT_SECRET is whitespace-only', () => {
    const res = runEnvProbe({
      NODE_ENV: 'production',
      JWT_SECRET: '   ',
    })
    expect(res.status).not.toBe(0)
    expect(res.stderr).toMatch(/JWT_SECRET/)
  })

  test('does NOT throw when NODE_ENV=production and JWT_SECRET is set', () => {
    const realSecret = 'real-production-secret-not-the-fallback'
    const res = runEnvProbe({
      NODE_ENV: 'production',
      JWT_SECRET: realSecret,
    })
    expect(res.status).toBe(0)
    const parsed = JSON.parse(res.stdout)
    expect(parsed.jwtSecret).toBe(realSecret)
    expect(parsed.nodeEnv).toBe('production')
    expect(parsed.isDev).toBe(false)
  })

  test('falls back to dev placeholder when NODE_ENV=development and JWT_SECRET is unset', () => {
    const res = runEnvProbe({
      NODE_ENV: 'development',
      JWT_SECRET: undefined,
    })
    expect(res.status).toBe(0)
    const parsed = JSON.parse(res.stdout)
    expect(parsed.nodeEnv).toBe('development')
    expect(parsed.isDev).toBe(true)
    // Local dev keeps the deterministic placeholder so contributors
    // don't have to set a secret just to boot the API.
    expect(parsed.jwtSecret).toBe('dev-secret-change-me')
  })

  test('falls back to dev placeholder when NODE_ENV is unset and JWT_SECRET is unset', () => {
    const res = runEnvProbe({
      NODE_ENV: undefined,
      JWT_SECRET: undefined,
    })
    expect(res.status).toBe(0)
    const parsed = JSON.parse(res.stdout)
    expect(parsed.nodeEnv).toBe('development')
    expect(parsed.isDev).toBe(true)
    expect(parsed.jwtSecret).toBe('dev-secret-change-me')
  })
})