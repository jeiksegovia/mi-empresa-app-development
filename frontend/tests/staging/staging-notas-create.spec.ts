import { test, expect } from '@playwright/test'
import { recentBusinessDay } from '../helpers/upload-persistence'

/**
 * STAGING coverage — pacientes nota create (W10 item 4; closes S2 "nueva nota
 * → nothing happens"). No file involved: this is the S3-independent surface the
 * staging suite never covered.
 *
 * Asserts BOTH halves of the contract that S2 exposed:
 *   (a) HAPPY PATH: a valid nota (fechaIncidente within the last 2 business
 *       days) → 201 and is present after reload.
 *   (b) SURFACED FAILURE: a nota with an out-of-window fechaIncidente → 400 with
 *       field:'fechaIncidente' (the non-200 the UI must surface instead of a
 *       silent spinner).
 *
 * ENV: TEST_API_URL (defaults staging), QA_USER_EMAIL, QA_USER_PASSWORD.
 * LOCAL GREEN: TEST_API_URL=http://localhost:3101/api/v1 QA creds=admin.
 */

const QA_EMAIL = process.env.QA_USER_EMAIL || 'admin@miempresa.com'
const QA_PASSWORD = process.env.QA_USER_PASSWORD || 'password123'
const API_BASE = process.env.TEST_API_URL || 'https://miempresa-api-stg.disruptiveexp.com/api/v1'

test('nota create: valid nota persists; out-of-window fecha returns a surfaced 400', async ({ page }) => {
  const login = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email: QA_EMAIL, password: QA_PASSWORD },
  })
  expect(login.status(), `login failed at ${API_BASE}`).toBe(200)
  const req = page.request

  const uniq = `W13-NOTA-${Date.now()}`
  const created = await req.post(`${API_BASE}/patients`, {
    data: {
      nombre: 'QA Nota',
      tipoDocumento: 'CC',
      numeroDocumento: uniq,
      fechaNacimiento: '1975-03-03',
      genero: 'FEMENINO',
    },
  })
  expect(created.status(), `POST /patients failed: ${await created.text()}`).toBe(201)
  const patientId = (await created.json()).data.id

  try {
    // (a) happy path — valid business-day fechaIncidente
    const contenido = `w13 nota ${uniq}`
    const ok = await req.post(`${API_BASE}/patients/${patientId}/notes`, {
      data: {
        tipo: 'NEUTRAL',
        prioridad: 'BAJA',
        contenido,
        fechaIncidente: recentBusinessDay(),
      },
    })
    expect(ok.status(), `valid nota create failed: ${await ok.text()}`).toBe(201)

    // reload → the nota is present
    const reload = await req.get(`${API_BASE}/patients/${patientId}`)
    expect(reload.status()).toBe(200)
    const notas = (await reload.json()).data?.notasCliente ?? []
    expect(
      notas.some((n: any) => n.contenido === contenido),
      'nota not present after reload — create did not persist (S2)',
    ).toBe(true)

    // (b) surfaced failure — out-of-window fecha must 400 (not silent)
    const bad = await req.post(`${API_BASE}/patients/${patientId}/notes`, {
      data: {
        tipo: 'NEUTRAL',
        prioridad: 'BAJA',
        contenido: `${contenido} OLD`,
        fechaIncidente: '2020-01-01',
      },
    })
    expect(bad.status(), 'stale fechaIncidente should be rejected with 400').toBe(400)
    const body = await bad.json()
    expect(body.field, 'the 400 must name fechaIncidente so the UI can surface it inline').toBe('fechaIncidente')
  } finally {
    await req.delete(`${API_BASE}/patients/${patientId}`).catch(() => {})
  }
})
