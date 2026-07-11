/**
 * LOCAL QA — jul-10 (W3 — T4): D3 round-trip for `documentoIdentificacionUrl` on Empleado.
 *
 * Verifies PUT /api/v1/employees/:id accepts the field, persists it, and the
 * subsequent GET reflects it. Adds coverage for D3 implementation-only field.
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

test.describe.configure({ mode: 'serial' });

test.describe('Empleado documentoIdentificacionUrl (jul-10 D3)', () => {
  let sessionCookie: string;
  let testEmployeeId: number;
  let createdEmployee = false;
  const sentinelKey = `empleado-documentos/d3-roundtrip-${Date.now()}.pdf`;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    sessionCookie = loginRes.headers()['set-cookie'];

    // Pick or create an empleado to attach the doc URL to.
    const listRes = await request.get(`${API_BASE}/api/v1/employees?limit=1`, {
      headers: { Cookie: sessionCookie },
    });
    const listBody = await listRes.json();
    if (listBody.data?.length > 0) {
      testEmployeeId = listBody.data[0].id;
    } else {
      const uniq = `D3${Date.now()}`;
      const createRes = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'D3Doc', apellido: 'Test',
          tipoDocumento: 'CC', numeroDocumento: uniq,
          genero: 'MASCULINO', fechaNacimiento: '1990-01-01',
        },
      });
      testEmployeeId = (await createRes.json()).data.id;
      createdEmployee = true;
    }
  });

  test.afterAll(async ({ request }) => {
    if (createdEmployee && testEmployeeId) {
      await request.delete(`${API_BASE}/api/v1/employees/${testEmployeeId}`, {
        headers: { Cookie: sessionCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: sessionCookie } }).catch(() => {});
  });

  test('PUT + GET round-trip on documentoIdentificacionUrl → 200', async ({ request }) => {
    expect(testEmployeeId, 'empleado id').toBeTruthy();

    const putRes = await request.put(`${API_BASE}/api/v1/employees/${testEmployeeId}`, {
      headers: { Cookie: sessionCookie },
      data: { documentoIdentificacionUrl: sentinelKey },
    });
    expect(putRes.status()).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.data.documentoIdentificacionUrl).toBe(sentinelKey);

    const getRes = await request.get(`${API_BASE}/api/v1/employees/${testEmployeeId}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.data.documentoIdentificacionUrl).toBe(sentinelKey);
  });
});
