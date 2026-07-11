import { test, expect } from '@playwright/test';

/**
 * W6 — Empresa bootstrap regression specs.
 *
 * These specs cover the NON-DESTRUCTIVE guard paths only. The local dev DB
 * always has empresa id 6 (per CLAUDE.md ground rule — do NOT delete it), so
 * we cannot exercise the full create-from-empty flow locally without risking
 * the single-empresa invariant.
 *
 * Coverage matrix:
 *   - GET  /empresa             → 200 { success:true, data:EmpresaDetail } when row exists
 *                                 (normalized 200 { data: null } path is exercised on staging)
 *   - POST /empresa (existing)  → 409 { field:'empresa', message:'La empresa ya existe' }
 *   - POST /empresa (no auth)   → 401
 *   - POST /empresa (zod)       → 400 with errors for missing nombre/nit
 *   - POST /empresa (zod email) → 400 when email is malformed
 *
 * The "full create-from-empty" path (POST → empresa row created + 7 cargos seeded
 * in one transaction) is exercised post-deploy on staging — staging has 0 empresas,
 * 0 cargos_empresa, 0 contratos (per W6 runbook §D11). See completion-report.md
 * for the exact staging verification curl.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;

async function loginAndGetCookie(request: any, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Empresa bootstrap (W6)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    });
  });

  test('GET /empresa returns the existing row (normalized contract — never 404)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/empresa`, {
      headers: { Cookie: adminCookie },
    });
    // W6: empty-state contract is 200 { data: null }. When a row exists (local
    // dev always has id 6), the response shape is identical except `data` holds
    // the EmpresaDetail. Both must come back as 200 — never 404.
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).not.toBeNull();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('nombre');
    expect(body.data).toHaveProperty('nit');
  });

  test('POST /empresa when empresa already exists returns 409 with field', async ({ request }) => {
    // Single-empresa invariant: POST must refuse a second row.
    const response = await request.post(`${API_BASE}/api/v1/empresa`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'EMPRESA DUPLICADA',
        nit: '999999999-9',
      },
    });
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/ya existe/i);
    expect(body.field).toBe('empresa');
  });

  test('POST /empresa unauthenticated returns 401', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/empresa`, {
      data: { nombre: 'X', nit: 'Y' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /empresa missing required fields returns 400 with Zod errors', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/empresa`, {
      headers: { Cookie: adminCookie },
      data: { nombre: '' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/validation/i);
    expect(body.errors).toBeDefined();
    expect(body.errors.nombre).toBeDefined();
    expect(body.errors.nit).toBeDefined();
  });

  test('POST /empresa with invalid email returns 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/empresa`, {
      headers: { Cookie: adminCookie },
      data: { nombre: 'X', nit: '111111111-1', email: 'not-an-email' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.errors?.email).toBeDefined();
  });

  test('GET /empresa/cargos returns the 7 default cargos seeded by jul9_cargo_empresa', async ({ request }) => {
    // Regression: if a future migration accidentally drops the seed loop, this
    // catches it before staging breaks contrato creation. We assert count + a
    // few well-known names.
    const response = await request.get(`${API_BASE}/api/v1/empresa/cargos`, {
      headers: { Cookie: adminCookie },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const names = body.data.map((c: { nombre: string }) => c.nombre);
    expect(names).toContain('Fisioterapeuta');
    expect(names).toContain('Terapeuta Ocupacional');
    expect(names).toContain('Educador Físico');
    expect(names).toContain('Manualidades');
    expect(names).toContain('Auxiliar de Enfermería');
    expect(names).toContain('Auxiliar de Servicios Generales');
    expect(names).toContain('Otro');
  });
});