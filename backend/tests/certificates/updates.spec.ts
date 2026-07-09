import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — Certificate update (history) endpoints.
 *
 * Verifies the W2 deliverables:
 *   - POST /api/v1/certificates/:id/updates — append a CertificadoUpdate row,
 *     mutate parent snapshot, recompute estado.
 *   - GET /api/v1/certificates/:id/updates — list newest-first.
 *
 * Coverage:
 *   - Happy path POST + GET roundtrip
 *   - Empty body is rejected with 400 (Zod refine)
 *   - Non-existent certificate ID returns 404
 *   - Missing/invalid auth returns 401
 *   -estado recomputed based on fechaVencimiento
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
let testCertId: number;

async function loginAndGetCookie(request: any, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Certificate Updates API (POST/GET /certificates/:id/updates)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Create a cert to attach updates to
    const uniq = `${Date.now()}`;
    const create = await request.post(`${API_BASE}/api/v1/certificates`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: `Cert Updates Test ${uniq}`,
        tipoCertificado: 'TRIBUTARIOS',
        periodicidad: 'UNICA',
      },
    });
    expect(create.status()).toBe(201);
    const body = await create.json();
    testCertId = body.data.id;
  });

  test.afterAll(async ({ request }) => {
    if (testCertId) {
      await request.delete(`${API_BASE}/api/v1/certificates/${testCertId}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
  });

  test('POST /certificates/:id/updates with notas + fechaVencimiento returns 201 and persists row', async ({ request }) => {
    const resp = await request.post(
      `${API_BASE}/api/v1/certificates/${testCertId}/updates`,
      {
        headers: { Cookie: adminCookie },
        data: {
          notas: 'QA W5 test — add notes',
          fechaVencimiento: '2030-12-31',
        },
      }
    );
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data.update.notas).toBe('QA W5 test — add notes');
    expect(body.data.update.certificadoId).toBe(testCertId);
    // Parent snapshot mutated to future date → estado recomputed to VIGENTE
    expect(body.data.certificate.estado).toBe('VIGENTE');
    expect(body.data.certificate.fechaVencimiento).toContain('2030-12-31');
  });

  test('GET /certificates/:id/updates returns the just-appended row newest-first', async ({ request }) => {
    const resp = await request.get(
      `${API_BASE}/api/v1/certificates/${testCertId}/updates`,
      { headers: { Cookie: adminCookie } }
    );
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    // First row is the most recent
    const first = body.data[0];
    expect(first.certificadoId).toBe(testCertId);
    expect(first.notas).toBe('QA W5 test — add notes');
  });

  test('POST with empty body → 400 with Zod refine error (no empty update rows)', async ({ request }) => {
    const resp = await request.post(
      `${API_BASE}/api/v1/certificates/${testCertId}/updates`,
      {
        headers: { Cookie: adminCookie },
        data: {}, // empty — must be rejected by .refine()
      }
    );
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    // error message includes the refine text
    const flat = JSON.stringify(body);
    expect(flat.toLowerCase()).toContain('at least one');
  });

  test('POST with non-existent certificate id → 404', async ({ request }) => {
    const resp = await request.post(
      `${API_BASE}/api/v1/certificates/999999999/updates`,
      {
        headers: { Cookie: adminCookie },
        data: { notas: 'phantom cert' },
      }
    );
    expect(resp.status()).toBe(404);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(body.message.toLowerCase()).toContain('not found');
  });

  test('POST without auth → 401', async ({ request }) => {
    const resp = await request.post(
      `${API_BASE}/api/v1/certificates/${testCertId}/updates`,
      {
        data: { notas: 'no auth' },
      }
    );
    expect(resp.status()).toBe(401);
  });

  test('POST with fechaVencimiento in the past → estado recomputed to VENCIDO', async ({ request }) => {
    const resp = await request.post(
      `${API_BASE}/api/v1/certificates/${testCertId}/updates`,
      {
        headers: { Cookie: adminCookie },
        data: {
          notas: 'past-dated update',
          fechaVencimiento: '2020-01-01',
        },
      }
    );
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.data.certificate.estado).toBe('VENCIDO');
  });
});
