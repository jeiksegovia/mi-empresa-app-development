import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — nomina-asistencia-jul-18: Asistencia day board + batch PUT + resumen.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
const TEST_FECHA = '2099-03-15';
const TEST_PERIODO = '2099-03';

let adminCookie: string;
let empleadoId: number;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Asistencia dia / resumen (jul-18)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request);
    const list = await request.get(`${API_BASE}/api/v1/employees?limit=5&estado=ACTIVO`, {
      headers: { Cookie: adminCookie },
    });
    expect(list.status()).toBe(200);
    const body = await list.json();
    empleadoId = body.data?.[0]?.id;
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
  });

  test('GET /asistencia?fecha= returns active employees + flags', async ({ request }) => {
    test.skip(!empleadoId, 'No active employee');
    const resp = await request.get(`${API_BASE}/api/v1/asistencia?fecha=${TEST_FECHA}`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    const row = body.data.find((r: any) => r.empleadoId === empleadoId) ?? body.data[0];
    expect(row).toHaveProperty('jornadaAm');
    expect(row).toHaveProperty('jornadaPm');
    expect(row).toHaveProperty('empleado');
    expect(row.empleado).toHaveProperty('nombre');
  });

  test('PUT /asistencia/dia upserts AM/PM', async ({ request }) => {
    test.skip(!empleadoId, 'No active employee');
    const resp = await request.put(`${API_BASE}/api/v1/asistencia/dia`, {
      headers: { Cookie: adminCookie },
      data: {
        fecha: TEST_FECHA,
        items: [
          { empleadoId, jornadaAm: true, jornadaPm: true, notas: 'smoke test' },
        ],
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].jornadaAm).toBe(true);
    expect(body.data[0].jornadaPm).toBe(true);

    // Reload day board — flags persist
    const get = await request.get(`${API_BASE}/api/v1/asistencia?fecha=${TEST_FECHA}`, {
      headers: { Cookie: adminCookie },
    });
    const gBody = await get.json();
    const row = gBody.data.find((r: any) => r.empleadoId === empleadoId);
    expect(row.jornadaAm).toBe(true);
    expect(row.jornadaPm).toBe(true);
    expect(row.notas).toBe('smoke test');
  });

  test('GET /asistencia/resumen sums medias for month', async ({ request }) => {
    test.skip(!empleadoId, 'No active employee');
    const resp = await request.get(
      `${API_BASE}/api/v1/asistencia/resumen?periodo=${TEST_PERIODO}&empleadoId=${empleadoId}`,
      { headers: { Cookie: adminCookie } },
    );
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    const row = body.data.find((r: any) => r.empleadoId === empleadoId);
    expect(row).toBeTruthy();
    // AM+PM = 2 medias; horas = 8
    expect(row.mediasJornadas).toBeGreaterThanOrEqual(2);
    expect(row.horas).toBe(row.mediasJornadas * 4);
  });
});
