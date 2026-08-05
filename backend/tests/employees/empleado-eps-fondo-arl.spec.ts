import { test, expect } from '@playwright/test';

/**
 * qa-session-jul-31 R3: optional EPS / Fondo de pensiones / ARL on Empleado.
 *
 *   - POST without the 3 fields → 201, fields null on GET.
 *   - POST with all 3 → 201, persisted and returned.
 *   - PUT partial (only one of the 3) → 200, others preserved.
 *   - Length validation: > 100 → 400 from Zod.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
const createdIds: number[] = [];

async function login(request: any): Promise<string> {
  const r = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(r.status()).toBe(200);
  return r.headers()['set-cookie'];
}

function baseEmployee(suffix: string) {
  return {
    nombre: 'TEST',
    apellido: `R3${suffix}`,
    tipoDocumento: 'CC',
    numeroDocumento: `8${Date.now().toString().slice(-8)}${suffix.slice(0, 2)}`,
    genero: 'M',
    fechaNacimiento: '1990-01-15',
  };
}

test.describe.configure({ mode: 'serial' });

test.describe('Empleado EPS / Fondo de pensiones / ARL (qa-jul-31 R3)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request);
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

  test('POST without eps/fondoPensiones/arl → 201; fields null on GET', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: baseEmployee('NM'),
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    const id = body.data.id as number;
    createdIds.push(id);

    // On create, the response doesn't include the new fields (Prisma returns all scalar fields).
    // The source of truth is GET /employees/:id.
    const get = await request.get(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
    });
    expect(get.status()).toBe(200);
    const g = await get.json();
    expect(g.data.eps ?? null).toBeNull();
    expect(g.data.fondoPensiones ?? null).toBeNull();
    expect(g.data.arl ?? null).toBeNull();
  });

  test('POST with all 3 → 201; persisted and returned', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('AL'),
        eps: 'Sura',
        fondoPensiones: 'Porvenir',
        arl: 'Positiva',
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    const id = body.data.id as number;
    createdIds.push(id);

    const get = await request.get(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
    });
    expect(get.status()).toBe(200);
    const g = await get.json();
    expect(g.data.eps).toBe('Sura');
    expect(g.data.fondoPensiones).toBe('Porvenir');
    expect(g.data.arl).toBe('Positiva');
  });

  test('PUT partial (eps only) → 200; fondoPensiones+arl preserved', async ({ request }) => {
    // Create with all 3
    const create = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        ...baseEmployee('PR'),
        eps: 'Sanitas',
        fondoPensiones: 'Colfondos',
        arl: 'Sura ARL',
      },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id as number;
    createdIds.push(id);

    // Update only eps
    const upd = await request.put(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
      data: { eps: 'Nueva EPS' },
    });
    expect(upd.status()).toBe(200);

    const get = await request.get(`${API_BASE}/api/v1/employees/${id}`, {
      headers: { Cookie: adminCookie },
    });
    const g = await get.json();
    expect(g.data.eps).toBe('Nueva EPS');
    expect(g.data.fondoPensiones).toBe('Colfondos');
    expect(g.data.arl).toBe('Sura ARL');
  });

  test('POST with eps > 100 chars → 400 (Zod length validation)', async ({ request }) => {
    const long = 'x'.repeat(101);
    const resp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: { ...baseEmployee('LV'), eps: long },
    });
    expect(resp.status()).toBe(400);
  });
});