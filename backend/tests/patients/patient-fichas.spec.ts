import { test, expect } from '@playwright/test';

/**
 * Patient Fichas API — W5 modernized version.
 *
 * The original spec (pre-W5) asserted on the file-flow contract:
 * `archivoCompletado`, `singleStepCompleted`, PATCH .../status → COMPLETADO.
 * Those fields are REMOVED (contract §3.3) and the PATCH /status endpoint
 * no longer accepts `archivoCompletado` to flip a ficha to COMPLETADO.
 *
 * Per contract §4.3 + §4.3b, the modernized flow is:
 *   1. POST /patients/:id/fichas without respuestas → PENDIENTE (legacy
 *      assign path — UNCHANGED).
 *   2. PATCH /patients/:id/fichas/:fichaId/completar with respuestas →
 *      COMPLETADO (single-step scoring + persistence).
 *   3. PATCH /patients/:id/fichas/:fichaId/status still handles
 *      PENDIENTE ↔ VENCIDO (no longer accepts → COMPLETADO with file).
 *
 * Cases that are now meaningless under the answers-based contract
 * (e.g., "should transition fichaId2 to COMPLETADO with archivoCompletado")
 * were DELETED with a one-line justification in the gap-report.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

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

function barthelMaxAnswer(): Record<string, string> {
  return {
    comida: 'independiente',
    lavado: 'independiente',
    vestido: 'independiente',
    arreglo: 'independiente',
    deposicion: 'continente',
    miccion: 'continente',
    retrete: 'independiente',
    transferencia: 'independiente',
    deambulacion: 'independiente',
    desniveles: 'independiente',
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Patient Fichas API (W5 modernized)', () => {
  let sessionCookie: string;
  let testPatientId: number;
  // Always a dynamic instrument that has an activeVersion (avoid legacy
  // placeholders FVM-001 / NUT-001 / ADM-001 which return NO_ACTIVE_VERSION).
  let dynamicInstrumentId: number;
  let createdPatient = false;

  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);

    // Grab or create a patient.
    const patRes = await request.get(`${API_BASE}/api/v1/patients?limit=1`, {
      headers: { Cookie: sessionCookie },
    });
    const patBody = await patRes.json();
    if (patBody.data && patBody.data.length > 0) {
      testPatientId = patBody.data[0].id;
    } else {
      const uniq = `W5PF-${Date.now()}`;
      const created = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: `W5 PF PATIENT`,
          tipoDocumento: 'CC',
          numeroDocumento: uniq,
          genero: 'FEMENINO',
          fechaNacimiento: '1990-01-01',
        },
      });
      testPatientId = (await created.json()).data.id;
      createdPatient = true;
    }

    // Grab a dynamic instrument that has an activeVersion (BARTHEL).
    const instRes = await request.get(
      `${API_BASE}/api/v1/instruments?estado=ACTIVO&limit=100`,
      { headers: { Cookie: sessionCookie } },
    );
    const instBody = await instRes.json();
    const barthel = instBody.data.find((r: any) => r.codigo === 'BARTHEL');
    expect(barthel, 'BARTHEL must be seeded').toBeTruthy();
    expect(barthel.activeVersion, 'BARTHEL must have an activeVersion').toBeTruthy();
    dynamicInstrumentId = barthel.id;
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
    if (createdPatient && testPatientId) {
      await request
        .delete(`${API_BASE}/api/v1/patients/${testPatientId}`, {
          headers: { Cookie: sessionCookie },
        })
        .catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    }).catch(() => {});
  });

  // -----------------------------------------------------------------------
  test.describe('POST /api/v1/patients/:id/fichas - Create ficha', () => {
    test('should create a ficha in PENDIENTE state (fichaId)', async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            instrumentoId: dynamicInstrumentId,
            versionRegistro: 'v1.0',
          },
        },
      );
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('estado', 'PENDIENTE');
      expect(body.data).toHaveProperty('id');
      // Contract §4.3 response shape: numeric instrumentoId (no nested
      // instrumento object on the create response — that's only on the
      // GET detail endpoint §4.4).
      expect(body.data).toHaveProperty('instrumentoId', dynamicInstrumentId);
      expect(body.data).toHaveProperty('instrumentoVersionId');
      expect(body.data).toHaveProperty('responsable');
      // Removed fields must NOT be on the response.
      expect(body.data).not.toHaveProperty('archivoCompletado');
      expect(body.data).not.toHaveProperty('singleStepCompleted');
      fichaId = body.data.id;
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PATCH /api/v1/patients/:id/fichas/:fichaId/completar - Complete with answers', () => {
    // MODERNIZED: PATCH .../completar (new endpoint, contract §4.3b)
    // accepts `respuestas` and completes the ficha atomically with
    // server-side scoring. The legacy file-flow PATCH .../status → COMPLETADO
    // path was REMOVED.
    test('should complete fichaId via PATCH /completar with respuestas', async ({ request }) => {
      const response = await request.patch(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId}/completar`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            respuestas: barthelMaxAnswer(),
          },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data.estado).toBe('COMPLETADO');
      expect(body.data.puntajeTotal).toBe(100);
      expect(body.data.clasificacion).toBe('Dependencia ligera');
      expect(body.data.subtotales.abvd).toBe(100);
    });

    test('should return 400 INVALID_STATE when completing already-COMPLETADO ficha', async ({ request }) => {
      const response = await request.patch(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId}/completar`,
        {
          headers: { Cookie: sessionCookie },
          data: { respuestas: barthelMaxAnswer() },
        },
      );
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('INVALID_STATE');
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PATCH /api/v1/patients/:id/fichas/:fichaId/status - non-completar transitions', () => {
    // The status endpoint still handles PENDIENTE ↔ VENCIDO. → COMPLETADO
    // is now routed via /completar instead.
    test('should create a second ficha (fichaId2) for VENCIDO transition test', async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            instrumentoId: dynamicInstrumentId,
            versionRegistro: 'v1.0',
          },
        },
      );
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.estado).toBe('PENDIENTE');
      fichaId2 = body.data.id;
    });

    test('should transition fichaId2 from PENDIENTE to VENCIDO via /status', async ({ request }) => {
      const response = await request.patch(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId2}/status`,
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
  });

  // -----------------------------------------------------------------------
  test.describe('DELETE /api/v1/patients/:id/fichas/:fichaId - Delete ficha', () => {
    test('should create a third ficha (fichaId3) in PENDIENTE state', async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            instrumentoId: dynamicInstrumentId,
            versionRegistro: 'v1.0',
          },
        },
      );
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.estado).toBe('PENDIENTE');
      fichaId3 = body.data.id;
    });

    test('should delete fichaId3 (PENDIENTE state)', async ({ request }) => {
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

    test('should return 400 when trying to delete fichaId2 (already VENCIDO)', async ({ request }) => {
      const response = await request.delete(
        `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fichaId2}`,
        { headers: { Cookie: sessionCookie } },
      );
      // Per the new contract, delete is allowed only for PENDIENTE.
      // fichaId2 was transitioned to VENCIDO above → expect 400.
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('success', false);
      expect(body.message).toContain('PENDIENTE');
    });
  });
});
