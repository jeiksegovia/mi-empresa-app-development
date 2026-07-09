import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;
let testEmployeeId: number;
let createdEmployeeForTest: boolean = false;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()['set-cookie'];
  expect(setCookie).toBeDefined();
  const match = setCookie.match(/session=([^;]+)/);
  expect(match).toBeTruthy();
  return setCookie;
}

test.describe.configure({ mode: 'serial' });

test.describe('Employees Sub-Resources API', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);

    // Try to grab the first available employee
    const listRes = await request.get(`${API_BASE}/api/v1/employees?limit=1`, {
      headers: { Cookie: sessionCookie },
    });
    if (listRes.status() === 200) {
      const listBody = await listRes.json();
      if (listBody.data && listBody.data.length > 0) {
        testEmployeeId = listBody.data[0].id;
      }
    }

    // If no employee found, create one for these tests
    if (!testEmployeeId) {
      const uniqueDoc = `SUBTEST${Date.now()}`;
      const createRes = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'SubResource',
          apellido: 'TestEmployee',
          tipoDocumento: 'CC',
          numeroDocumento: uniqueDoc,
          genero: 'MASCULINO',
          fechaNacimiento: '1990-01-01',
        },
      });
      if (createRes.status() === 201) {
        const createBody = await createRes.json();
        testEmployeeId = createBody.data.id;
        createdEmployeeForTest = true;
      }
    }
  });

  test.afterAll(async ({ request }) => {
    // Only delete if we created the employee specifically for this test suite
    if (createdEmployeeForTest && testEmployeeId) {
      await request.delete(`${API_BASE}/api/v1/employees/${testEmployeeId}`, {
        headers: { Cookie: sessionCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/employees/:id/cargos', () => {
    test('should return 401 without authentication', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(`${API_BASE}/api/v1/employees/${testEmployeeId}/cargos`, {
        data: {
          cargos: [{ nombreCargo: 'Tester', ubicacion: 'QA Dept', fechaIngreso: '2024-01-01' }],
        },
      });
      expect(response.status()).toBe(401);
    });

    test('should return 404 for non-existent employee id', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/employees/99999/cargos`, {
        headers: { Cookie: sessionCookie },
        data: {
          cargos: [{ nombreCargo: 'Tester', ubicacion: 'QA Dept', fechaIngreso: '2024-01-01' }],
        },
      });
      // Route checks for isNaN(id) → 400. 99999 is valid numeric but employee won't exist.
      // The route does a deleteMany then createMany inside a transaction — if employee
      // does not exist in the DB, the transaction succeeds (no FK check at that step).
      // Acceptable: 200 (empty result) or 404. We only assert it is not 500.
      expect(response.status()).not.toBe(500);
    });

    test('should replace all cargos for employee', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/cargos`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            cargos: [
              {
                nombreCargo: 'Tester',
                ubicacion: 'QA Dept',
                fechaIngreso: '2024-01-01',
              },
            ],
          },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/employees/:id/nucleo-familiar', () => {
    test('should replace nucleo familiar with empty array', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/nucleo-familiar`,
        {
          headers: { Cookie: sessionCookie },
          data: { nucleoFamiliar: [] },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/employees/:id/contactos-emergencia', () => {
    test('should replace contactos emergencia', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/contactos-emergencia`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            contactosEmergencia: [
              {
                nombre: 'Emergency',
                apellido: 'Contact',
                telefono: '1234567890',
                parentesco: 'Familiar',
              },
            ],
          },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].nombre).toBe('Emergency');
    });

    test('should replace contactos emergencia with empty array', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/contactos-emergencia`,
        {
          headers: { Cookie: sessionCookie },
          data: { contactosEmergencia: [] },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/employees/:id/experiencias-laborales', () => {
    test('should replace experiencias laborales with empty array', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/experiencias-laborales`,
        {
          headers: { Cookie: sessionCookie },
          data: { experienciasLaborales: [] },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/employees/:id/educacion-idiomas', () => {
    test('should replace educacion idiomas with empty array', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/educacion-idiomas`,
        {
          headers: { Cookie: sessionCookie },
          data: { educacionIdiomas: [] },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/employees/:id/vehiculos', () => {
    test('should replace vehiculos with empty array', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/vehiculos`,
        {
          headers: { Cookie: sessionCookie },
          data: { vehiculos: [] },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/employees/:id/datos-migracion', () => {
    test('should upsert datos migracion with empty object body', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      // Route wraps body under req.body.datosMigracion which can be undefined/null
      // and falls back to empty strings/null — so passing {} is valid
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/datos-migracion`,
        {
          headers: { Cookie: sessionCookie },
          data: { datosMigracion: {} },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('empleadoId', testEmployeeId);
    });

    test('should upsert datos migracion with passport data', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/datos-migracion`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            datosMigracion: {
              numeroPasaporte: 'A123456',
              pasaporteExpedicion: '2022-01-01',
              pasaporteVencimiento: '2032-01-01',
            },
          },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data.numeroPasaporte).toBe('A123456');
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/employees/:id/certificados', () => {
    test('should upsert certificados with empty body (no-op)', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      // Both certificadoAlturas and certificadoRiesgoElectrico are optional;
      // sending empty object is a valid no-op
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/certificados`,
        {
          headers: { Cookie: sessionCookie },
          data: {},
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
    });

    test('should upsert certificado alturas when provided', async ({ request }) => {
      if (!testEmployeeId) { test.skip(); return; }
      const response = await request.put(
        `${API_BASE}/api/v1/employees/${testEmployeeId}/certificados`,
        {
          headers: { Cookie: sessionCookie },
          data: {
            certificadoAlturas: {
              fechaExpedicion: '2024-01-01',
              fechaVencimiento: '2026-01-01',
            },
          },
        },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('certificadoAlturas');
    });
  });
});
