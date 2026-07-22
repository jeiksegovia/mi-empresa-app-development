import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — Instrumentos rolesPermitidos refinement.
 *
 * CONTRACT CHANGE (QA jul-11 I2): roles now mirror the per-empresa
 * CargoEmpresa catalog (free-form names like "AUXILIAR DE ENFERMERÍA") plus
 * ADMIN — they are NO LONGER restricted to the RolUsuario enum. The column
 * is descriptive only (access gating never reads it), so the refine now
 * validates SHAPE, not membership:
 *   - non-empty comma-separated items
 *   - each item ≤100 chars
 *   - total ≤255 chars (DB VarChar(255))
 *
 * Coverage:
 *   - POST with a cargo-style name → 201 (was 400 pre-jul-11)
 *   - POST with legacy enum values → 201 (back-compat)
 *   - POST with empty string / only commas → 400
 *   - POST with an item >100 chars or total >255 → 400
 *   - PUT enforces the same shape rules
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
const createdIds: number[] = [];

async function loginAndGetCookie(request: any, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

function baseCreateBody(rolesPermitidos: string, uniq: string): Record<string, unknown> {
  return {
    nombreInstrumento: `Roles Test ${uniq}`,
    tipo: 'VALORACION',
    periodicidad: 'UNICA',
    rolesPermitidos,
    versionPlantilla: 'v1.0',
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Instruments rolesPermitidos Zod refinement (jul-11 cargo-name contract)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdIds) {
      await request.delete(`${API_BASE}/api/v1/instruments/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
  });

  test('POST with cargo-style names "ADMIN,AUXILIAR DE ENFERMERÍA,GERONTÓLOGA" → 201', async ({ request }) => {
    const roles = 'ADMIN,AUXILIAR DE ENFERMERÍA,GERONTÓLOGA';
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody(roles, `${Date.now()}-1`),
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data.rolesPermitidos).toBe(roles);
    createdIds.push(body.data.id);
  });

  test('POST with legacy enum values "ADMIN,EMPLEADO,AUDITOR,OPERADOR" still → 201 (back-compat)', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('ADMIN,EMPLEADO,AUDITOR,OPERADOR', `${Date.now()}-2`),
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.data.rolesPermitidos).toBe('ADMIN,EMPLEADO,AUDITOR,OPERADOR');
    createdIds.push(body.data.id);
  });

  test('POST with empty string "" → 400 (.min(1) guard)', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('', `${Date.now()}-3`),
    });
    expect(resp.status()).toBe(400);
  });

  test('POST with only commas ",,," → 400 (no valid items)', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody(',,,', `${Date.now()}-4`),
    });
    expect(resp.status()).toBe(400);
    expect(JSON.stringify(await resp.json())).toMatch(/rolesPermitidos/);
  });

  test('POST with a single item >100 chars → 400', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('X'.repeat(101), `${Date.now()}-5`),
    });
    expect(resp.status()).toBe(400);
  });

  test('POST with total >255 chars → 400 (DB VarChar(255) guard)', async ({ request }) => {
    const roles = Array.from({ length: 6 }, (_, i) => `CARGO ${i} ${'Y'.repeat(45)}`).join(',');
    expect(roles.length).toBeGreaterThan(255);
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody(roles, `${Date.now()}-6`),
    });
    expect(resp.status()).toBe(400);
  });

  test('PUT enforces the same shape rules', async ({ request }) => {
    const createResp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('ADMIN', `${Date.now()}-7`),
    });
    expect(createResp.status()).toBe(201);
    const id = (await createResp.json()).data.id;
    createdIds.push(id);

    // Cargo-style rename is accepted…
    const okResp = await request.put(`${API_BASE}/api/v1/instruments/${id}`, {
      headers: { Cookie: adminCookie },
      data: { rolesPermitidos: 'ADMIN,GERONTÓLOGA' },
    });
    expect(okResp.status()).toBe(200);

    // …but an over-long item is rejected.
    const badResp = await request.put(`${API_BASE}/api/v1/instruments/${id}`, {
      headers: { Cookie: adminCookie },
      data: { rolesPermitidos: 'Z'.repeat(101) },
    });
    expect(badResp.status()).toBe(400);
    expect(JSON.stringify(await badResp.json())).toMatch(/rolesPermitidos/);
  });
});
