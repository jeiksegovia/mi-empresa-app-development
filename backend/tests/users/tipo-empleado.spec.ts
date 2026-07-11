/**
 * LOCAL QA — jul-10 (W3 — T7): C6 Usuario API — tipoEmpleado pairing rule.
 *
 * Reference: schema-contract-jul10.md §5.C — tipoEmpleado may only be set when
 *   rol='EMPLEADO'. POST rejects mismatches with 400 field=tipoEmpleado.
 *   PATCH clears (sets to null) when rol is changed away from EMPLEADO.
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

test.describe.configure({ mode: 'serial' });

test.describe('Usuario tipoEmpleado pairing rule (jul-10 C6)', () => {
  let adminCookie: string;
  const uniq = Date.now();
  const geroEmail = `gero.pair.${uniq}@miempresa.com`;
  let geroId: number;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    adminCookie = loginRes.headers()['set-cookie'];
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: adminCookie } }).catch(() => {});
  });

  test('POST /users rejects tipoEmpleado without rol=EMPLEADO → 400 field=tipoEmpleado', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/users`, {
      headers: { Cookie: adminCookie },
      data: {
        email: `pair.rej.${uniq}@miempresa.com`,
        password: 'password123',
        rol: 'ADMIN',
        nombre: 'PAIR',
        apellido: 'TEST',
        tipoEmpleado: 'GERONTOLOGA',  // mismatch — ADMIN cannot have a specialization
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('tipoEmpleado');
    expect(body.message).toMatch(/EMPLEADO|EMPLEADO/i);
  });

  test('POST /users with rol=EMPLEADO + tipoEmpleado=GERONTOLOGA → 201', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/users`, {
      headers: { Cookie: adminCookie },
      data: {
        email: geroEmail,
        password: 'password123',
        rol: 'EMPLEADO',
        nombre: 'pair tester gerontologa',
        apellido: 'g',
        tipoEmpleado: 'GERONTOLOGA',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.rol).toBe('EMPLEADO');
    expect(body.data.tipoEmpleado).toBe('GERONTOLOGA');
    expect(body.data.nombre).toBe('PAIR TESTER GERONTOLOGA'); // E1 transform
    expect(body.data.apellido).toBe('G');                     // E1 trim+upper
    geroId = body.data.id;
  });

  test('PATCH rol change to ADMIN clears tipoEmpleado → null', async ({ request }) => {
    expect(geroId, 'previous test created geroId').toBeTruthy();
    const res = await request.patch(`${API_BASE}/api/v1/users/${geroId}`, {
      headers: { Cookie: adminCookie },
      data: { rol: 'AUDITOR' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.rol).toBe('AUDITOR');
    expect(body.data.tipoEmpleado).toBeNull();
  });

  test('PATCH sets tipoEmpleado again when rol=EMPLEADO', async ({ request }) => {
    expect(geroId, 'previous test created geroId').toBeTruthy();
    const res = await request.patch(`${API_BASE}/api/v1/users/${geroId}`, {
      headers: { Cookie: adminCookie },
      data: { rol: 'EMPLEADO', tipoEmpleado: 'GERONTOLOGA' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.rol).toBe('EMPLEADO');
    expect(body.data.tipoEmpleado).toBe('GERONTOLOGA');
  });
});
