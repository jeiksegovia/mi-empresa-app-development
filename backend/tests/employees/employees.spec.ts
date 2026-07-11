import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;
let createdEmployeeId: number;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()['set-cookie'];
  expect(setCookie).toBeDefined();
  // Extract session cookie value
  const match = setCookie.match(/session=([^;]+)/);
  expect(match).toBeTruthy();
  return setCookie;
}

// Run serially to share login session and avoid concurrent login conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Employees API', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    });
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/employees - List employees', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/employees`);
      expect(response.status()).toBe(401);
    });

    test('should return employee list with pagination when authenticated', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
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

    test('should support pagination params', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/employees?page=1&limit=5`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(5);
      expect(body.data.length).toBeLessThanOrEqual(5);
    });

    test('should support search by name', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/employees?search=test`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
    });

    test('should support filter by estado ACTIVO', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/employees?estado=ACTIVO`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      body.data.forEach((emp: any) => {
        expect(emp.estado).toBe('ACTIVO');
      });
    });

    test('should cap limit at 100', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/employees?limit=999`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.limit).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('POST /api/v1/employees - Create employee', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/employees`, {
        data: {
          nombre: 'Test',
          apellido: 'Employee',
          tipoDocumento: 'CC',
          numeroDocumento: '99999999',
          genero: 'MASCULINO',
          fechaNacimiento: '1990-01-01',
        },
      });
      expect(response.status()).toBe(401);
    });

    test('should fail validation with missing required fields', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
        data: { nombre: 'Solo nombre' },
      });
      expect(response.status()).toBe(400);
    });

    test('should fail with invalid tipoDocumento', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Test',
          apellido: 'Employee',
          tipoDocumento: 'INVALID',
          numeroDocumento: '99999999',
          genero: 'MASCULINO',
          fechaNacimiento: '1990-01-01',
        },
      });
      expect(response.status()).toBe(400);
    });

    test('should fail with invalid email', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Test',
          apellido: 'Employee',
          tipoDocumento: 'CC',
          numeroDocumento: '12345678',
          genero: 'MASCULINO',
          fechaNacimiento: '1990-01-01',
          email: 'not-an-email',
        },
      });
      expect(response.status()).toBe(400);
    });

    test('should create an employee successfully with minimal fields', async ({ request }) => {
      const uniqueDoc = `TEST${Date.now()}`;
      const response = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Juan',
          apellido: 'Perez',
          tipoDocumento: 'CC',
          numeroDocumento: uniqueDoc,
          genero: 'MASCULINO',
          fechaNacimiento: '1990-06-15',
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id');
      // jul-10 E1: nombre + apellido are transformed to UPPERCASE on create.
      expect(body.data.nombre).toBe('JUAN');
      expect(body.data.apellido).toBe('PEREZ');
      expect(body.data.estado).toBe('ACTIVO');
      createdEmployeeId = body.data.id;
    });

    test('should create an employee with nested relations', async ({ request }) => {
      const uniqueDoc = `TEST2${Date.now()}`;
      const response = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Maria',
          apellido: 'Lopez',
          tipoDocumento: 'CE',
          numeroDocumento: uniqueDoc,
          genero: 'FEMENINO',
          fechaNacimiento: '1985-03-20',
          telefono: '3001234567',
          email: 'maria.lopez@test.com',
          cargos: [
            {
              fechaIngreso: '2023-01-01',
              nombreCargo: 'Desarrolladora Senior',
              ubicacion: 'Bogota',
            },
          ],
          contactosEmergencia: [
            {
              nombre: 'Carlos',
              apellido: 'Lopez',
              telefono: '3007654321',
              parentesco: 'HERMANO',
            },
          ],
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data.cargos).toHaveLength(1);
      expect(body.data.cargos[0].nombreCargo).toBe('Desarrolladora Senior');
      expect(body.data.contactosEmergencia).toHaveLength(1);
      // Clean up - this employee is not used for further tests
    });

    test('should reject duplicate numeroDocumento', async ({ request }) => {
      // Use a document number that we know was just created
      const response = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Duplicate',
          apellido: 'Test',
          tipoDocumento: 'CC',
          numeroDocumento: 'SAME_DOC_123',
          genero: 'MASCULINO',
          fechaNacimiento: '1995-01-01',
        },
      });
      // First creation
      if (response.status() === 201) {
        // Try to create again with same doc
        const duplicate = await request.post(`${API_BASE}/api/v1/employees`, {
          headers: { Cookie: sessionCookie },
          data: {
            nombre: 'Other',
            apellido: 'Person',
            tipoDocumento: 'CC',
            numeroDocumento: 'SAME_DOC_123',
            genero: 'FEMENINO',
            fechaNacimiento: '1995-01-01',
          },
        });
        expect(duplicate.status()).toBe(409);
        const body = await duplicate.json();
        expect(body.message).toContain('documento');
      } else {
        // Document already exists from a prior test run
        expect(response.status()).toBe(409);
      }
    });
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/employees/:id - Get employee by ID', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/employees/1`);
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric ID', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/employees/abc`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent employee', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/employees/999999999`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(404);
    });

    test('should return full employee detail with all relations', async ({ request }) => {
      if (!createdEmployeeId) {
        test.skip();
        return;
      }
      const response = await request.get(`${API_BASE}/api/v1/employees/${createdEmployeeId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id', createdEmployeeId);
      expect(body.data).toHaveProperty('nucleoFamiliar');
      expect(body.data).toHaveProperty('contactosEmergencia');
      expect(body.data).toHaveProperty('cargos');
      expect(body.data).toHaveProperty('experienciasLaborales');
      expect(body.data).toHaveProperty('educacionIdiomas');
      expect(body.data).toHaveProperty('vehiculos');
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/employees/:id - Update employee', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/employees/1`, {
        data: { nombre: 'Updated' },
      });
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric ID', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/employees/abc`, {
        headers: { Cookie: sessionCookie },
        data: { nombre: 'Updated' },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent employee', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/employees/999999999`, {
        headers: { Cookie: sessionCookie },
        data: { nombre: 'Updated' },
      });
      expect(response.status()).toBe(404);
    });

    test('should update employee fields successfully', async ({ request }) => {
      if (!createdEmployeeId) {
        test.skip();
        return;
      }
      const response = await request.put(`${API_BASE}/api/v1/employees/${createdEmployeeId}`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'JuanActualizado',
          telefono: '3001112233',
          direccion: 'Calle 123 # 45-67',
        },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      // jul-10 E1: nombre transform applies on update too.
      expect(body.data.nombre).toBe('JUANACTUALIZADO');
      expect(body.data.telefono).toBe('3001112233');
    });

    test('should reject invalid tipoVivienda value', async ({ request }) => {
      if (!createdEmployeeId) {
        test.skip();
        return;
      }
      const response = await request.put(`${API_BASE}/api/v1/employees/${createdEmployeeId}`, {
        headers: { Cookie: sessionCookie },
        data: { tipoVivienda: 'MANSION' },
      });
      expect(response.status()).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('DELETE /api/v1/employees/:id - Soft delete employee', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.delete(`${API_BASE}/api/v1/employees/1`);
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric ID', async ({ request }) => {
      const response = await request.delete(`${API_BASE}/api/v1/employees/abc`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent employee', async ({ request }) => {
      const response = await request.delete(`${API_BASE}/api/v1/employees/999999999`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(404);
    });

    test('should soft-delete (set INACTIVO) the created employee', async ({ request }) => {
      if (!createdEmployeeId) {
        test.skip();
        return;
      }
      const response = await request.delete(`${API_BASE}/api/v1/employees/${createdEmployeeId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);

      // Verify the employee is now INACTIVO
      const getResponse = await request.get(`${API_BASE}/api/v1/employees/${createdEmployeeId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(getResponse.status()).toBe(200);
      const getBody = await getResponse.json();
      expect(getBody.data.estado).toBe('INACTIVO');
    });
  });
});
