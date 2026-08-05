import { test, expect } from '@playwright/test';

/**
 * qa-session-jul-31 followup (aug-04): admin "bloqueador" (employee lock).
 *
 * Verifies:
 *  - CONTRATOS can edit an UNLOCKED empleado (baseline).
 *  - ADMIN locks the empleado (PUT /:id/lock) → bloqueado + audit set.
 *  - When locked: CONTRATOS PUT and DELETE → 403 EMPLOYEE_LOCKED; ADMIN still edits (bypass).
 *  - Only ADMIN can lock/unlock (CONTRATOS PUT /:id/lock → 403).
 *  - Lock state is NOT injectable via the normal update payload (bloqueado is stripped).
 *  - ADMIN unlocks → CONTRATOS can edit again.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com';
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || 'password123';

let adminCookie: string;
let contratosCookie: string;
let empId: number;

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/auth/login`, { data: { email, password } });
  if (resp.status() !== 200) throw new Error(`Login failed for ${email}: ${resp.status()}`);
  return resp.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Empleado bloqueador (admin lock)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD);
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'LOCK', apellido: 'TEST',
        tipoDocumento: 'CC',
        numeroDocumento: `9${Date.now().toString().slice(-8)}L`,
        genero: 'M', fechaNacimiento: '1990-01-15',
      },
    });
    expect(create.status()).toBe(201);
    empId = (await create.json()).data.id;
  });

  test.afterAll(async ({ request }) => {
    // ensure unlocked so cleanup delete succeeds, then delete
    await request.put(`${API_BASE}/api/v1/employees/${empId}/unlock`, { headers: { Cookie: adminCookie } }).catch(() => {});
    await request.delete(`${API_BASE}/api/v1/employees/${empId}`, { headers: { Cookie: adminCookie } }).catch(() => {});
    for (const c of [adminCookie, contratosCookie]) {
      await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: c } }).catch(() => {});
    }
  });

  test('baseline: CONTRATOS can edit an unlocked empleado', async ({ request }) => {
    const r = await request.put(`${API_BASE}/api/v1/employees/${empId}`, {
      headers: { Cookie: contratosCookie },
      data: { telefono: '3001112233' },
    });
    expect(r.status()).toBe(200);
  });

  test('CONTRATOS cannot lock (admin-only) → 403', async ({ request }) => {
    const r = await request.put(`${API_BASE}/api/v1/employees/${empId}/lock`, { headers: { Cookie: contratosCookie } });
    expect(r.status()).toBe(403);
  });

  test('ADMIN locks the empleado → bloqueado + audit set', async ({ request }) => {
    const r = await request.put(`${API_BASE}/api/v1/employees/${empId}/lock`, { headers: { Cookie: adminCookie } });
    expect(r.status()).toBe(200);
    const data = (await r.json()).data;
    expect(data.bloqueado).toBe(true);
    expect(data.bloqueadoPor).not.toBeNull();
    expect(data.bloqueadoEn).not.toBeNull();
  });

  test('locked: CONTRATOS PUT → 403 EMPLOYEE_LOCKED', async ({ request }) => {
    const r = await request.put(`${API_BASE}/api/v1/employees/${empId}`, {
      headers: { Cookie: contratosCookie },
      data: { telefono: '3009998877' },
    });
    expect(r.status()).toBe(403);
    expect((await r.json()).code).toBe('EMPLOYEE_LOCKED');
  });

  test('locked: CONTRATOS DELETE → 403 EMPLOYEE_LOCKED', async ({ request }) => {
    const r = await request.delete(`${API_BASE}/api/v1/employees/${empId}`, { headers: { Cookie: contratosCookie } });
    expect(r.status()).toBe(403);
    expect((await r.json()).code).toBe('EMPLOYEE_LOCKED');
  });

  test('locked: ADMIN can still edit (bypass)', async ({ request }) => {
    const r = await request.put(`${API_BASE}/api/v1/employees/${empId}`, {
      headers: { Cookie: adminCookie },
      data: { telefono: '3005556677' },
    });
    expect(r.status()).toBe(200);
  });

  test('ADMIN unlocks → CONTRATOS can edit again; lock not injectable via payload', async ({ request }) => {
    const unlock = await request.put(`${API_BASE}/api/v1/employees/${empId}/unlock`, { headers: { Cookie: adminCookie } });
    expect(unlock.status()).toBe(200);
    expect((await unlock.json()).data.bloqueado).toBe(false);

    // CONTRATOS edits AND tries to sneak bloqueado:true in the payload → stripped.
    const r = await request.put(`${API_BASE}/api/v1/employees/${empId}`, {
      headers: { Cookie: contratosCookie },
      data: { telefono: '3004443322', bloqueado: true },
    });
    expect(r.status()).toBe(200);

    const get = await request.get(`${API_BASE}/api/v1/employees/${empId}`, { headers: { Cookie: adminCookie } });
    expect((await get.json()).data.bloqueado).toBe(false); // injection ignored
  });
});
