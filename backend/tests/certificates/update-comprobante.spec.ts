/**
 * LOCAL QA — jul-9 (W4 — T13): comprobantePagoUrl on CertificadoUpdate.
 *
 * Reference: `schema-contract-jul9.md` §1 (M1-A4) + §5.6 — additive nullable
 * `comprobantePagoUrl VARCHAR(500)` exposed on:
 *   POST /api/v1/certificates/:id/updates   (extend Zod to accept comprobante)
 *   GET  /api/v1/certificates/:id/updates   (response row includes comprobante)
 *
 * The Zod refine (§4.7 of service) requires at least one of:
 *   archivoUrl, comprobantePagoUrl, notas, fechaEmision, fechaVencimiento
 *
 * We test the happy path (a comprobante-only update is valid), and that
 * comprobante round-trips through POST → GET.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;
let testCertId: number;
let updateId: number;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('CertificadoUpdate comprobantePagoUrl (jul-9 M1-A4)', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);

    // Create a throwaway certificate for the tests
    const uniq = `${Date.now()}`;
    const createRes = await request.post(`${API_BASE}/api/v1/certificates`, {
      headers: { Cookie: sessionCookie },
      data: {
        nombre: `Cert Comprobante ${uniq}`,
        tipoCertificado: 'TRIBUTARIOS',
        periodicidad: 'UNICA',
      },
    });
    expect(createRes.status()).toBe(201);
    const body = await createRes.json();
    testCertId = body.data.id;
  });

  test.afterAll(async ({ request }) => {
    if (testCertId) {
      await request.delete(`${API_BASE}/api/v1/certificates/${testCertId}`, {
        headers: { Cookie: sessionCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    }).catch(() => {});
  });

  test('POST /certificates/:id/updates with comprobantePagoUrl only → 201', async ({ request }) => {
    if (!testCertId) { test.skip(); return; }
    const res = await request.post(`${API_BASE}/api/v1/certificates/${testCertId}/updates`, {
      headers: { Cookie: sessionCookie },
      data: {
        // No archivoUrl or other field — comprobante alone is enough for the refine
        comprobantePagoUrl: 'https://files.example.com/cert-updates/comprobante-qa.pdf',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.update.comprobantePagoUrl).toBe('https://files.example.com/cert-updates/comprobante-qa.pdf');
    expect(body.data.update.certificadoId).toBe(testCertId);
    updateId = body.data.update.id;
  });

  test('GET /certificates/:id/updates returns comprobantePagoUrl on the row', async ({ request }) => {
    if (!testCertId || !updateId) { test.skip(); return; }
    const res = await request.get(`${API_BASE}/api/v1/certificates/${testCertId}/updates`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const found = body.data.find((u: any) => u.id === updateId);
    expect(found).toBeDefined();
    expect(found.comprobantePagoUrl).toBe('https://files.example.com/cert-updates/comprobante-qa.pdf');
  });

  test('POST comprobante AND archivoUrl together is also valid', async ({ request }) => {
    if (!testCertId) { test.skip(); return; }
    const res = await request.post(`${API_BASE}/api/v1/certificates/${testCertId}/updates`, {
      headers: { Cookie: sessionCookie },
      data: {
        archivoUrl: 'https://files.example.com/cert-updates/archivo-qa.pdf',
        comprobantePagoUrl: 'https://files.example.com/cert-updates/comprobante-2.pdf',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.update.archivoUrl).toBe('https://files.example.com/cert-updates/archivo-qa.pdf');
    expect(body.data.update.comprobantePagoUrl).toBe('https://files.example.com/cert-updates/comprobante-2.pdf');
  });

  test('POST with neither comprobante nor other content → 400 (refine rejects empty)', async ({ request }) => {
    if (!testCertId) { test.skip(); return; }
    const res = await request.post(`${API_BASE}/api/v1/certificates/${testCertId}/updates`, {
      headers: { Cookie: sessionCookie },
      data: {},  // empty — must fail the Zod refine
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
