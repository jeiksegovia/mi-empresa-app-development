import { test, expect } from '@playwright/test'

/**
 * QA jul-11 B4b regression: POST /certificates/:id/updates must propagate the
 * update's files to the PARENT snapshot so the detail page offers the latest
 * archivo + comprobante for download:
 *   - archivoUrl was already propagated,
 *   - comprobantePagoUrl was silently dropped (the bug).
 * Also asserts estado recompute (future fechaVencimiento → VIGENTE).
 */

const API_URL = `${process.env.TEST_API_URL || 'http://localhost:3101'}/api/v1`

function ymd(daysFromToday = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

test.describe.configure({ mode: 'serial' })

test.describe('jul-11 certificate update → parent snapshot propagation', () => {
  let cookieValue: string
  let certId: number

  const archivoKey = `certificados/jul11-prop-${Date.now()}.pdf`
  const comprobanteKey = `certificados/jul11-prop-comp-${Date.now()}.pdf`

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'admin@miempresa.com', password: 'password123' },
    })
    expect(loginRes.ok()).toBeTruthy()
    cookieValue = loginRes.headers()['set-cookie']!
  })

  test.afterAll(async ({ request }) => {
    if (certId) {
      await request.delete(`${API_URL}/certificates/${certId}`, {
        headers: { cookie: cookieValue },
      })
    }
  })

  test('create certificate WITHOUT files (QA flow: metadata-only create)', async ({ request }) => {
    const res = await request.post(`${API_URL}/certificates`, {
      headers: { cookie: cookieValue },
      data: {
        nombre: `JUL11 PROPAGATION ${Date.now()}`,
        tipoCertificado: 'OTRO',
        periodicidad: 'MENSUAL',
      },
    })
    expect(res.status()).toBe(201)
    const json = await res.json()
    certId = json.data.id
    expect(json.data.archivoUrl).toBeNull()
    expect(json.data.comprobantePagoUrl).toBeNull()
  })

  test('update with archivo + comprobante propagates BOTH to the parent snapshot', async ({ request }) => {
    const res = await request.post(`${API_URL}/certificates/${certId}/updates`, {
      headers: { cookie: cookieValue },
      data: {
        archivoUrl: archivoKey,
        comprobantePagoUrl: comprobanteKey,
        fechaVencimiento: ymd(30),
        notas: 'jul11 propagation regression',
      },
    })
    expect(res.status()).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    // The response's certificate is the mutated parent.
    expect(json.data.certificate.archivoUrl).toBe(archivoKey)
    expect(json.data.certificate.comprobantePagoUrl).toBe(comprobanteKey)
    expect(json.data.certificate.estado).toBe('VIGENTE')
  })

  test('GET /certificates/:id returns the propagated files (persisted, not just echoed)', async ({ request }) => {
    const res = await request.get(`${API_URL}/certificates/${certId}`, {
      headers: { cookie: cookieValue },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.archivoUrl).toBe(archivoKey)
    expect(json.data.comprobantePagoUrl).toBe(comprobanteKey)
    expect(String(json.data.fechaVencimiento).slice(0, 10)).toBe(ymd(30))
  })
})
