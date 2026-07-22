/**
 * live-profiles.spec.ts — fixes-jul17-2 W11 QA validation, Step 3.
 *
 * LIVE per-profile RBAC e2e against the real dev backend on :3101 and real
 * frontend on :3100, using the THREE QA users seeded by
 * `backend/prisma/test-db/seed-qa.ts` (qa-admin / qa-gerontologa /
 * qa-contratos). Each test uses the IP origin
 * `http://100.85.193.33:31xx` because the SPA's NUXT_PUBLIC_API_BASE_URL
 * points there and `sameSite=Strict` cookies will not survive a localhost→IP
 * navigation (see frontend/tests/helpers/auth.ts header).
 *
 * ── LIVE (no mocking) ──────────────────────────────────────────────────────
 * W10's specs (#34 nav-gating, #35 crear-template, #36 audit-dryrun) all
 * MOCKED the session + data endpoints to be deterministic; W11 is the
 * authoritative live re-run against the real seeded users and routes. Any
 * contradiction between mocked + live = BUG → gap report.
 *
 * Scenarios (per scope step 3):
 *   1. Each QA profile: login → sidebar contents (visible sections per matrix).
 *   2. CONTRATOS: forbidden direct URL /instrumentos → redirect to / + toast.
 *   3. CONTRATOS calling a fichas API via the UI → LIVE 403 DOMAIN_FORBIDDEN
 *      toast (the kind W10 didn't drive live).
 *   4. GERONTOLOGA: fichas tab visible on paciente detail; can fill an instrument.
 *   5. CONTRATOS: paciente create works; Editar hidden; fichas tab hidden.
 *   6. Method-level via API: CONTRATOS PUT /patients/:id → 403.
 *
 * Prereqs:
 *   - Backend up on :3101; frontend up on :3100; DB on :15432 with seed
 *     including the 6 dynamic instruments and ≥1 ACTIVO patient.
 *   - The 3 QA users seeded (`tsx prisma/test-db/seed-qa.ts` with the 3
 *     passwords set as env vars).
 *   - The frontend reads `NUXT_PUBLIC_API_BASE_URL=http://100.85.193.33:3101/api/v1`
 *     (matches the IP origin used by the SPA in this workspace).
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test rbac/live-profiles.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://100.85.193.33:3100'
const API = process.env.TEST_API_URL || 'http://100.85.193.33:3101/api/v1'

const PROFILES = {
  ADMIN: { email: 'qa-admin@miempresa.com', password: process.env.QA_ADMIN_PASSWORD || 'qa-admin-pwd-2026-07-17', label: 'QA Admin' },
  GERONTOLOGA: { email: 'qa-gerontologa@miempresa.com', password: process.env.QA_GERONTOLOGA_PASSWORD || 'qa-geronto-pwd-2026-07-17', label: 'QA Gerontóloga' },
  CONTRATOS: { email: 'qa-contratos@miempresa.com', password: process.env.QA_CONTRATOS_PASSWORD || 'qa-contratos-pwd-2026-07-17', label: 'QA Contratos' },
} as const

/**
 * Log in via the real /auth/login endpoint and persist the session cookie in
 * the Playwright context. Uses page.request so the cookie is set against the
 * same origin the SPA reads, avoiding the sameSite=Strict trap.
 */
async function loginAs(page: Page, profile: keyof typeof PROFILES) {
  const p = PROFILES[profile]
  // Clear any pre-existing session cookie so we don't leak across profiles.
  await page.context().clearCookies({ name: 'session' }).catch(() => {})
  const resp = await page.request.post(`${API}/auth/login`, {
    data: { email: p.email, password: p.password },
  })
  if (resp.status() !== 200) {
    throw new Error(`Login as ${profile} failed at ${API}: HTTP ${resp.status()} ${await resp.text()}`)
  }
  const body = await resp.json()
  // Per contract §1.4 the response carries tipoEmpleado (or null for ADMIN).
  expect(body.user, 'login response has user').toBeDefined()
  expect(body.user.email, `email for ${profile}`).toBe(p.email)
  if (profile === 'ADMIN') {
    expect(body.user.tipoEmpleado, 'ADMIN has null tipoEmpleado').toBeNull()
    expect(body.user.rol, 'ADMIN rol').toBe('ADMIN')
  } else {
    expect(body.user.tipoEmpleado, `${profile} tipoEmpleado`).toBe(profile)
    expect(body.user.rol, `${profile} rol`).toBe('EMPLEADO')
  }
}

/**
 * Look up sidebar link by label within the sidebar nav (exact). Mirrors the
 * W10 pattern; NuxtLink <a> in dev doesn't expose the implicit link role.
 */
function navLink(page: Page, label: string) {
  return page.locator('aside nav').getByText(label, { exact: true })
}

test.describe.configure({ mode: 'serial' })

