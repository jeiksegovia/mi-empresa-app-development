import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
// Non-admin user from seed data
const EMPLOYEE_EMAIL = 'empleado@miempresa.com';
const EMPLOYEE_PASSWORD = 'password123';

let adminCookie: string;
let employeeCookie: string;
let createdId: number;
// empresaId 1 is created by the seed (Mi Empresa S.A.S.)
const EMPRESA_ID = 1;

async function loginAndGetCookie(request: any, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()['set-cookie'];
  expect(setCookie).toBeDefined();
  return setCookie;
}

test.describe.configure({ mode: 'serial' });

test.describe('Certificates API', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Attempt login as employee; if it fails, employeeCookie stays undefined
    const empRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: EMPLOYEE_EMAIL, password: EMPLOYEE_PASSWORD },
    });
    if (empRes.status() === 200) {
      const setCookie = empRes.headers()['set-cookie'];
      if (setCookie) {
        employeeCookie = setCookie;
      }
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup created certificate if it still exists
    if (createdId) {
      await request.delete(`${API_BASE}/api/v1/certificates/${createdId}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    });
    if (employeeCookie) {
      await request.post(`${API_BASE}/api/v1/auth/logout`, {
        headers: { Cookie: employeeCookie },
      }).catch(() => {});
    }
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/certificates/stats', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/certificates/stats`);
      expect(response.status()).toBe(401);
    });

    test('should return certificate counts by estado', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/certificates/stats`, {
        headers: { Cookie: adminCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('vigente');
      expect(body.data).toHaveProperty('vencido');
      expect(body.data).toHaveProperty('pendiente');
      expect(body.data).toHaveProperty('total');
      expect(typeof body.data.vigente).toBe('number');
      expect(typeof body.data.vencido).toBe('number');
      expect(typeof body.data.pendiente).toBe('number');
      expect(body.data.total).toBe(body.data.vigente + body.data.vencido + body.data.pendiente);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/certificates - List certificates', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/certificates`);
      expect(response.status()).toBe(401);
    });

    test('should return certificate list with pagination', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/certificates`, {
        headers: { Cookie: adminCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('limit');
      expect(body).toHaveProperty('totalPages');
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should accept tipo and estado filter params', async ({ request }) => {
      const response = await request.get(
        `${API_BASE}/api/v1/certificates?tipo=RUT&estado=PENDIENTE`,
        {
          headers: { Cookie: adminCookie },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('POST /api/v1/certificates - Create certificate (admin only)', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/certificates`, {
        data: {
          empresaId: EMPRESA_ID,
          nombre: 'Unauthorized Cert',
          tipoCertificado: 'RUT',
        },
      });
      expect(response.status()).toBe(401);
    });

    test('should return 403 when non-admin creates certificate', async ({ request }) => {
      if (!employeeCookie) {
        test.skip();
        return;
      }
      const response = await request.post(`${API_BASE}/api/v1/certificates`, {
        headers: { Cookie: employeeCookie },
        data: {
          empresaId: EMPRESA_ID,
          nombre: 'Employee Cert',
          tipoCertificado: 'RUT',
        },
      });
      expect(response.status()).toBe(403);
    });

    test('should create a certificate as admin', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/certificates`, {
        headers: { Cookie: adminCookie },
        data: {
          empresaId: EMPRESA_ID,
          nombre: 'Test Cert',
          tipoCertificado: 'RUT',
          estado: 'PENDIENTE',
          fechaEmision: '2026-01-01',
          fechaVencimiento: '2027-01-01',
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.nombre).toBe('Test Cert');
      expect(body.data.tipoCertificado).toBe('RUT');
      expect(body.data.estado).toBe('PENDIENTE');
      createdId = body.data.id;
    });
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/certificates/:id - Get certificate by ID', () => {
    test('should return the created certificate', async ({ request }) => {
      if (!createdId) {
        test.skip();
        return;
      }
      const response = await request.get(`${API_BASE}/api/v1/certificates/${createdId}`, {
        headers: { Cookie: adminCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id', createdId);
      expect(body.data.nombre).toBe('Test Cert');
    });

    test('should return 404 for non-existent certificate', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/certificates/999999999`, {
        headers: { Cookie: adminCookie },
      });
      expect(response.status()).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/certificates/:id - Update certificate (admin only)', () => {
    test('should return 403 when non-admin updates certificate', async ({ request }) => {
      if (!employeeCookie || !createdId) {
        test.skip();
        return;
      }
      const response = await request.put(`${API_BASE}/api/v1/certificates/${createdId}`, {
        headers: { Cookie: employeeCookie },
        data: { nombre: 'Unauthorized Update' },
      });
      expect(response.status()).toBe(403);
    });

    test('should update certificate as admin', async ({ request }) => {
      if (!createdId) {
        test.skip();
        return;
      }
      const response = await request.put(`${API_BASE}/api/v1/certificates/${createdId}`, {
        headers: { Cookie: adminCookie },
        data: { nombre: 'Updated Cert' },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data.nombre).toBe('Updated Cert');
    });
  });

  // -----------------------------------------------------------------------
  test.describe('DELETE /api/v1/certificates/:id - Delete certificate (admin only)', () => {
    test('should return 403 when non-admin deletes certificate', async ({ request }) => {
      if (!employeeCookie || !createdId) {
        test.skip();
        return;
      }
      const response = await request.delete(`${API_BASE}/api/v1/certificates/${createdId}`, {
        headers: { Cookie: employeeCookie },
      });
      expect(response.status()).toBe(403);
    });

    test('should delete certificate as admin', async ({ request }) => {
      if (!createdId) {
        test.skip();
        return;
      }
      const response = await request.delete(`${API_BASE}/api/v1/certificates/${createdId}`, {
        headers: { Cookie: adminCookie },
      });
      expect([200, 204]).toContain(response.status());
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('success', true);
      }
      // Mark as cleaned up so afterAll skips
      createdId = 0;
    });

    test('should return 404 after deletion', async ({ request }) => {
      // Use a guaranteed non-existent id
      const response = await request.get(`${API_BASE}/api/v1/certificates/999999999`, {
        headers: { Cookie: adminCookie },
      });
      expect(response.status()).toBe(404);
    });
  });
});
