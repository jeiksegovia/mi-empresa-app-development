import { test, expect } from '@playwright/test'
import { presignRoundtrip } from '../helpers/upload-persistence'

/**
 * STAGING coverage — fichas single-step update ROUND-TRIP (W10 item 4;
 * closes S1 "actualizar estado → spinner, nothing persists").
 *
 * Flow through the app's own endpoints:
 *   1. throwaway paciente + an ACTIVO instrumento
 *   2. presign → PUT the completed-evaluation file (asserts PUT 200)
 *   3. POST /patients/:id/fichas with archivoCompletado=<key> (single-step) →
 *      201, estado COMPLETADO, singleStepCompleted=true
 *   4. RELOAD via GET /patients/:id → the ficha persists as COMPLETADO
 *   5. the uploaded object is downloadable (GET 200)
 *   6. cleanup: soft-delete the paciente
 *
 * NOTE: GET /patients/:id maps registrosFichas WITHOUT archivoCompletado
 * (patientService.ts ~254), so persistence of the archivo key is asserted via
 * the POST response + a download round-trip, and record-persistence via the
 * reloaded COMPLETADO row.
 *
 * ENV: TEST_API_URL (defaults staging), QA_USER_EMAIL, QA_USER_PASSWORD.
 * LOCAL GREEN: TEST_API_URL=http://localhost:3101/api/v1 QA creds=admin.
 */

const QA_EMAIL = process.env.QA_USER_EMAIL || 'admin@miempresa.com'
const QA_PASSWORD = process.env.QA_USER_PASSWORD || 'password123'
const API_BASE = process.env.TEST_API_URL || 'https://miempresa-api-stg.disruptiveexp.com/api/v1'

test('ficha single-step: uploaded eval persists as COMPLETADO and downloads', async ({ page }) => {
  const login = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email: QA_EMAIL, password: QA_PASSWORD },
  })
  expect(login.status(), `login failed at ${API_BASE}`).toBe(200)
  const req = page.request

  const instRes = await req.get(`${API_BASE}/instruments?estado=ACTIVO&limit=1`)
  expect(instRes.status()).toBe(200)
  const instrument = (await instRes.json()).data?.[0]
  if (!instrument) {
    test.skip(true, 'no ACTIVO instrumento seeded on this stage')
    return
  }

  const uniq = `W13-FICHA-${Date.now()}`
  const created = await req.post(`${API_BASE}/patients`, {
    data: {
      nombre: 'QA Ficha Roundtrip',
      tipoDocumento: 'CC',
      numeroDocumento: uniq,
      fechaNacimiento: '1980-05-05',
      genero: 'FEMENINO',
    },
  })
  expect(created.status(), `POST /patients failed: ${await created.text()}`).toBe(201)
  const patientId = (await created.json()).data.id

  try {
    // real upload of the completed-eval file
    const { key, putStatus, downloadUrl, getStatus } = await presignRoundtrip(req, API_BASE, {
      folder: 'fichas',
      contentType: 'application/pdf',
      body: `%PDF-1.4 w13 ficha single-step ${uniq}`,
    })
    expect(putStatus, 'S3 PUT for the ficha file failed (born-expired creds?)').toBe(200)
    expect(getStatus, `ficha file did not download from ${downloadUrl}`).toBe(200)

    // single-step create with the uploaded key
    const post = await req.post(`${API_BASE}/patients/${patientId}/fichas`, {
      data: {
        instrumentoId: instrument.id,
        versionRegistro: 'v1',
        archivoCompletado: key,
        notasObservaciones: 'w13 fichas round-trip',
      },
    })
    expect(post.status(), `POST ficha failed: ${await post.text()}`).toBe(201)
    const ficha = (await post.json()).data
    expect(ficha.estado, 'single-step ficha should be COMPLETADO on create').toBe('COMPLETADO')
    expect(ficha.archivoCompletado, 'POST response should echo the persisted key').toBe(key)

    // RELOAD: the ficha record persists as COMPLETADO
    const reload = await req.get(`${API_BASE}/patients/${patientId}`)
    expect(reload.status()).toBe(200)
    const fichas = (await reload.json()).data?.registrosFichas ?? []
    const persisted = fichas.find((f: any) => f.id === ficha.id)
    expect(persisted, 'ficha row not present after reload — nothing persisted (S1)').toBeTruthy()
    expect(persisted.estado, 'ficha did not persist as COMPLETADO after reload').toBe('COMPLETADO')
  } finally {
    await req.delete(`${API_BASE}/patients/${patientId}`).catch(() => {})
  }
})
