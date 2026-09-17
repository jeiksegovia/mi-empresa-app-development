import { test, expect } from '@playwright/test'

/**
 * sfx-W3 (task #9) — Staging quality gate: S2 download-url authorization
 * -----------------------------------------------------------------------
 * Validates the corrected S2 fix (decision 03: FLAT keys + record-scoped
 * authz) end-to-end against the LIVE staging deployment through CloudFront.
 *
 * The unit suite (tests/uploads/upload-ownership-idor.spec.ts, 18 cases)
 * already proves the helper with a stubbed Prisma. THIS suite proves the
 * same logic on the deployed bundle, hitting the real Prisma + the real
 * CloudFront origin-verify chain. Cross-user IDOR is the case devops did
 * NOT smoke at #8 (deveops only ran the ADMIN happy path).
 *
 * Required env (exported by the runner):
 *   TEST_API_URL                      e.g. https://miempresa-api-stg.disruptiveexp.com
 *   QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD
 *   QA_PROFESOR_EMAIL / QA_PROFESOR_PASSWORD  (EMPLEADO PROFESORES, empleadoId != 13)
 *   QA_GERONTOLOGA_EMAIL / QA_GERONTOLOGA_PASSWORD
 *   QA_CONTRATOS_EMAIL / QA_CONTRATOS_PASSWORD
 *
 * Test fixture (live data on staging):
 *   empleadoId 13 → hoja_vida_url = "hojas-vida/<uuid>.pdf"
 *   (qa-profesor is linked to empleadoId 16 — different employee, used to
 *    trigger the cross-user IDOR path)
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001'
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || process.env.QA_USER_EMAIL || ''
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || process.env.QA_USER_PASSWORD || ''
const PROFESOR_EMAIL = process.env.QA_PROFESOR_EMAIL || ''
const PROFESOR_PASSWORD = process.env.QA_PROFESOR_PASSWORD || ''
const GERONTOLOGA_EMAIL = process.env.QA_GERONTOLOGA_EMAIL || ''
const GERONTOLOGA_PASSWORD = process.env.QA_GERONTOLOGA_PASSWORD || ''
const CONTRATOS_EMAIL = process.env.QA_CONTRATOS_EMAIL || ''
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || ''

// Real DB fixture on staging: empleado 13 has a real hoja de vida uploaded.
const STAGING_EMPLEADO_KEY = 'hojas-vida/2eb13439-d597-49d0-9d02-11919547ef1c.pdf'
// Random key in the allowed folder but NOT in any DB record (IDOR target).
const ARBITRARY_KEY = 'documents/00000000-0000-0000-0000-000000000000.pdf'

async function login(request: any, email: string, password: string): Promise<void> {
  expect(email, `${email} env var required`).toBeTruthy()
  expect(password, `${email} password env var required`).toBeTruthy()
  const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  })
  expect(res.status(), `login(${email}) failed: ${await res.text()}`).toBe(200)
}

test.describe('S2 download-url authorization (sfx-W3 staging quality gate)', () => {
  test('1. ADMIN downloads a DB-referenced key → 200 + presigned URL', async ({ request }) => {
    await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    const res = await request.get(
      `${API_BASE}/api/v1/uploads/download-url?key=${encodeURIComponent(STAGING_EMPLEADO_KEY)}`,
    )
    expect(res.status(), `body: ${await res.text()}`).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.downloadUrl).toContain('miempresa-uploads-540657241795-staging.s3')
  })

  test('2. A key not referenced by any DB record → 403 (the IDOR block)', async ({ request }) => {
    await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    const res = await request.get(
      `${API_BASE}/api/v1/uploads/download-url?key=${encodeURIComponent(ARBITRARY_KEY)}`,
    )
    expect(res.status(), `body: ${await res.text()}`).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toMatch(/no tiene permisos/i)
  })

  test('3. EMPLEADO cross-user IDOR: qa-profesor requests empleado 13\'s key → 403', async ({ request }) => {
    await login(request, PROFESOR_EMAIL, PROFESOR_PASSWORD)
    const res = await request.get(
      `${API_BASE}/api/v1/uploads/download-url?key=${encodeURIComponent(STAGING_EMPLEADO_KEY)}`,
    )
    expect(res.status(), `body: ${await res.text()}`).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test('4. GERONTOLOGA requesting empleados-scope record → 403 (matrix false)', async ({ request }) => {
    await login(request, GERONTOLOGA_EMAIL, GERONTOLOGA_PASSWORD)
    const res = await request.get(
      `${API_BASE}/api/v1/uploads/download-url?key=${encodeURIComponent(STAGING_EMPLEADO_KEY)}`,
    )
    expect(res.status(), `body: ${await res.text()}`).toBe(403)
  })

  test('5. CONTRATOS (matrix:true but callerEmpleadoId=null) → 403 (ownership gate)', async ({ request }) => {
    await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)
    const res = await request.get(
      `${API_BASE}/api/v1/uploads/download-url?key=${encodeURIComponent(STAGING_EMPLEADO_KEY)}`,
    )
    expect(res.status(), `body: ${await res.text()}`).toBe(403)
  })

  test('6. ADMIN with empty key → 400 (validate)', async ({ request }) => {
    await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    const res = await request.get(`${API_BASE}/api/v1/uploads/download-url?key=`)
    expect(res.status()).toBe(400)
  })

  test('7. OLD flat key (legacy format, no prefix) referenced by DB record → still downloads for ADMIN', async ({ request }) => {
    // STAGING_EMPLEADO_KEY IS an old flat key (just `hojas-vida/<uuid>.pdf`)
    // — proves backward compat with the existing records on staging.
    await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    const res = await request.get(
      `${API_BASE}/api/v1/uploads/download-url?key=${encodeURIComponent(STAGING_EMPLEADO_KEY)}`,
    )
    expect(res.status(), `body: ${await res.text()}`).toBe(200)
    const body = await res.json()
    expect(body.data.downloadUrl).toBeTruthy()
  })
})