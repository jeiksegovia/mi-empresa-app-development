import { test, expect } from '@playwright/test'

/**
 * Staging Smoke / Integration — Backend API tier
 *
 * Runs against a DEPLOYED stage through its public HTTPS URL (CloudFront),
 * so it also exercises TLS, the x-origin-verify origin hardening, and CORS.
 *
 * Read-mostly by design: only the QA user's session is created (and cleaned
 * up by logout). Full CRUD suites stay local — see tests/README.md.
 *
 * Required env (exported by run-staging-qa.sh from SSM):
 *   TEST_API_URL      e.g. https://miempresa-api-stg.disruptiveexp.com
 *   QA_USER_EMAIL / QA_USER_PASSWORD
 *   TEST_FRONTEND_URL (optional, for the CORS check)
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001'
const QA_EMAIL = process.env.QA_USER_EMAIL || 'qa@miempresa.com'
const QA_PASSWORD = process.env.QA_USER_PASSWORD || ''
const FRONTEND_ORIGIN = process.env.TEST_FRONTEND_URL || 'https://miempresa-stg.disruptiveexp.com'

// Run serially — the shared session cookie flows login → me → logout
test.describe.configure({ mode: 'serial' })

test.describe('Staging API smoke', () => {
  let sessionCookie: string

  test('health endpoint responds 200 with status field', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status')
  })

  test('origin hardening: non-health route is NOT reachable bypassing CloudFront', async ({ request }) => {
    // Through CloudFront (API_BASE) the x-origin-verify header is injected, so
    // this must NOT be 403; unauthenticated it should be 400/401 instead.
    const res = await request.post(`${API_BASE}/api/v1/auth/login`, { data: {} })
    expect(res.status()).not.toBe(403)
    expect([400, 401]).toContain(res.status())
  })

  test('CORS: preflight from the frontend origin is allowed with credentials', async ({ request }) => {
    const res = await request.fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: FRONTEND_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    expect([200, 204]).toContain(res.status())
    expect(res.headers()['access-control-allow-origin']).toBe(FRONTEND_ORIGIN)
    expect(res.headers()['access-control-allow-credentials']).toBe('true')
  })

  test('login rejects wrong password with 401', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: QA_EMAIL, password: 'definitely-wrong-password' },
    })
    expect(res.status()).toBe(401)
  })

  test('dev credentials match the stage policy (DEV_USERS_ENABLED)', async ({ request }) => {
    // Policy flag: SSM /miempresa/<stage>/qa/DEV_USERS_ENABLED (exported by the runner).
    //  - "true"  → dev users were deliberately provisioned via create-users-staging.sh
    //              (developer-approved for staging, July 4 2026) and MUST log in.
    //  - else    → dev creds MUST be rejected; if they log in, someone ran the dev
    //              seed / create-users against a stage where the weak publicly-known
    //              password is not supposed to exist (security canary).
    const devUsersEnabled = process.env.DEV_USERS_ENABLED === 'true'
    const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: 'admin@miempresa.com', password: 'password123' },
    })
    // Clean up the session if it logged in (keep the canary side-effect-free)
    if (res.status() === 200) await request.post(`${API_BASE}/api/v1/auth/logout`).catch(() => {})

    if (devUsersEnabled) {
      expect(
        res.status(),
        'DEV_USERS_ENABLED=true but admin@miempresa.com cannot log in — ' +
        're-run prisma/test-db/create-users-staging.sh (password drift?)'
      ).toBe(200)
    } else {
      expect(
        res.status(),
        'SECURITY: dev credentials logged in on a stage where DEV_USERS_ENABLED is not true — ' +
        'remove the user or set the flag deliberately via create-users-staging.sh'
      ).toBe(401)
    }
  })

  test('login succeeds with QA credentials and sets the session cookie', async ({ request }) => {
    expect(QA_PASSWORD, 'QA_USER_PASSWORD must be set (run via run-staging-qa.sh)').toBeTruthy()

    // Clear any stale session first (mirrors auth.spec.ts pattern)
    await request.post(`${API_BASE}/api/v1/auth/logout`).catch(() => {})

    const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: QA_EMAIL, password: QA_PASSWORD },
    })
    expect(
      res.status(),
      `QA login failed. Config checklist: (1) QA user seeded? run prisma/test-db/seed-qa-staging.sh ` +
      `(2) SSM password rotated without re-seeding? db-staging-qa.sh check [5/5] detects that drift ` +
      `(3) NOTE: dev creds (admin@miempresa.com) do not exist on stages by design`
    ).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('user')
    expect(body.user).toHaveProperty('email', QA_EMAIL)
    expect(body.user).not.toHaveProperty('password')

    const setCookie = res.headers()['set-cookie']
    expect(setCookie).toContain('session=')
    // Deployed stages run NODE_ENV=production → cookie must be HttpOnly + Secure
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    sessionCookie = setCookie.match(/session=([^;]+)/)![0]
  })

  test('authenticated GET /auth/me returns the QA user', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/auth/me`, {
      headers: { Cookie: sessionCookie },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.user?.email ?? body.email).toBe(QA_EMAIL)
  })

  test('unauthenticated GET /auth/me is rejected with 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/auth/me`)
    expect(res.status()).toBe(401)
  })

  test('logout invalidates the session', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    })
    expect([200, 204]).toContain(res.status())

    const after = await request.get(`${API_BASE}/api/v1/auth/me`, {
      headers: { Cookie: sessionCookie },
    })
    expect(after.status()).toBe(401)
  })
})
