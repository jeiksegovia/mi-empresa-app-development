import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;
let createdPatientId: number;
let seededPatientId: number;

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

// Run serially to share login session and avoid concurrent login conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Patients API', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);

    // Discover a real seeded patient id (oldest/lowest id that is ACTIVO)
    const listRes = await request.get(`${API_BASE}/api/v1/patients?estado=ACTIVO`, {
      headers: { Cookie: sessionCookie },
    });
    if (listRes.status() === 200) {
      const listBody = await listRes.json();
      if (listBody.data && listBody.data.length > 0) {
        // Pick the patient with the lowest id (earliest seeded)
        const sorted = [...listBody.data].sort((a: any, b: any) => a.id - b.id);
        seededPatientId = sorted[0].id;
      }
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: soft-delete the created patient if it still exists
    if (createdPatientId) {
      await request.delete(`${API_BASE}/api/v1/patients/${createdPatientId}`, {
        headers: { Cookie: sessionCookie },
      });
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    });
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/patients - List patients', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/patients`);
      expect(response.status()).toBe(401);
    });

    test('should return patient list with pagination when authenticated', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/patients`, {
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
      const response = await request.get(`${API_BASE}/api/v1/patients?page=1&limit=5`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(5);
      expect(body.data.length).toBeLessThanOrEqual(5);
    });

    test('should support search by name', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/patients?search=pedro`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
    });

    test('should support filter by estado ACTIVO', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/patients?estado=ACTIVO`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      body.data.forEach((p: any) => {
        expect(p.estado).toBe('ACTIVO');
      });
    });

    test('should cap limit at 100', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/patients?limit=999`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.limit).toBe(100);
    });

    test('should include totalFichas and fichasPendientes per patient', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      if (body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('totalFichas');
        expect(body.data[0]).toHaveProperty('fichasPendientes');
      }
    });
  });

  // -----------------------------------------------------------------------
  test.describe('POST /api/v1/patients - Create patient', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/patients`, {
        data: {
          nombre: 'Test Paciente',
          tipoDocumento: 'CC',
          numeroDocumento: '99999999',
          genero: 'Masculino',
          fechaNacimiento: '1990-01-01',
        },
      });
      expect(response.status()).toBe(401);
    });

    test('should fail validation with missing required fields', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: sessionCookie },
        data: { nombre: 'Solo nombre' },
      });
      expect(response.status()).toBe(400);
    });

    test('should fail with invalid tipoDocumento', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Test Paciente',
          tipoDocumento: 'INVALID',
          numeroDocumento: '99999999',
          genero: 'Masculino',
          fechaNacimiento: '1990-01-01',
        },
      });
      expect(response.status()).toBe(400);
    });

    test('should fail with invalid email', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Test Paciente',
          tipoDocumento: 'CC',
          numeroDocumento: '12345678',
          genero: 'Masculino',
          fechaNacimiento: '1990-01-01',
          // still has @ so it is not treated as a leftover placeholder
          email: 'not-an-email@',
        },
      });
      expect(response.status()).toBe(400);
    });

    test('sep-11: blank / whitespace / no-@ placeholder email is omitted → 201', async ({ request }) => {
      const cases = ['', '   ', 'correo', 'ejemplo@correo']
      // last one HAS @ and looks like an email — that one must still 201 if valid.
      // Split: placeholders without @ vs a real-looking email.
      for (const email of ['', '   ', 'correo']) {
        const uniqueDoc = `PATMAIL${Date.now()}${Math.floor(Math.random() * 999)}`
        const response = await request.post(`${API_BASE}/api/v1/patients`, {
          headers: { Cookie: sessionCookie },
          data: {
            nombre: 'Email Coerce',
            tipoDocumento: 'CC',
            numeroDocumento: uniqueDoc,
            genero: 'Femenino',
            fechaNacimiento: '1991-02-02',
            email,
          },
        })
        expect(response.status(), `email=${JSON.stringify(email)} ${await response.text()}`).toBe(201)
        const body = await response.json()
        expect(body.data.email == null || body.data.email === '').toBeTruthy()
        if (body.data.id) {
          await request.delete(`${API_BASE}/api/v1/patients/${body.data.id}`, {
            headers: { Cookie: sessionCookie },
          })
        }
      }
    })

    test('should create a patient successfully with minimal fields', async ({ request }) => {
      const uniqueDoc = `PAT${Date.now()}`;
      const response = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Carlos Paciente',
          tipoDocumento: 'CC',
          numeroDocumento: uniqueDoc,
          genero: 'Masculino',
          fechaNacimiento: '1985-03-20',
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id');
      // jul-10 E1: nombre transformed to UPPERCASE on create.
      expect(body.data.nombre).toBe('CARLOS PACIENTE');
      expect(body.data.estado).toBe('ACTIVO');
      expect(body.data).toHaveProperty('contactosEmergencia');
      expect(body.data).toHaveProperty('registrosFichas');
      expect(body.data).toHaveProperty('notasCliente');
      createdPatientId = body.data.id;
    });

    test('should create a patient with contactosEmergencia', async ({ request }) => {
      const uniqueDoc = `PAT2${Date.now()}`;
      const response = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Maria Paciente',
          tipoDocumento: 'CE',
          numeroDocumento: uniqueDoc,
          genero: 'Femenino',
          fechaNacimiento: '1990-07-10',
          telefono: '3001234567',
          email: 'maria.paciente@test.com',
          notas: 'Paciente con notas de prueba',
          contactosEmergencia: [
            {
              nombre: 'Juan Familiar',
              telefono: '3009876543',
              parentesco: 'esposo',
            },
          ],
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data.contactosEmergencia).toHaveLength(1);
      expect(body.data.contactosEmergencia[0].nombre).toBe('Juan Familiar');
      // Clean up this secondary patient
      if (body.data.id) {
        await request.delete(`${API_BASE}/api/v1/patients/${body.data.id}`, {
          headers: { Cookie: sessionCookie },
        });
      }
    });

    test('should reject duplicate numeroDocumento', async ({ request }) => {
      const uniqueDoc = `DUPAT${Date.now()}`;
      // First creation
      const first = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Primero',
          tipoDocumento: 'CC',
          numeroDocumento: uniqueDoc,
          genero: 'Masculino',
          fechaNacimiento: '1990-01-01',
        },
      });
      expect(first.status()).toBe(201);
      const firstBody = await first.json();

      // Second creation with same document
      const duplicate = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Duplicado',
          tipoDocumento: 'CC',
          numeroDocumento: uniqueDoc,
          genero: 'Masculino',
          fechaNacimiento: '1990-01-01',
        },
      });
      expect(duplicate.status()).toBe(409);
      const dupBody = await duplicate.json();
      expect(dupBody.message).toContain('documento');

      // Cleanup first patient
      if (firstBody.data?.id) {
        await request.delete(`${API_BASE}/api/v1/patients/${firstBody.data.id}`, {
          headers: { Cookie: sessionCookie },
        });
      }
    });
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/patients/:id - Get patient by ID', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/patients/1`);
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric ID', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/patients/abc`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent patient', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/patients/999999999`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(404);
    });

    test('should return full patient detail with all relations for seeded patient', async ({ request }) => {
      if (!seededPatientId) {
        test.skip();
        return;
      }
      const response = await request.get(`${API_BASE}/api/v1/patients/${seededPatientId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id', seededPatientId);
      expect(body.data).toHaveProperty('contactosEmergencia');
      expect(body.data).toHaveProperty('registrosFichas');
      expect(body.data).toHaveProperty('notasCliente');
      expect(Array.isArray(body.data.contactosEmergencia)).toBe(true);
      expect(Array.isArray(body.data.registrosFichas)).toBe(true);
      expect(Array.isArray(body.data.notasCliente)).toBe(true);
    });

    test('should return full patient detail for created patient', async ({ request }) => {
      if (!createdPatientId) {
        test.skip();
        return;
      }
      const response = await request.get(`${API_BASE}/api/v1/patients/${createdPatientId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id', createdPatientId);
      expect(body.data).toHaveProperty('contactosEmergencia');
      expect(body.data).toHaveProperty('registrosFichas');
      expect(body.data).toHaveProperty('notasCliente');
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/patients/:id - Update patient', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/patients/1`, {
        data: { nombre: 'Actualizado' },
      });
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric ID', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/patients/abc`, {
        headers: { Cookie: sessionCookie },
        data: { nombre: 'Actualizado' },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent patient', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/patients/999999999`, {
        headers: { Cookie: sessionCookie },
        data: { nombre: 'Actualizado' },
      });
      expect(response.status()).toBe(404);
    });

    test('should update patient fields successfully', async ({ request }) => {
      if (!createdPatientId) {
        test.skip();
        return;
      }
      const response = await request.put(`${API_BASE}/api/v1/patients/${createdPatientId}`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'Carlos Actualizado',
          telefono: '3009998877',
          notas: 'Nota actualizada en el test',
        },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      // jul-10 E1: nombre transform applies on update too.
      expect(body.data.nombre).toBe('CARLOS ACTUALIZADO');
      expect(body.data.telefono).toBe('3009998877');
      expect(body.data.notas).toBe('Nota actualizada en el test');
    });

    test('should fail with invalid tipoDocumento on update', async ({ request }) => {
      if (!createdPatientId) {
        test.skip();
        return;
      }
      const response = await request.put(`${API_BASE}/api/v1/patients/${createdPatientId}`, {
        headers: { Cookie: sessionCookie },
        data: { tipoDocumento: 'INVALIDO' },
      });
      expect(response.status()).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('DELETE /api/v1/patients/:id - Soft delete patient', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.delete(`${API_BASE}/api/v1/patients/1`);
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric ID', async ({ request }) => {
      const response = await request.delete(`${API_BASE}/api/v1/patients/abc`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent patient', async ({ request }) => {
      const response = await request.delete(`${API_BASE}/api/v1/patients/999999999`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(404);
    });

    test('should soft-delete (set INACTIVO) the created patient', async ({ request }) => {
      if (!createdPatientId) {
        test.skip();
        return;
      }
      const response = await request.delete(`${API_BASE}/api/v1/patients/${createdPatientId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);

      // Verify the patient is now INACTIVO
      const getResponse = await request.get(`${API_BASE}/api/v1/patients/${createdPatientId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(getResponse.status()).toBe(200);
      const getBody = await getResponse.json();
      expect(getBody.data.estado).toBe('INACTIVO');

      // Reset so afterAll cleanup is skipped for this patient (already deleted)
      createdPatientId = 0;
    });
  });
});
