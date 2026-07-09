import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — Instrumentos rolesPermitidos refinement (D6).
 *
 * Verifies the W2 backend refinement of `rolesPermitidos` against the
 * RolUsuario enum. The MultiSelect on the frontend constrains user input,
 * but a malicious or scripted client could POST any string. The refine must
 * reject anything that is not in {ADMIN, EMPLEADO, AUDITOR, OPERADOR}.
 *
 * Coverage:
 *   - POST with single bogus role → 400 + `errors.rolesPermitidos`
 *   - POST with mix of valid + invalid → 400
 *   - POST with all 4 valid roles → 201
 *   - PUT also enforces refine
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

test.describe('Instruments rolesPermitidos Zod refinement', () => {
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

  test('POST with single bogus role "SUPERHEROE" → 400 + errors.rolesPermitidos', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('SUPERHEROE', `${Date.now()}-1`),
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    // The Zod refine error must surface with the field key
    expect(body.errors).toBeTruthy();
    expect(body.errors.rolesPermitidos || body.errors?.rolesPermitidos).toBeTruthy();
    // The error message lists the allowed enum
    const errStr = JSON.stringify(body.errors);
    expect(errStr).toMatch(/ADMIN|EMPLEADO|AUDITOR|OPERADOR/);
  });

  test('POST with "ROLE_FOO,ADMIN" (one valid, one bogus) → 400', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('ROLE_FOO,ADMIN', `${Date.now()}-2`),
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).toMatch(/rolesPermitidos/);
  });

  test('POST with all 4 valid roles "ADMIN,EMPLEADO,AUDITOR,OPERADOR" → 201', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('ADMIN,EMPLEADO,AUDITOR,OPERADOR', `${Date.now()}-3`),
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data.rolesPermitidos).toBe('ADMIN,EMPLEADO,AUDITOR,OPERADOR');
    createdIds.push(body.data.id);
  });

  test('POST with case-sensitive mismatch "admin" (lowercase) → 400', async ({ request }) => {
    // The schema is case-sensitive per D6 — verify
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('admin', `${Date.now()}-4`),
    });
    expect(resp.status()).toBe(400);
  });

  test('POST with empty string "" → 400 (.min(1) guard)', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('', `${Date.now()}-5`),
    });
    expect(resp.status()).toBe(400);
  });

  test('PUT also enforces refine on update', async ({ request }) => {
    // Create valid instrument first
    const createResp = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: baseCreateBody('EMPLEADO', `${Date.now()}-6`),
    });
    expect(createResp.status()).toBe(201);
    const created = await createResp.json();
    const id = created.data.id;
    createdIds.push(id);

    // Try PUT with bogus role
    const putResp = await request.put(`${API_BASE}/api/v1/instruments/${id}`, {
      headers: { Cookie: adminCookie },
      data: { rolesPermitidos: 'OVERLORD' },
    });
    expect(putResp.status()).toBe(400);
    const body = await putResp.json();
    expect(JSON.stringify(body)).toMatch(/rolesPermitidos/);
  });
});
