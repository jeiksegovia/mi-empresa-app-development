/**
 * LOCAL QA — jul-9 (W4 — T13): D7 CargoEmpresa catalog CRUD.
 *
 * Reference: `schema-contract-jul9.md` §4.5 — endpoints at /api/v1/empresa/cargos
 *   GET    /api/v1/empresa/cargos             — full list (incl. archived)
 *   GET    /api/v1/empresa/cargos?activo=true  — active only
 *   POST   /api/v1/empresa/cargos             — create; 409 on UNIQUE collision
 *   PATCH  /api/v1/empresa/cargos/:id         — flip activo or change nombre
 *   DELETE /api/v1/empresa/cargos/:id         — soft-archive (activo=false)
 *
 * Seed (from contract §4.3): 7 cargos per existing empresa. We add a unique
 * cargo per test run (using Date.now()) to avoid collision with the seed.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;
let createdCargoId: number;
let createdCargoNombre: string;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('CargoEmpresa CRUD (jul-9 D7)', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);
    createdCargoNombre = `QA-Jul9-${Date.now()}`;
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup via soft-archive
    if (createdCargoId) {
      await request.patch(`${API_BASE}/api/v1/empresa/cargos/${createdCargoId}`, {
        headers: { Cookie: sessionCookie },
        data: { activo: false },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    }).catch(() => {});
  });

  test('GET /empresa/cargos returns seeded cargos (≥ 7 entries, ordered by nombre)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/empresa/cargos`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(7);
    // Confirmed-seed cargos per contract §4.3
    const nombres = body.data.map((c: any) => c.nombre);
    expect(nombres).toContain('Fisioterapeuta');
    expect(nombres).toContain('Auxiliar de Enfermería');
    // Sorted ASC by nombre
    const sorted = [...nombres].sort();
    expect(nombres).toEqual(sorted);
  });

  test('POST /empresa/cargos creates a cargo → 201 with the new id', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/empresa/cargos`, {
      headers: { Cookie: sessionCookie },
      data: { nombre: createdCargoNombre },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.nombre).toBe(createdCargoNombre);
    expect(body.data.activo).toBe(true);
    expect(body.data.id).toBeDefined();
    createdCargoId = body.data.id;
  });

  test('POST /empresa/cargos duplicate nombre → 409 with field=nombre', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/empresa/cargos`, {
      headers: { Cookie: sessionCookie },
      data: { nombre: createdCargoNombre },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('nombre');
  });

  test('PATCH /empresa/cargos/:id activo=false archives the cargo', async ({ request }) => {
    if (!createdCargoId) { test.skip(); return; }
    const res = await request.patch(`${API_BASE}/api/v1/empresa/cargos/${createdCargoId}`, {
      headers: { Cookie: sessionCookie },
      data: { activo: false },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.activo).toBe(false);
  });

  test('Archived cargo is EXCLUDED from ?activo=true list', async ({ request }) => {
    if (!createdCargoId) { test.skip(); return; }
    const res = await request.get(`${API_BASE}/api/v1/empresa/cargos?activo=true`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const ids = body.data.map((c: any) => c.id);
    expect(ids).not.toContain(createdCargoId);
  });

  test('Archived cargo REMAINS in full list (no filtro)', async ({ request }) => {
    if (!createdCargoId) { test.skip(); return; }
    const res = await request.get(`${API_BASE}/api/v1/empresa/cargos`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const found = body.data.find((c: any) => c.id === createdCargoId);
    expect(found).toBeDefined();
    expect(found.activo).toBe(false);
  });

  test('DELETE /empresa/cargos/:id soft-archives (activo becomes false)', async ({ request }) => {
    if (!createdCargoId) { test.skip(); return; }
    // First re-activate so we can verify DELETE flips it back
    await request.patch(`${API_BASE}/api/v1/empresa/cargos/${createdCargoId}`, {
      headers: { Cookie: sessionCookie },
      data: { activo: true },
    }).catch(() => {});

    const delRes = await request.delete(`${API_BASE}/api/v1/empresa/cargos/${createdCargoId}`, {
      headers: { Cookie: sessionCookie },
    });
    // Contract §4.5 says 204 No Content. W1 GAP-3 fix made the handler return
    // res.status(204).end() (no body) on success. Soft-archive via activo=false
    // is verified below.
    expect(delRes.status()).toBe(204);

    const getRes = await request.get(`${API_BASE}/api/v1/empresa/cargos`, {
      headers: { Cookie: sessionCookie },
    });
    expect(getRes.status()).toBe(200);
    const body = await getRes.json();
    const after = body.data.find((c: any) => c.id === createdCargoId);
    expect(after).toBeDefined();
    expect(after.activo).toBe(false);
  });
});
