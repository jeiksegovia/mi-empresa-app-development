import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — nomina-asistencia-jul-18: medio de pago + pendiente sync.
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
    apellido: `MEDIO${suffix}`,
    tipoDocumento: 'CC',
    numeroDocumento: `9${Date.now().toString().slice(-8)}${suffix.slice(0, 2)}`,
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

test.describe.configure({ mode: 'serial' });

test.describe('Empleado medio de pago + pendiente (jul-18)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request);
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
  });

  test('POST without medio → 201 + open pendiente Falta medio de pago de nómina', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: baseEmployee('A1'),
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    const id = body.data.id as number;
    createdIds.push(id);
    expect(body.data.medioPagoTipo ?? null).toBeNull();

    const pend = await request.get(`${API_BASE}/api/v1/employees/${id}/pendientes`, {
      headers: { Cookie: adminCookie },
    });
    expect(pend.status()).toBe(200);
    const pBody = await pend.json();
    const manuales = extractManuales(pBody);
    expect(
      manuales.some(
        (m: any) => m.descripcion === PENDIENTE_MEDIO_PAGO && m.estado === 'PENDIENTE',
      ),
    ).toBe(true);
  });

  test('POST NEQUI without number → 400', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('B2'),
        medioPagoTipo: 'NEQUI',
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(
      body.errors?.medioPagoNequi ||
        body.field === 'medioPagoNequi' ||
        body.message === 'Validation error',
    ).toBeTruthy();
  });

  test('POST TRANSFERENCIA missing bank fields → 400', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('C3'),
        medioPagoTipo: 'TRANSFERENCIA_BANCARIA',
        bancoNombre: 'Bancolombia',
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  test('Completing medio resolves matching open pendiente', async ({ request }) => {
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: baseEmployee('D4'),
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id as number;
    createdIds.push(id);

    const update = await request.put(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
      data: {
        medioPagoTipo: 'NEQUI',
        medioPagoNequi: '3001234567',
      },
    });
    expect(update.status()).toBe(200);
    const uBody = await update.json();
    expect(uBody.data.medioPagoTipo).toBe('NEQUI');
    expect(uBody.data.medioPagoNequi).toBe('3001234567');

    const pend = await request.get(`${API_BASE}/api/v1/employees/${id}/pendientes`, {
      headers: { Cookie: adminCookie },
    });
    expect(pend.status()).toBe(200);
    const pBody = await pend.json();
    const manuales = extractManuales(pBody);
    const stillOpen = manuales.filter(
      (m: any) => m.estado === 'PENDIENTE' && String(m.descripcion).startsWith(PENDIENTE_MEDIO_PAGO),
    );
    expect(stillOpen.length).toBe(0);
    const resolved = manuales.filter(
      (m: any) => m.estado === 'RESUELTO' && String(m.descripcion).startsWith(PENDIENTE_MEDIO_PAGO),
    );
    expect(resolved.length).toBeGreaterThanOrEqual(1);
  });
});
