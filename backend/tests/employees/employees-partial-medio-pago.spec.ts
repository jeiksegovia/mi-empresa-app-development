import { test, expect } from '@playwright/test';

/**
 * qa-session-jul-24 R1: employee partial-edit + CONTRATOS RBAC + Nequi validation.
 *
 * Verifies:
 *  - PATCH with ONLY payment fields (compatible with the existing medioPagoTipo) succeeds
 *    for ADMIN and CONTRATOS.
 *  - EFECTIVO accepts the value with no extra fields.
 *  - Nequi llave regex accepts email / alphanumeric with letter+digit, rejects pure-numeric.
 *  - Sending payment fields with no medioPagoTipo AND existing medioPagoTipo null fails 400.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com';
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || 'password123';

const NEQUI_LLAVE_OK = [
  '3001234567', // wait — pure numeric should be REJECTED
  'mi.llave@correo.com',
  'LlaveABC123',
  'X1Y2Z3A4B5',
];
const NEQUI_LLAVE_OK_TRUTHY = ['mi.llave@correo.com', 'LlaveABC123', 'X1Y2Z3A4B5'];

let adminCookie: string;
let contratosCookie: string;
const createdIds: number[] = [];

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  if (resp.status() !== 200) {
    throw new Error(`Login failed for ${email}: ${resp.status()}`);
  }
  return resp.headers()['set-cookie'];
}

function baseEmployee(suffix: string) {
  return {
    nombre: 'TEST',
    apellido: `PARC${suffix}`,
    tipoDocumento: 'CC',
    numeroDocumento: `8${Date.now().toString().slice(-8)}${suffix.slice(0, 2)}`,
    genero: 'M',
    fechaNacimiento: '1990-01-15',
  };
}

test.describe.configure({ mode: 'serial' });

test.describe('Employee partial-edit + RBAC + Nequi (R1)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdIds) {
      await request.delete(`${API_BASE}/api/v1/employees/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: contratosCookie },
    }).catch(() => {});
  });

  test('ADMIN can patch ONLY payment fields (NEQUI), existing medioPagoTipo null → 400 medioPagoTipo', async ({ request }) => {
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: baseEmployee('PA1'),
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id as number;
    createdIds.push(id);

    // Without medioPagoTipo and existing is null → 400
    const bad = await request.put(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
      data: { medioPagoNequi: 'LlaveABC123' },
    });
    expect(bad.status()).toBe(400);
    const badBody = await bad.json();
    expect(badBody.field).toBe('medioPagoTipo');
  });

  test('ADMIN can patch ONLY payment fields when existing medioPagoTipo is set (NEQUI update)', async ({ request }) => {
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('PA2'),
        medioPagoTipo: 'NEQUI',
        medioPagoNequi: 'LlaveABC123',
      },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id as number;
    createdIds.push(id);

    const put = await request.put(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
      data: { medioPagoNequi: 'mi.llave@correo.com' },
    });
    expect(put.status()).toBe(200);
    const body = await put.json();
    expect(body.data.medioPagoTipo).toBe('NEQUI');
    expect(body.data.medioPagoNequi).toBe('mi.llave@correo.com');
  });

  test('CONTRATOS can patch ONLY payment fields when existing medioPagoTipo is set', async ({ request }) => {
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('PA3'),
        medioPagoTipo: 'NEQUI',
        medioPagoNequi: 'LlaveABC123',
      },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id as number;
    createdIds.push(id);

    const put = await request.put(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: contratosCookie },
      data: { medioPagoNequi: 'X1Y2Z3A4B5' },
    });
    expect(put.status()).toBe(200);
    const body = await put.json();
    expect(body.data.medioPagoTipo).toBe('NEQUI');
    expect(body.data.medioPagoNequi).toBe('X1Y2Z3A4B5');
  });

  test('EFECTIVO saves with bank/nequi null and no extra fields required', async ({ request }) => {
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('PA4'),
        medioPagoTipo: 'EFECTIVO',
      },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id as number;
    createdIds.push(id);
    const body = await create.json();
    expect(body.data.medioPagoTipo).toBe('EFECTIVO');
    expect(body.data.medioPagoNequi ?? null).toBeNull();
    expect(body.data.bancoNombre ?? null).toBeNull();
    expect(body.data.bancoTipoCuenta ?? null).toBeNull();
    expect(body.data.bancoNumeroCuenta ?? null).toBeNull();
  });

  test('Nequi validates email / alphanumeric formats; rejects pure numeric', async ({ request }) => {
    for (const good of NEQUI_LLAVE_OK_TRUTHY) {
      const create = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: adminCookie },
        data: {
          ...baseEmployee(`OK${good.length}`),
          medioPagoTipo: 'NEQUI',
          medioPagoNequi: good,
        },
      });
      expect.soft(create.status(), `accept: ${good}`).toBe(201);
      const cBody = await create.json();
      if (cBody?.data?.id) createdIds.push(cBody.data.id);
    }
    // pure numeric (10-15 digits) should be rejected
    const bad = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('BAD'),
        medioPagoTipo: 'NEQUI',
        medioPagoNequi: '3001234567',
      },
    });
    expect.soft(bad.status(), 'reject pure numeric').toBe(400);
    const bBody = await bad.json();
    if (bBody?.errors?.medioPagoNequi || bBody?.field === 'medioPagoNequi') {
      // expected
    }
  });
});
