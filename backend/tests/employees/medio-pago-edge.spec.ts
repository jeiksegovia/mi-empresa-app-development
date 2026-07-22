import { test, expect } from '@playwright/test';

/**
 * Edge coverage — nomina-asistencia-jul-18 §2 medio de pago.
 *
 * Scenario: conditional validation, field clearing, pendiente idempotency,
 * TRANSFERENCIA complete path, re-open pendiente after clearing medio.
 *
 * Contract: schema-contract-nomina-asistencia-jul-18.md §2
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
const PENDIENTE_MEDIO_PAGO = 'Falta medio de pago de nómina';

let adminCookie: string;
const createdIds: number[] = [];

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

function baseEmployee(suffix: string) {
  return {
    nombre: 'TEST',
    apellido: `MEDGE${suffix}`,
    tipoDocumento: 'CC',
    numeroDocumento: `91${Date.now().toString().slice(-7)}${suffix.slice(0, 2)}`,
    genero: 'M',
    fechaNacimiento: '1990-01-15',
  };
}

function extractManuales(pBody: any): any[] {
  if (Array.isArray(pBody.manuales)) return pBody.manuales;
  if (Array.isArray(pBody.data?.manuales)) return pBody.data.manuales;
  if (Array.isArray(pBody.data)) return pBody.data;
  return [];
}

async function openMedioPendientes(request: any, id: number) {
  const pend = await request.get(`${API_BASE}/api/v1/employees/${id}/pendientes`, {
    headers: { Cookie: adminCookie },
  });
  expect(pend.status()).toBe(200);
  const manuales = extractManuales(await pend.json());
  return manuales.filter(
    (m: any) =>
      m.estado === 'PENDIENTE' && String(m.descripcion).startsWith(PENDIENTE_MEDIO_PAGO),
  );
}

test.describe.configure({ mode: 'serial' });

test.describe('Medio de pago edges (jul-18)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdIds) {
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

  test('POST TRANSFERENCIA complete → 201 + no open medio pendiente + fields returned', async ({
    request,
  }) => {
    const resp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('T1'),
        medioPagoTipo: 'TRANSFERENCIA_BANCARIA',
        bancoNombre: 'Bancolombia',
        bancoTipoCuenta: 'AHORRO',
        bancoNumeroCuenta: '1234567890',
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    const id = body.data.id as number;
    createdIds.push(id);
    expect(body.data.medioPagoTipo).toBe('TRANSFERENCIA_BANCARIA');
    // Contract §2: bancoNombre is free-form string (max 100) — no uppercase mandate
    expect(body.data.bancoNombre).toBe('Bancolombia');
    expect(body.data.bancoTipoCuenta).toBe('AHORRO');
    expect(body.data.bancoNumeroCuenta).toBe('1234567890');
    expect(body.data.medioPagoNequi ?? null).toBeNull();

    const open = await openMedioPendientes(request, id);
    expect(open.length).toBe(0);
  });

  test('NEQUI complete clears bank fields; TRANSFERENCIA clears nequi', async ({ request }) => {
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('T2'),
        medioPagoTipo: 'NEQUI',
        medioPagoNequi: '3001112233',
        bancoNombre: 'ShouldClear',
        bancoTipoCuenta: 'CORRIENTE',
        bancoNumeroCuenta: '999',
      },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id as number;
    createdIds.push(id);

    const get1 = await request.get(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
    });
    const e1 = (await get1.json()).data;
    expect(e1.medioPagoTipo).toBe('NEQUI');
    expect(e1.medioPagoNequi).toBe('3001112233');
    expect(e1.bancoNombre ?? null).toBeNull();
    expect(e1.bancoTipoCuenta ?? null).toBeNull();
    expect(e1.bancoNumeroCuenta ?? null).toBeNull();

    const upd = await request.put(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
      data: {
        medioPagoTipo: 'TRANSFERENCIA_BANCARIA',
        bancoNombre: 'Davivienda',
        bancoTipoCuenta: 'CORRIENTE',
        bancoNumeroCuenta: '555666',
        medioPagoNequi: 'should-clear',
      },
    });
    expect(upd.status()).toBe(200);
    const e2 = (await upd.json()).data;
    expect(e2.medioPagoTipo).toBe('TRANSFERENCIA_BANCARIA');
    expect(e2.medioPagoNequi ?? null).toBeNull();
    expect(e2.bancoTipoCuenta).toBe('CORRIENTE');
    expect(e2.bancoNumeroCuenta).toBe('555666');
  });

  test('pendiente is idempotent — double create/update incomplete does not duplicate', async ({
    request,
  }) => {
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: baseEmployee('T3'),
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id as number;
    createdIds.push(id);

    // Touch update without medio — still incomplete
    const upd = await request.put(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
      data: { telefono: '3000000000' },
    });
    expect(upd.status()).toBe(200);

    const open = await openMedioPendientes(request, id);
    expect(open.length).toBe(1);
  });

  test('clearing complete medio re-opens pendiente', async ({ request }) => {
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('T4'),
        medioPagoTipo: 'NEQUI',
        medioPagoNequi: '3004445566',
      },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id as number;
    createdIds.push(id);
    expect((await openMedioPendientes(request, id)).length).toBe(0);

    const clear = await request.put(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
      data: { medioPagoTipo: null, medioPagoNequi: null },
    });
    expect(clear.status()).toBe(200);
    const open = await openMedioPendientes(request, id);
    expect(open.length).toBe(1);
    expect(open[0].descripcion).toBe(PENDIENTE_MEDIO_PAGO);
  });

  test('NEQUI missing empty-string number → 400', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('T5'),
        medioPagoTipo: 'NEQUI',
        medioPagoNequi: '   ',
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test('TRANSFERENCIA missing bancoTipoCuenta → 400', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('T6'),
        medioPagoTipo: 'TRANSFERENCIA_BANCARIA',
        bancoNombre: 'Bancolombia',
        bancoNumeroCuenta: '111',
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });
});
