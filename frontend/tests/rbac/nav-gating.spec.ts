/**
 * nav-gating.spec.ts — RBAC frontend enforcement smoke (contract-fixes-jul17-2
 * §1.2 matrix / §1.5). Task #34 (W10).
 *
 * ── MOCKED ─────────────────────────────────────────────────────────────────
 * The session profile is MOCKED via Playwright route interception of the auth
 * endpoints (`/auth/me`, `/empresa`) and the data endpoints the exercised pages
 * touch (`/patients/:id`, `/instruments`). No backend login is performed here
 * because W9's 3 QA users (qa-gerontologa / qa-contratos / qa-admin) may not be
 * seeded yet. When W9 is live, QA (W11) re-runs the same assertions against the
 * real dev users to confirm parity — see completion-report.md "mocked-vs-live".
 *
 * What is REAL: the composable matrix, sidebar filter, route middleware and the
 * pacientes-detail tab gating all run as shipped; only the session source is
 * stubbed.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test rbac/nav-gating.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

type Profile = { rol: string; tipoEmpleado: 'GERONTOLOGA' | 'CONTRATOS' | null }

const PATIENT = {
  id: 1,
  nombre: 'Paciente Prueba',
  estado: 'ACTIVO',
  tipoDocumento: 'CC',
  numeroDocumento: '123456',
  fechaNacimiento: '1950-01-01',
  genero: 'Femenino',
  telefono: null,
  email: null,
  direccion: null,
  registrosFichas: [],
  notasCliente: [],
}

/**
 * Install route stubs that make the SPA believe it is logged in as `profile`.
 * Marked MOCKED — see file header.
 */
async function mockSession(page: Page, profile: Profile) {
  const user = {
    id: 99,
    email: 'qa@miempresa.com',
    nombre: 'QA',
    apellido: 'User',
    rol: profile.rol,
    tipoEmpleado: profile.tipoEmpleado,
    activo: true,
  }
  // Catch-all FIRST so any unmocked endpoint (dashboard widgets, etc.) returns
  // 200 instead of a real 401 — a stray 401 trips the session-expired plugin
  // and redirects to /login. Playwright uses last-registered-wins, so the
  // specific routes below override this generic one.
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user }) }),
  )
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user }) }),
  )
  await page.route('**/api/v1/empresa', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) }),
  )
  await page.route('**/api/v1/patients/1', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: PATIENT }) }),
  )
  await page.route('**/api/v1/instruments**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], total: 0 }) }),
  )
}

function navLink(page: Page, label: string) {
  // NuxtLink <a> in dev doesn't always expose the implicit link role, so match
  // the rendered label text within the sidebar nav (exact).
  return page.locator('aside nav').getByText(label, { exact: true })
}

test.describe('RBAC nav gating (§1.5) — MOCKED session', () => {
  test('GERONTOLOGA: pacientes + instrumentos visible; empleados/nomina/certificados/empresa/asistencia hidden', async ({ page }) => {
    await mockSession(page, { rol: 'EMPLEADO', tipoEmpleado: 'GERONTOLOGA' })
    await page.goto(`${FRONTEND}/`)
    await navLink(page, 'Inicio').waitFor({ state: 'attached', timeout: 10000 })

    await expect(navLink(page, 'Inicio')).toHaveCount(1)
    await expect(navLink(page, 'Pacientes')).toHaveCount(1)
    await expect(navLink(page, 'Instrumentos')).toHaveCount(1)
    // Forbidden for GERONTOLOGA:
    await expect(navLink(page, 'Empleados')).toHaveCount(0)
    await expect(navLink(page, 'Asistencia')).toHaveCount(0)
    await expect(navLink(page, 'Nomina')).toHaveCount(0)
    await expect(navLink(page, 'Certificados')).toHaveCount(0)
    await expect(navLink(page, 'Empresa')).toHaveCount(0)
  })

  test('CONTRATOS: empleados/asistencia/nomina/certificados/pacientes visible; instrumentos/empresa hidden', async ({ page }) => {
    await mockSession(page, { rol: 'EMPLEADO', tipoEmpleado: 'CONTRATOS' })
    await page.goto(`${FRONTEND}/`)
    await navLink(page, 'Inicio').waitFor({ state: 'attached', timeout: 10000 })

    await expect(navLink(page, 'Inicio')).toHaveCount(1)
    await expect(navLink(page, 'Empleados')).toHaveCount(1)
    await expect(navLink(page, 'Asistencia')).toHaveCount(1) // nomina-asistencia-jul-18 domain
    await expect(navLink(page, 'Pacientes')).toHaveCount(1) // create-only still navigable
    await expect(navLink(page, 'Certificados')).toHaveCount(1)
    await expect(navLink(page, 'Nomina')).toHaveCount(1)
    // Forbidden for CONTRATOS:
    await expect(navLink(page, 'Instrumentos')).toHaveCount(0)
    await expect(navLink(page, 'Empresa')).toHaveCount(0)
  })

  test('ADMIN (legacy null): every section visible incl. Empresa + Asistencia', async ({ page }) => {
    await mockSession(page, { rol: 'ADMIN', tipoEmpleado: null })
    await page.goto(`${FRONTEND}/`)
    await navLink(page, 'Inicio').waitFor({ state: 'attached', timeout: 10000 })

    for (const label of ['Inicio', 'Empleados', 'Asistencia', 'Pacientes', 'Instrumentos', 'Certificados', 'Nomina', 'Empresa']) {
      await expect(navLink(page, label), `${label} visible for ADMIN`).toHaveCount(1)
    }
  })

  test('CONTRATOS: forbidden route /instrumentos redirects to / with access-denied toast', async ({ page }) => {
    await mockSession(page, { rol: 'EMPLEADO', tipoEmpleado: 'CONTRATOS' })
    await page.goto(`${FRONTEND}/instrumentos`)
    // Middleware redirects to home.
    await page.waitForURL(`${FRONTEND}/`, { timeout: 10000 })
    expect(new URL(page.url()).pathname).toBe('/')
    // Toast (PrimeVue) or fallback banner both render this text.
    await expect(page.getByText('Acceso no permitido').first()).toBeVisible({ timeout: 5000 })
  })

  test('fichas tab: visible for GERONTOLOGA, hidden for CONTRATOS on pacientes detail', async ({ page }) => {
    // GERONTOLOGA sees the Fichas & Evaluaciones tab.
    await mockSession(page, { rol: 'EMPLEADO', tipoEmpleado: 'GERONTOLOGA' })
    await page.goto(`${FRONTEND}/pacientes/1`)
    await expect(page.getByRole('button', { name: /Fichas & Evaluaciones/ })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /Notas/ })).toBeVisible()

    // CONTRATOS: fichas domain false, notas domain false → tabs hidden.
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
    await mockSession(page, { rol: 'EMPLEADO', tipoEmpleado: 'CONTRATOS' })
    await page.goto(`${FRONTEND}/pacientes/1`)
    await expect(page.getByRole('button', { name: /Información Básica/ })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /Fichas & Evaluaciones/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Notas/ })).toHaveCount(0)
    // create-only → Editar action hidden.
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  })
})
