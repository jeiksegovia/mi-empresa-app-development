/**
 * LOCAL QA — jul-10 (W3 — T7): C7 weekly vencimientos report endpoint.
 *
 * Reference: schema-contract-jul10.md §5.B — `GET /api/v1/patients/fichas/vencimientos?days=N`
 *   - defaults days=7 if absent
 *   - cap: 1..365 (Zod)
 *   - flips expired PENDIENTE → VENCIDO before computing
 *   - returns fichas with estado ∈ {PENDIENTE, VENCIDO} and fechaVencimiento <= today+days
 *   - shape: clienteNombre, instrumentoNombre, diasHastaVencimiento, etc.
 *   - ordering: fechaVencimiento asc (most overdue first)
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

test.describe.configure({ mode: 'serial' });

test.describe('Fichas vencimientos report C7 (jul-10)', () => {
  let adminCookie: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    adminCookie = loginRes.headers()['set-cookie'];
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: adminCookie } }).catch(() => {});
  });

  test('GET /patients/fichas/vencimientos → 200 + shape', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/patients/fichas/vencimientos?days=365`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.windowDays).toBe('number');
    expect(body.windowDays).toBe(365);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.generatedAt).toBe('string');

    if (body.data.length > 0) {
      const r = body.data[0];
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('clienteId');
      expect(r).toHaveProperty('clienteNombre');
      expect(r).toHaveProperty('instrumentoId');
      expect(r).toHaveProperty('instrumentoNombre');
      expect(r).toHaveProperty('estado');
      expect(r).toHaveProperty('diasHastaVencimiento');
      expect(['PENDIENTE', 'VENCIDO']).toContain(r.estado);
    }
  });

  test('days param validation: 0 → 400 (Zod min=1)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/patients/fichas/vencimientos?days=0`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status()).toBe(400);
  });

  test('days param validation: 999 → 400 (Zod max=365)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/patients/fichas/vencimientos?days=999`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status()).toBe(400);
  });

  test('default days when omitted is 7', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/patients/fichas/vencimientos`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.windowDays).toBe(7);
  });

  test('ordering: fechaVencimiento asc when data is non-empty', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/patients/fichas/vencimientos?days=365`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status()).toBe(200);
    const items = (await res.json()).data ?? [];
    if (items.length > 1) {
      for (let i = 0; i < items.length - 1; i++) {
        const a = new Date(items[i].fechaVencimiento).getTime();
        const b = new Date(items[i + 1].fechaVencimiento).getTime();
        expect(a, `asc ordering broken at ${i}`).toBeLessThanOrEqual(b);
      }
    }
  });
});
