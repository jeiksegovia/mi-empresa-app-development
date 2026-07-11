import { test, expect } from '@playwright/test'
import { presignRoundtrip, assertUploadPersisted } from '../helpers/upload-persistence'

/**
 * STAGING coverage — empleado certificados upload ROUND-TRIP (W10 item 4;
 * closes S5 "cannot attach" + S7 "reload → file GONE").
 *
 * Flow, entirely through the app's own endpoints:
 *   1. create a throwaway empleado
 *   2. presign → PUT a cert file (asserts PUT 200 — the app never checks this)
 *   3. PUT /employees/:id/certificados persisting the uploaded key as archivoUrl
 *   4. RELOAD via GET /employees/:id → assert cert.archivoUrl non-null AND that
 *      the key downloads (GET 200) — the exact assertion missing in jul-5's
 *      HIGH-1 fix, which only checked the PUT.
 *   5. cleanup: DELETE the empleado (hard delete).
 *
 * ENV: TEST_API_URL (defaults to staging), QA_USER_EMAIL, QA_USER_PASSWORD.
 * LOCAL GREEN: TEST_API_URL=http://localhost:3101/api/v1 QA creds=admin.
 */

const QA_EMAIL = process.env.QA_USER_EMAIL || 'admin@miempresa.com'
const QA_PASSWORD = process.env.QA_USER_PASSWORD || 'password123'
const API_BASE = process.env.TEST_API_URL || 'https://miempresa-api-stg.disruptiveexp.com/api/v1'

test('empleado certificado: upload persists a downloadable key across reload', async ({ page }) => {
  const login = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email: QA_EMAIL, password: QA_PASSWORD },
  })
  expect(login.status(), `login failed at ${API_BASE}`).toBe(200)
  const req = page.request

  // 1) throwaway empleado
  const uniq = `W13-CERT-${Date.now()}`
  const created = await req.post(`${API_BASE}/employees`, {
    data: {
      nombre: 'QA',
      apellido: 'CertRoundtrip',
      tipoDocumento: 'CC',
      numeroDocumento: uniq,
      genero: 'MASCULINO',
      fechaNacimiento: '1990-01-01',
    },
  })
  expect(created.status(), `POST /employees failed: ${await created.text()}`).toBe(201)
  const empId = (await created.json()).data.id

  try {
    // 2) real upload through the app presign path (asserts PUT 200)
    const { key, putStatus } = await presignRoundtrip(req, API_BASE, {
      folder: 'certificados-empleado',
      contentType: 'application/pdf',
      body: `%PDF-1.4 w13 empleado cert ${uniq}`,
    })
    expect(putStatus, 'S3 PUT for the cert file failed (born-expired creds?)').toBe(200)

    // 3) persist the key onto the empleado's certificado
    const putCert = await req.put(`${API_BASE}/employees/${empId}/certificados`, {
      data: {
        certificados: [
          {
            tipo: 'OTRO',
            nombre: 'QA round-trip',
            fechaExpedicion: '2026-01-01',
            fechaVencimiento: '2027-01-01',
            archivoUrl: key,
          },
        ],
      },
    })
    expect(putCert.status(), `PUT certificados failed: ${await putCert.text()}`).toBe(200)

    // 4) RELOAD + assert the key persisted AND downloads (S7 guard)
    await assertUploadPersisted(req, API_BASE, {
      entityGetUrl: `${API_BASE}/employees/${empId}`,
      keyPath: (emp) => emp?.certificados?.[0]?.archivoUrl,
      label: 'empleado certificado',
    })
  } finally {
    await req.delete(`${API_BASE}/employees/${empId}`).catch(() => {})
  }
})
