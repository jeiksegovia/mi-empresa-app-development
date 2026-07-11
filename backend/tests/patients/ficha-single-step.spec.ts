/**
 * LOCAL QA — jul-10 (W3 — T7): C1 single-step ficha.
 *
 * Reference: schema-contract-jul10.md §5.A — POST /api/v1/patients/:id/fichas
 * branches on `archivoCompletado` presence:
 *   - with archivoCompletado → atomic single-step: estado=COMPLETADO,
 *     fechaCompletado=now, singleStepCompleted=true
 *   - without archivoCompletado → legacy PENDIENTE flow, singleStepCompleted=false
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

test.describe.configure({ mode: 'serial' });

test.describe('Ficha single-step C1 (jul-10)', () => {
  let adminCookie: string;
  let patientId: number;
  let instrumentId: number;
  const createdFichaIds: number[] = [];
  let createdPatient = false;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    adminCookie = loginRes.headers()['set-cookie'];

    // Pick or create a patient
    const list = await request.get(`${API_BASE}/api/v1/patients?limit=1`, { headers: { Cookie: adminCookie } });
    const listBody = await list.json();
    if (listBody.data?.length > 0) {
      patientId = listBody.data[0].id;
    } else {
      const uniq = `C1PAT-${Date.now()}`;
      const created = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: adminCookie },
        data: {
          nombre: `C1 PATIENT`,
          tipoDocumento: 'CC',
          numeroDocumento: uniq,
          genero: 'FEMENINO',
          fechaNacimiento: '1990-01-01',
        },
      });
      patientId = (await created.json()).data.id;
      createdPatient = true;
    }

    // Pick an active instrument
    const instrRes = await request.get(`${API_BASE}/api/v1/instruments?estado=ACTIVO&limit=1`, {
      headers: { Cookie: adminCookie },
    });
    const instrBody = await instrRes.json();
    expect(instrBody.data?.length, 'need at least one ACTIVO instrument').toBeGreaterThan(0);
    instrumentId = instrBody.data[0].id;
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup of created fichas
    for (const id of createdFichaIds) {
      await request.delete(`${API_BASE}/api/v1/patients/${patientId}/fichas/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    if (createdPatient && patientId) {
      await request.delete(`${API_BASE}/api/v1/patients/${patientId}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: adminCookie } }).catch(() => {});
  });

  test('POST sin archivoCompletado → legacy PENDIENTE (singleStepCompleted=false)', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: { instrumentoId: instrumentId, versionRegistro: 'v1.0' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.estado).toBe('PENDIENTE');
    expect(body.data.singleStepCompleted).toBe(false);
    expect(body.data.fechaCompletado).toBeNull();
    expect(body.data.archivoCompletado).toBeNull();
    createdFichaIds.push(body.data.id);
  });

  test('POST con archivoCompletado → single-step COMPLETADO (singleStepCompleted=true)', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: {
        instrumentoId: instrumentId,
        versionRegistro: 'v1.0',
        archivoCompletado: `fichas/c1-atomic-${Date.now()}.pdf`,
        notasObservaciones: 'jul10 c1 single-step',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.estado).toBe('COMPLETADO');
    expect(body.data.singleStepCompleted).toBe(true);
    expect(body.data.fechaCompletado).toBeTruthy();
    expect(body.data.archivoCompletado).toMatch(/^fichas\/c1-atomic-/);
    // Round-trip via GET patient
    const get = await request.get(`${API_BASE}/api/v1/patients/${patientId}`, {
      headers: { Cookie: adminCookie },
    });
    expect(get.status()).toBe(200);
    const detail = (await get.json()).data;
    const found = detail.registrosFichas.find((r: any) => r.id === body.data.id);
    expect(found).toBeDefined();
    expect(found.estado).toBe('COMPLETADO');
  });
});
