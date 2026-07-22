import { test, expect } from '@playwright/test';

/**
 * EDGE — nomina-asistencia-jul-18: day board without contract + resumen horas + validation.
 *
 * Covers contract §4:
 * - GET day board includes ACTIVO employee with no contract (synthetic id:null when no row)
 * - medias = AM+PM; horas = medias * 4 exactly
 * - missing/invalid fecha → 400
 *
 * Run (from backend/):
 *   npx playwright test tests/asistencia/asistencia-edge.spec.ts --reporter=line
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
// Far-future isolated dates to avoid colliding with other suites
const FECHA_A = '2098-06-01';
const FECHA_B = '2098-06-02';
const PERIODO = '2098-06';

let adminCookie: string;
let noContractEmpleadoId: number;
const createdEmployeeIds: number[] = [];

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Asistencia edges (jul-18)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request);

    // Create ACTIVO employee WITHOUT contrato — day board must still list them
    const emp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'EDGE',
        apellido: 'NOCONTRATO',
        tipoDocumento: 'CC',
        numeroDocumento: `92${Date.now().toString().slice(-8)}`,
        genero: 'F',
        fechaNacimiento: '1992-02-02',
      },
    });
    expect(emp.status()).toBe(201);
    noContractEmpleadoId = (await emp.json()).data.id as number;
    createdEmployeeIds.push(noContractEmpleadoId);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdEmployeeIds) {
      await request
        .delete(`${API_BASE}/api/v1/employees/${id}`, {
          headers: { Cookie: adminCookie },
        })
        .catch(() => {});
    }
    await request
      .post(`${API_BASE}/api/v1/auth/logout`, {
        headers: { Cookie: adminCookie },
      })
      .catch(() => {});
  });

  test('GET day board includes ACTIVO employee without contract', async ({ request }) => {
    expect(noContractEmpleadoId).toBeTruthy();
    const resp = await request.get(`${API_BASE}/api/v1/asistencia?fecha=${FECHA_A}`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    const row = body.data.find((r: any) => r.empleadoId === noContractEmpleadoId);
    expect(row, 'employee without contract must appear on day board').toBeTruthy();
    expect(row.empleado?.id).toBe(noContractEmpleadoId);
    // No attendance row yet → synthetic defaults
    expect(row.id === null || row.id === undefined || typeof row.id === 'number').toBe(true);
    if (row.id == null) {
      expect(row.jornadaAm).toBe(false);
      expect(row.jornadaPm).toBe(false);
      expect(row.notas ?? null).toBeNull();
    }
  });

  test('resumen: medias from AM/PM; horas === medias * 4 exactly', async ({ request }) => {
    expect(noContractEmpleadoId).toBeTruthy();

    // Day A: AM only → 1 media
    const putA = await request.put(`${API_BASE}/api/v1/asistencia/dia`, {
      headers: { Cookie: adminCookie },
      data: {
        fecha: FECHA_A,
        items: [{ empleadoId: noContractEmpleadoId, jornadaAm: true, jornadaPm: false }],
      },
    });
    expect(putA.status()).toBe(200);

    // Day B: AM+PM → 2 medias
    const putB = await request.put(`${API_BASE}/api/v1/asistencia/dia`, {
      headers: { Cookie: adminCookie },
      data: {
        fecha: FECHA_B,
        items: [{ empleadoId: noContractEmpleadoId, jornadaAm: true, jornadaPm: true }],
      },
    });
    expect(putB.status()).toBe(200);

    const resp = await request.get(
      `${API_BASE}/api/v1/asistencia/resumen?periodo=${PERIODO}&empleadoId=${noContractEmpleadoId}`,
      { headers: { Cookie: adminCookie } },
    );
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const row = body.data.find((r: any) => r.empleadoId === noContractEmpleadoId);
    expect(row).toBeTruthy();
    expect(Number(row.mediasJornadas)).toBe(3);
    expect(Number(row.horas)).toBe(12); // 3 * 4
    expect(Number(row.horas)).toBe(Number(row.mediasJornadas) * 4);
  });

  test('GET /asistencia without fecha → 400', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/asistencia`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test('GET /asistencia with invalid fecha → 400', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/asistencia?fecha=not-a-date`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test('PUT /asistencia/dia empty items → 400', async ({ request }) => {
    const resp = await request.put(`${API_BASE}/api/v1/asistencia/dia`, {
      headers: { Cookie: adminCookie },
      data: { fecha: FECHA_A, items: [] },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test('synthetic id:null on day board when no attendance row', async ({ request }) => {
    // Fresh employee → guaranteed no attendance for FECHA_B+1
    const emp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'EDGE',
        apellido: 'SYNTH',
        tipoDocumento: 'CC',
        numeroDocumento: `94${Date.now().toString().slice(-8)}`,
        genero: 'M',
        fechaNacimiento: '1994-04-04',
      },
    });
    expect(emp.status()).toBe(201);
    const id = (await emp.json()).data.id as number;
    createdEmployeeIds.push(id);

    const fecha = '2098-06-10';
    const resp = await request.get(`${API_BASE}/api/v1/asistencia?fecha=${fecha}`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const row = (await resp.json()).data.find((r: any) => r.empleadoId === id);
    expect(row).toBeTruthy();
    expect(row.id).toBeNull();
    expect(row.jornadaAm).toBe(false);
    expect(row.jornadaPm).toBe(false);
    expect(row.notas).toBeNull();
  });
});
