import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
let empresaId: number;

async function loginAndGetCookie(request: any, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()['set-cookie'];
  return setCookie;
}

test.describe.configure({ mode: 'serial' });

test.describe('Empresa API', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    });
  });

  test('GET /empresa should return 401 without authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/empresa`);
    expect(response.status()).toBe(401);
  });

  test('GET /empresa should return empresa data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/empresa`, {
      headers: { Cookie: adminCookie },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('nombre');
    expect(body.data).toHaveProperty('nit');
    empresaId = body.data.id;
  });

  test('PUT /empresa/:id should update empresa fields', async ({ request }) => {
    if (!empresaId) { test.skip(); return; }
    const response = await request.put(`${API_BASE}/api/v1/empresa/${empresaId}`, {
      headers: { Cookie: adminCookie },
      data: {
        telefono: '6019999999',
        direccion: 'Nueva Dirección 123',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.telefono).toBe('6019999999');
  });
});
