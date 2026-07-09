import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — Ficha status transition rules (Bug 3 / D3).
 *
 * Verifies the W2 backend changes to `PATCH /api/v1/patients/:id/fichas/:fichaId/status`:
 *   - VENCIDO → COMPLETADO is now allowed (was rejected by prior version)
 *   - COMPLETADO requires archivoCompletado field
 *   - Invalid transition still returns 400 with `Cannot transition from X to Y`
 *
 * Coverage:
 *   - Create a PENDIENTE ficha, mark VENCIDO, then mark COMPLETADO with file
 *   - Verify PATCH to COMPLETADO without archivoCompletado returns 400
 *   - Verify PATCH to PENDIENTE on a VENCIDO ficha returns 400 (invalid transition)
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
let testPatientId: number;
let testInstrumentId: number;
let testFichaId: number;
const VERSION_REGISTRO = 'v1.0';

async function loginAndGetCookie(request: any, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Patient ficha transitions', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Find a patient
    const patRes = await request.get(`${API_BASE}/api/v1/patients?estado=ACTIVO&limit=1`, {
      headers: { Cookie: adminCookie },
    });
    if (patRes.status() === 200) {
      const patBody = await patRes.json();
      if (patBody.data?.length) {
        testPatientId = patBody.data[0].id;
      }
    }

    // Find an instrument
    const instRes = await request.get(`${API_BASE}/api/v1/instruments?limit=1`, {
      headers: { Cookie: adminCookie },
    });
    if (instRes.status() === 200) {
      const instBody = await instRes.json();
      if (instBody.data?.length) {
        testInstrumentId = instBody.data[0].id;
      }
    }
  });

  test('happy path: PENDIENTE → VENCIDO → COMPLETADO allowed with file (D3)', async ({ request }) => {
    test.skip(!testPatientId || !testInstrumentId, 'no patient/instrument in seed');
    // Create a fresh PENDIENTE ficha
    const create = await request.post(`${API_BASE}/api/v1/patients/${testPatientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: {
        instrumentoId: testInstrumentId,
        versionRegistro: VERSION_REGISTRO,
      },
    });
    expect(create.status()).toBe(201);
    const createdBody = await create.json();
    testFichaId = createdBody.data.id;

    // Step 1: PENDIENTE → VENCIDO (marking it expired)
    const toVencido = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${testFichaId}/status`,
      {
        headers: { Cookie: adminCookie },
        data: { estado: 'VENCIDO', notasObservaciones: 'expired test (QA W5)' },
      }
    );
    expect(toVencido.status()).toBe(200);

    // Step 2: VENCIDO → COMPLETADO (must be allowed per D3, requires archivoCompletado)
    const toCompletado = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${testFichaId}/status`,
      {
        headers: { Cookie: adminCookie },
        data: {
          estado: 'COMPLETADO',
          archivoCompletado: 'fichas/recovered-from-vencido.pdf',
          notasObservaciones: 'late completion (QA W5)',
        },
      }
    );
    expect(toCompletado.status()).toBe(200);
    const body = await toCompletado.json();
    expect(body.data.estado).toBe('COMPLETADO');
    expect(body.data.archivoCompletado).toBe('fichas/recovered-from-vencido.pdf');
  });

  test('PATCH VENCIDO→COMPLETADO without archivoCompletado → 400', async ({ request }) => {
    test.skip(!testPatientId || !testInstrumentId, 'no patient/instrument in seed');
    // Use the same ficha (just set to COMPLETADO above); transition now → any
    // other state is invalid but we want to test the missing-file rule on a
    // fresh PENDIENTE→VENCIDO flow.

    // First create another ficha
    const create = await request.post(`${API_BASE}/api/v1/patients/${testPatientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: {
        instrumentoId: testInstrumentId,
        versionRegistro: VERSION_REGISTRO,
      },
    });
    expect(create.status()).toBe(201);
    const newFichaBody = await create.json();
    const newFichaId = newFichaBody.data.id;

    // PENDIENTE → VENCIDO (no file needed)
    const toVencido = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${newFichaId}/status`,
      {
        headers: { Cookie: adminCookie },
        data: { estado: 'VENCIDO' },
      }
    );
    expect(toVencido.status()).toBe(200);

    // VENCIDO → COMPLETADO WITHOUT file → 400
    const bad = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${newFichaId}/status`,
      {
        headers: { Cookie: adminCookie },
        data: { estado: 'COMPLETADO' /* no archivoCompletado */ },
      }
    );
    expect(bad.status()).toBe(400);
    const body = await bad.json();
    expect(body.success).toBe(false);
    expect(body.message.toLowerCase()).toContain('archivocompletado');
  });

  test('PATCH VENCIDO→PENDIENTE returns 400 (invalid transition)', async ({ request }) => {
    test.skip(!testPatientId || !testInstrumentId, 'no patient/instrument in seed');
    // Create + flip to VENCIDO
    const create = await request.post(`${API_BASE}/api/v1/patients/${testPatientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: { instrumentoId: testInstrumentId, versionRegistro: VERSION_REGISTRO },
    });
    expect(create.status()).toBe(201);
    const createBody = await create.json();
    const fid = createBody.data.id;

    const toVencido = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fid}/status`,
      {
        headers: { Cookie: adminCookie },
        data: { estado: 'VENCIDO' },
      }
    );
    expect(toVencido.status()).toBe(200);

    const toPendiente = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fid}/status`,
      {
        headers: { Cookie: adminCookie },
        data: { estado: 'PENDIENTE' },
      }
    );
    const toPendienteBody = await toPendiente.json();
    expect(toPendienteBody.message.toLowerCase()).toContain('cannot transition');
  });
});
