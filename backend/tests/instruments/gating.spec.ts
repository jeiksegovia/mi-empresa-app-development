/**
 * LOCAL QA — jul-10 (W3 — T7): C6 instruments-write gating matrix.
 *
 * Reference: schema-contract-jul10.md §5.C — `requireInstrumentWriter()` middleware
 * permits writes only when rol=ADMIN OR (rol=EMPLEADO AND tipoEmpleado=GERONTOLOGA).
 * GET routes remain unguarded.
 *
 * The gerontóloga user is created via POST /users as ADMIN; cleaned up in afterAll.
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

test.describe.configure({ mode: 'serial' });

test.describe('Instruments write gating (jul-10 C6)', () => {
  let adminCookie: string;
  let gerontologaCookie: string;
  let gerontologaId: number;
  let plainEmpleadoCookie: string;
  let auditorCookie: string;

  const gerontologaEmail = `gerontologa.gating.${Date.now()}@miempresa.com`;
  const plainEmpleadoEmail = `empleado.gating.${Date.now()}@miempresa.com`;
  const testInstrumentName = `InstrGating.${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    adminCookie = loginRes.headers()['set-cookie'];

    // Create gerontóloga user via API
    const createGero = await request.post(`${API_BASE}/api/v1/users`, {
      headers: { Cookie: adminCookie },
      data: {
        email: gerontologaEmail,
        password: 'password123',
        rol: 'EMPLEADO',
        nombre: 'GERO',
        apellido: 'TEST',
        tipoEmpleado: 'GERONTOLOGA',
      },
    });
    expect(createGero.status()).toBe(201);
    gerontologaId = (await createGero.json()).data.id;

    // Create plain EMPLEADO (no specialization)
    const createPlain = await request.post(`${API_BASE}/api/v1/users`, {
      headers: { Cookie: adminCookie },
      data: {
        email: plainEmpleadoEmail,
        password: 'password123',
        rol: 'EMPLEADO',
        nombre: 'PLAIN',
        apellido: 'EMPLEADO',
      },
    });
    expect(createPlain.status()).toBe(201);

    // Login each role
    const geroLogin = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: gerontologaEmail, password: 'password123' },
    });
    expect(geroLogin.status()).toBe(200);
    gerontologaCookie = geroLogin.headers()['set-cookie'];

    const plainLogin = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: plainEmpleadoEmail, password: 'password123' },
    });
    expect(plainLogin.status()).toBe(200);
    plainEmpleadoCookie = plainLogin.headers()['set-cookie'];

    const auditorLogin = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: 'auditor@miempresa.com', password: 'password123' },
    });
    expect(auditorLogin.status()).toBe(200);
    auditorCookie = auditorLogin.headers()['set-cookie'];
  });

  test.afterAll(async ({ request }) => {
    // Clean up the temp user via PATCH activo=false (no DELETE endpoint)
    if (gerontologaId) {
      await request.delete?.(`${API_BASE}/api/v1/users/${gerontologaId}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: adminCookie } }).catch(() => {});
  });

  test('ADMIN can POST /instruments → 201', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: {
        nombreInstrumento: testInstrumentName,
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'ADMIN,EMPLEADO',
        versionPlantilla: 'v1.0',
      },
    });
    expect(res.status()).toBe(201);
  });

  test('EMPLEADO + GERONTOLOGA can POST /instruments → 201', async ({ request }) => {
    const uniq = `${testInstrumentName}.gerontologa`;
    const res = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: gerontologaCookie },
      data: {
        nombreInstrumento: uniq,
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'EMPLEADO',
        versionPlantilla: 'v1.0',
      },
    });
    expect(res.status()).toBe(201);
  });

  test('plain EMPLEADO (no tipoEmpleado) cannot POST /instruments → 403', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: plainEmpleadoCookie },
      data: {
        nombreInstrumento: `${testInstrumentName}.plain-reject`,
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'EMPLEADO',
        versionPlantilla: 'v1.0',
      },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/GERONTOLOGA|permissions/i);
  });

  test('AUDITOR cannot POST /instruments → 403', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: auditorCookie },
      data: {
        nombreInstrumento: `${testInstrumentName}.auditor-reject`,
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'AUDITOR',
        versionPlantilla: 'v1.0',
      },
    });
    expect(res.status()).toBe(403);
  });

  test('GET /instruments is open to all 4 roles', async ({ request }) => {
    for (const [label, cookie] of [
      ['admin', adminCookie],
      ['gerontologa', gerontologaCookie],
      ['plainEmpleado', plainEmpleadoCookie],
      ['auditor', auditorCookie],
    ] as const) {
      const res = await request.get(`${API_BASE}/api/v1/instruments?limit=1`, {
        headers: { Cookie: cookie },
      });
      expect(res.status(), `${label} GET /instruments`).toBe(200);
    }
  });
});
