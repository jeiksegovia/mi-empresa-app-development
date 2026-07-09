import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;
let testPatientId: number;
let testInstrumentId: number;
// Version string required by the POST /fichas endpoint
const VERSION_REGISTRO = 'v1.0';

// Ficha IDs created during tests
let fichaId: number;
let fichaId2: number;
let fichaId3: number;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()['set-cookie'];
  expect(setCookie).toBeDefined();
  const match = setCookie.match(/session=([^;]+)/);
  expect(match).toBeTruthy();
  return setCookie;
}

test.describe.configure({ mode: 'serial' });

test.describe('Patient Fichas API', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);

    // Grab first ACTIVO patient
    const patRes = await request.get(`${API_BASE}/api/v1/patients?estado=ACTIVO&limit=1`, {
      headers: { Cookie: sessionCookie },
    });
    if (patRes.status() === 200) {
      const patBody = await patRes.json();
      if (patBody.data && patBody.data.length > 0) {
        testPatientId = patBody.data[0].id;
      }
    }

    // Grab first available instrument
    const instRes = await request.get(`${API_BASE}/api/v1/instruments?limit=1`, {
      headers: { Cookie: sessionCookie },
    });
    if (instRes.status() === 200) {
      const instBody = await instRes.json();
      if (instBody.data && instBody.data.length > 0) {
        testInstrumentId = instBody.data[0].id;
      }
    }
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup of any remaining fichas in PENDIENTE state
    for (const id of [fichaId, fichaId2, fichaId3]) {
      if (id && testPatientId) {
        await request.delete(
          `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${id}`,
          { headers: { Cookie: sessionCookie } },
        ).catch(() => {});
      }
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    });
  });

  // -----------------------------------------------------------------------
  test.describe('POST /api/v1/patients/:id/fichas - Create ficha', () => {
    test('should skip all ficha tests when no patient or instrument found', async () => {
      if (!testPatientId || !testInstrumentId) {
        test.skip();
      }
    });

    test('should create a ficha in PENDIENTE state (fichaId)', async ({ request }) => {
      if (!testPatientId || !testInstrumentId) { test.skip(); return; }
      const response = await request.post(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            instrumentoId: testInstrumentId,
            versionRegistro: VERSION_REGISTRO,
          },
        },
      );
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('estado', 'PENDIENTE');
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('instrumento');
      fichaId = body.data.id;
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PATCH /api/v1/patients/:id/fichas/:fichaId/status - Update ficha status', () => {
    test('should transition fichaId from PENDIENTE to VENCIDO', async ({ request }) => {
      if (!testPatientId || !fichaId) { test.skip(); return; }
      const response = await request.patch(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId}/status`,
        {
          headers: { Cookie: sessionCookie },
          data: { estado: 'VENCIDO' },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data.estado).toBe('VENCIDO');
    });

    test('should create a second ficha (fichaId2)', async ({ request }) => {
      if (!testPatientId || !testInstrumentId) { test.skip(); return; }
      const response = await request.post(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            instrumentoId: testInstrumentId,
            versionRegistro: VERSION_REGISTRO,
          },
        },
      );
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.estado).toBe('PENDIENTE');
      fichaId2 = body.data.id;
    });

    test('should return 400 when transitioning fichaId2 to COMPLETADO without archivoCompletado', async ({ request }) => {
      if (!testPatientId || !fichaId2) { test.skip(); return; }
      const response = await request.patch(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId2}/status`,
        {
          headers: { Cookie: sessionCookie },
          data: { estado: 'COMPLETADO' },
        },
      );
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.message).toContain('archivoCompletado');
    });

    test('should transition fichaId2 to COMPLETADO with archivoCompletado', async ({ request }) => {
      if (!testPatientId || !fichaId2) { test.skip(); return; }
      const response = await request.patch(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId2}/status`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            estado: 'COMPLETADO',
            archivoCompletado: 'test/file.pdf',
          },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data.estado).toBe('COMPLETADO');
      expect(body.data.archivoCompletado).toBe('test/file.pdf');
    });

    test('should return 400 when trying to transition fichaId from VENCIDO (terminal state)', async ({ request }) => {
      if (!testPatientId || !fichaId) { test.skip(); return; }
      const response = await request.patch(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId}/status`,
        {
          headers: { Cookie: sessionCookie },
          data: { estado: 'PENDIENTE' },
        },
      );
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('success', false);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('DELETE /api/v1/patients/:id/fichas/:fichaId - Delete ficha', () => {
    test('should create a third ficha (fichaId3) in PENDIENTE state', async ({ request }) => {
      if (!testPatientId || !testInstrumentId) { test.skip(); return; }
      const response = await request.post(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            instrumentoId: testInstrumentId,
            versionRegistro: VERSION_REGISTRO,
          },
        },
      );
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.estado).toBe('PENDIENTE');
      fichaId3 = body.data.id;
    });

    test('should delete fichaId3 (PENDIENTE state)', async ({ request }) => {
      if (!testPatientId || !fichaId3) { test.skip(); return; }
      const response = await request.delete(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId3}`,
        { headers: { Cookie: sessionCookie } },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      // Mark as cleaned up
      fichaId3 = 0;
    });

    test('should return 400 when trying to delete fichaId2 (already COMPLETADO)', async ({ request }) => {
      if (!testPatientId || !fichaId2) { test.skip(); return; }
      const response = await request.delete(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId2}`,
        { headers: { Cookie: sessionCookie } },
      );
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.message).toContain('PENDIENTE');
    });
  });
});