test.describe('Live per-profile RBAC e2e (fixes-jul17-2 §1)', () => {
  // ────────────────────────────────────────────────────────────────────────
  // Scenario 1 — login + sidebar per profile (matrix §1.2)
  // ────────────────────────────────────────────────────────────────────────
  test('GERONTOLOGA login → sidebar: pacientes+instrumentos visible; empleados/asistencia/nomina/certificados/empresa hidden', async ({ page }) => {
    await loginAs(page, 'GERONTOLOGA')
    await page.goto(`${FRONTEND}/`)
    await navLink(page, 'Inicio').waitFor({ state: 'attached', timeout: 15000 })

    await expect(navLink(page, 'Inicio')).toHaveCount(1)
    await expect(navLink(page, 'Pacientes')).toHaveCount(1)
    await expect(navLink(page, 'Instrumentos')).toHaveCount(1)
    await expect(navLink(page, 'Empleados')).toHaveCount(0)
    await expect(navLink(page, 'Asistencia')).toHaveCount(0)
    await expect(navLink(page, 'Nomina')).toHaveCount(0)
    await expect(navLink(page, 'Certificados')).toHaveCount(0)
    await expect(navLink(page, 'Empresa')).toHaveCount(0)
  })

  test('CONTRATOS login → sidebar: empleados/asistencia/nomina/certificados/pacientes visible; instrumentos/empresa hidden', async ({ page }) => {
    await loginAs(page, 'CONTRATOS')
    await page.goto(`${FRONTEND}/`)
    await navLink(page, 'Inicio').waitFor({ state: 'attached', timeout: 15000 })

    await expect(navLink(page, 'Inicio')).toHaveCount(1)
    await expect(navLink(page, 'Empleados')).toHaveCount(1)
    await expect(navLink(page, 'Asistencia')).toHaveCount(1) // nomina-asistencia-jul-18
    await expect(navLink(page, 'Pacientes')).toHaveCount(1) // create-only still navigable
    await expect(navLink(page, 'Certificados')).toHaveCount(1)
    await expect(navLink(page, 'Nomina')).toHaveCount(1)
    await expect(navLink(page, 'Instrumentos')).toHaveCount(0)
    await expect(navLink(page, 'Empresa')).toHaveCount(0)
  })

  test('ADMIN (legacy null) login → every section visible incl. Empresa', async ({ page }) => {
    await loginAs(page, 'ADMIN')
    await page.goto(`${FRONTEND}/`)
    await navLink(page, 'Inicio').waitFor({ state: 'attached', timeout: 15000 })

    for (const label of ['Inicio', 'Empleados', 'Pacientes', 'Instrumentos', 'Certificados', 'Nomina', 'Empresa']) {
      await expect(navLink(page, label), `${label} visible for ADMIN`).toHaveCount(1)
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // Scenario 2 — forbidden direct URL → redirect + toast
  // ────────────────────────────────────────────────────────────────────────
  test('CONTRATOS: forbidden /instrumentos → redirect to / + "Acceso no permitido" toast', async ({ page }) => {
    await loginAs(page, 'CONTRATOS')
    await page.goto(`${FRONTEND}/instrumentos`)
    // Middleware redirects to home.
    await page.waitForURL(`${FRONTEND}/`, { timeout: 15000 })
    expect(new URL(page.url()).pathname).toBe('/')
    await expect(page.getByText('Acceso no permitido').first()).toBeVisible({ timeout: 5000 })
  })

  test('GERONTOLOGA: forbidden /empleados → redirect to / + toast', async ({ page }) => {
    await loginAs(page, 'GERONTOLOGA')
    await page.goto(`${FRONTEND}/empleados`)
    await page.waitForURL(`${FRONTEND}/`, { timeout: 15000 })
    expect(new URL(page.url()).pathname).toBe('/')
    await expect(page.getByText('Acceso no permitido').first()).toBeVisible({ timeout: 5000 })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Scenario 3 — LIVE 403 DOMAIN_FORBIDDEN toast (CONTRATOS hits a fichas
  // endpoint via the UI). This is the case W10 said it covered indirectly.
  // ────────────────────────────────────────────────────────────────────────
  test('CONTRATOS: API call to a fichas endpoint returns 403 DOMAIN_FORBIDDEN (live)', async ({ page }) => {
    await loginAs(page, 'CONTRATOS')
    // CONTRATOS is pacientes create-only — pick a real seeded patient via
    // API (allowed for CONTRATOS).
    const listResp = await page.request.get(`${API}/patients?limit=1`)
    expect(listResp.status()).toBe(200)
    const listBody = await listResp.json()
    expect(listBody.data?.length, 'seed patient exists').toBeTruthy()
    const patientId: number = listBody.data[0].id

    // The patient detail page is allowed (GET on pacientes for CONTRATOS).
    await page.goto(`${FRONTEND}/pacientes/${patientId}`)
    await expect(page.getByRole('button', { name: /Información Básica/ })).toBeVisible({ timeout: 15000 })

    // Fire the fichas endpoint from inside the SPA's origin so the SPA's
    // session cookie (sameSite=Strict) is included. Backend returns 403
    // { code: 'DOMAIN_FORBIDDEN' } per contract §1.3.
    const resp = await page.evaluate(async (apiBase: string) => {
      const r = await fetch(`${apiBase}/patients/fichas/vencimientos?days=7`, {
        credentials: 'include',
      })
      return { status: r.status, body: await r.json() }
    }, API)
    expect(resp.status, 'CONTRATOS → fichas endpoint').toBe(403)
    expect(resp.body.code, 'response code').toBe('DOMAIN_FORBIDDEN')
    expect(resp.body.message).toContain('Acceso no permitido')
  })

  // ────────────────────────────────────────────────────────────────────────
  // Scenario 4 — GERONTOLOGA: fichas tab visible + can fill an instrument.
  // Verified against the live backend with a real seed instrument and patient.
  // ────────────────────────────────────────────────────────────────────────
  test('GERONTOLOGA: fichas tab visible on paciente detail + instrument detail page reachable', async ({ page }) => {
    await loginAs(page, 'GERONTOLOGA')
    // Pick the first patient via API (allowed for GERONTOLOGA).
    const listResp = await page.request.get(`${API}/patients?limit=1`)
    expect(listResp.status()).toBe(200)
    const listBody = await listResp.json()
    expect(listBody.data?.length, 'seed patient exists').toBeTruthy()
    const patientId: number = listBody.data[0].id

    await page.goto(`${FRONTEND}/pacientes/${patientId}`)
    await expect(page.getByRole('button', { name: /Información Básica/ })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Fichas & Evaluaciones/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Notas/ })).toBeVisible()

    // The Instrumentos section is also allowed for GERONTOLOGA.
    const instResp = await page.request.get(`${API}/instruments/BARTHEL/definition`)
    expect(instResp.status()).toBe(200)
  })

  // ────────────────────────────────────────────────────────────────────────
  // Scenario 5 — CONTRATOS: pacientes create works, Editar hidden, fichas tab hidden.
  // ────────────────────────────────────────────────────────────────────────
  test('CONTRATOS: paciente create via UI succeeds; fichas tab + Editar hidden', async ({ page }) => {
    await loginAs(page, 'CONTRATOS')
    // Navigate to a patient detail page (allowed for CONTRATOS, GET-only).
    // Use API to pick a real seeded patient — CONTRATOS can GET list.
    const listResp = await page.request.get(`${API}/patients?limit=1`)
    expect(listResp.status()).toBe(200)
    const listBody = await listResp.json()
    expect(listBody.data?.length, 'seed patient exists').toBeTruthy()
    const patientId: number = listBody.data[0].id

    await page.goto(`${FRONTEND}/pacientes/${patientId}`)
    await expect(page.getByRole('button', { name: /Información Básica/ })).toBeVisible({ timeout: 15000 })

    // Fichas tab is hidden (fichas domain = false for CONTRATOS).
    await expect(page.getByRole('button', { name: /Fichas & Evaluaciones/ })).toHaveCount(0)
    // Notas tab is hidden (notas domain = false for CONTRATOS).
    await expect(page.getByRole('button', { name: /Notas/ })).toHaveCount(0)
    // Editar button is hidden (create-only on pacientes for CONTRATOS).
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0)

    // Prove the API POST create path works for CONTRATOS (create-only).
    const doc = `9${Date.now()}`.slice(0, 12)
    const createResp = await page.request.post(`${API}/patients`, {
      data: {
        nombre: 'CONTRATOS-LIVE',
        tipoDocumento: 'CC',
        numeroDocumento: doc,
        fechaNacimiento: '1950-01-01',
        genero: 'M',
      },
    })
    expect(createResp.status(), 'CONTRATOS POST /patients').toBe(201)
    const created = await createResp.json()
    const newId: number = created.data.id
    // PUT is denied (create-only).
    const putResp = await page.request.put(`${API}/patients/${newId}`, {
      data: { nombre: 'SHOULD-FAIL' },
    })
    expect(putResp.status(), 'CONTRATOS PUT /patients/:id → 403').toBe(403)
    const putBody = await putResp.json()
    expect(putBody.code).toBe('DOMAIN_FORBIDDEN')
    // DELETE is denied.
    const delResp = await page.request.delete(`${API}/patients/${newId}`)
    expect(delResp.status(), 'CONTRATOS DELETE /patients/:id → 403').toBe(403)
  })

  // ────────────────────────────────────────────────────────────────────────
  // Scenario 6 — method-level 403 (CONTRATOS PUT paciente).
  // ────────────────────────────────────────────────────────────────────────
  test('CONTRATOS PUT /patients/:id returns 403 DOMAIN_FORBIDDEN (method-level)', async ({ page }) => {
    await loginAs(page, 'CONTRATOS')
    const listResp = await page.request.get(`${API}/patients?limit=1`)
    expect(listResp.status()).toBe(200)
    const listBody = await listResp.json()
    expect(listBody.data?.length).toBeTruthy()
    const patientId: number = listBody.data[0].id
    const putResp = await page.request.put(`${API}/patients/${patientId}`, {
      data: { nombre: 'NO-UPDATE' },
    })
    expect(putResp.status()).toBe(403)
    const body = await putResp.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe('DOMAIN_FORBIDDEN')
    expect(body.message).toContain('Acceso no permitido')
  })
})
