import { test, expect } from '@playwright/test';

/**
 * qa-session-jul-24 R6: Asistencia RBAC + note round-trip.
 *
 *   - CONTRATOS PUT /asistencia/dia: fecha != today → 403 field=fecha
 *   - CONTRATOS PUT /asistencia/dia: fecha == today → 200
 *   - ADMIN PUT /asistencia/dia: any date → 200
 *   - notas field persists on round-trip GET
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com';
const CONTRATOS_PASSWORD = 'password123';

const NOTA = 'no vino por cita médica';

function serverTodayBogota(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function ymdOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

let adminCookie: string;
let contratosCookie: string;
let empleadoId: number;

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  if (resp.status() !== 200) {
    throw new Error(`Login failed for ${email}: ${resp.status()}`);
  }
  return resp.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Asistencia RBAC + note (R6)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD);
    const list = await request.get(`${API_BASE}/api/v1/employees?limit=5&estado=ACTIVO`, {
      headers: { Cookie: adminCookie },
    });
    expect(list.status()).toBe(200);
    const body = await list.json();
    empleadoId = body.data?.[0]?.id;
    expect(empleadoId).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: contratosCookie },
    }).catch(() => {});
  });

  test('CONTRATOS PUT /asistencia/dia fecha != today → 403 field=fecha', async ({ request }) => {
    const past = ymdOffset(-1);
    expect(past).not.toBe(serverTodayBogota());
    const resp = await request.put(`${API_BASE}/api/v1/asistencia/dia`, {
      headers: { Cookie: contratosCookie },
      data: {
        fecha: past,
        items: [{ empleadoId, jornadaAm: true, jornadaPm: false, notas: NOTA }],
      },
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('fecha');
  });

  test('CONTRATOS PUT /asistencia/dia fecha == today → 200 + nota persists', async ({ request }) => {
    const today = serverTodayBogota();
    const resp = await request.put(`${API_BASE}/api/v1/asistencia/dia`, {
      headers: { Cookie: contratosCookie },
      data: {
        fecha: today,
        items: [{ empleadoId, jornadaAm: true, jornadaPm: false, notas: NOTA }],
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data[0].notas).toBe(NOTA);

    // round-trip GET to confirm persistence
    const get = await request.get(`${API_BASE}/api/v1/asistencia?fecha=${today}`, {
      headers: { Cookie: adminCookie },
    });
    expect(get.status()).toBe(200);
    const gBody = await get.json();
    const row = gBody.data.find((r: any) => r.empleadoId === empleadoId);
    expect(row).toBeTruthy();
    expect(row.notas).toBe(NOTA);
  });

  test('ADMIN PUT /asistencia/dia any date → 200', async ({ request }) => {
    const past = ymdOffset(-2);
    const resp = await request.put(`${API_BASE}/api/v1/asistencia/dia`, {
      headers: { Cookie: adminCookie },
      data: {
        fecha: past,
        items: [{ empleadoId, jornadaAm: true, jornadaPm: false, notas: 'admin override' }],
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data[0].notas).toBe('admin override');
  });
});
