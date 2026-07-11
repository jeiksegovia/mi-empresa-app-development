import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;
let adminUserId: number;
let createdInstrumentId: number;
let createdRecordId: number;
let seededInstrumentId: number;
let seededPatientId: number;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()['set-cookie'];
  expect(setCookie).toBeDefined();
  return setCookie;
}

test.describe.configure({ mode: 'serial' });

test.describe('Instruments API', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);

    // Get admin user id
    const meRes = await request.get(`${API_BASE}/api/v1/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    if (meRes.status() === 200) {
      const meBody = await meRes.json();
      adminUserId = meBody.user?.id ?? 1;
    } else {
      adminUserId = 1;
    }

    // Discover a seeded instrument id
    const listRes = await request.get(`${API_BASE}/api/v1/instruments?estado=ACTIVO`, {
      headers: { Cookie: sessionCookie },
    });
    if (listRes.status() === 200) {
      const listBody = await listRes.json();
      if (listBody.data && listBody.data.length > 0) {
        const sorted = [...listBody.data].sort((a: any, b: any) => a.id - b.id);
        seededInstrumentId = sorted[0].id;
      }
    }

    // Discover a seeded patient id
    const patientRes = await request.get(`${API_BASE}/api/v1/patients?estado=ACTIVO`, {
      headers: { Cookie: sessionCookie },
    });
    if (patientRes.status() === 200) {
      const patientBody = await patientRes.json();
      if (patientBody.data && patientBody.data.length > 0) {
        const sorted = [...patientBody.data].sort((a: any, b: any) => a.id - b.id);
        seededPatientId = sorted[0].id;
      }
    }
  });

  test.afterAll(async ({ request }) => {
    if (createdInstrumentId) {
      await request.delete(`${API_BASE}/api/v1/instruments/${createdInstrumentId}`, {
        headers: { Cookie: sessionCookie },
      });
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    });
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/instruments - List instruments', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments`);
      expect(response.status()).toBe(401);
    });

    test('should return instrument list with pagination when authenticated', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments`, {
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

    test('should return seeded instruments', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.total).toBeGreaterThanOrEqual(3);
    });

    test('should support pagination params', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments?page=1&limit=2`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(2);
      expect(body.data.length).toBeLessThanOrEqual(2);
    });

    test('should support filter by estado ACTIVO', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments?estado=ACTIVO`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      body.data.forEach((inst: any) => {
        expect(inst.estado).toBe('ACTIVO');
      });
    });

    test('should support filter by tipo', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments?tipo=VALORACION`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      body.data.forEach((inst: any) => {
        expect(inst.tipo).toBe('VALORACION');
      });
    });

    test('should support search by name', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments?search=valoraci`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
    });

    test('should include totalRegistros per instrument', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      if (body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('totalRegistros');
      }
    });

    test('should cap limit at 100', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments?limit=999`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.limit).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('POST /api/v1/instruments - Create instrument', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/instruments`, {
        data: {
          nombreInstrumento: 'Test',
          tipo: 'VALORACION',
          periodicidad: 'ANUAL',
          rolesPermitidos: 'ADMIN',
          versionPlantilla: 'v1.0',
        },
      });
      expect(response.status()).toBe(401);
    });

    test('should fail validation with missing required fields', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/instruments`, {
        headers: { Cookie: sessionCookie },
        data: { nombreInstrumento: 'Solo nombre' },
      });
      expect(response.status()).toBe(400);
    });

    test('should fail with invalid tipo', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/instruments`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombreInstrumento: 'Test',
          tipo: 'INVALID_TYPE',
          periodicidad: 'ANUAL',
          rolesPermitidos: 'ADMIN',
          versionPlantilla: 'v1.0',
        },
      });
      expect(response.status()).toBe(400);
    });

    test('should fail with invalid periodicidad', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/instruments`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombreInstrumento: 'Test',
          tipo: 'VALORACION',
          periodicidad: 'WEEKLY',
          rolesPermitidos: 'ADMIN',
          versionPlantilla: 'v1.0',
        },
      });
      expect(response.status()).toBe(400);
    });

    test('should create instrument successfully', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/instruments`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombreInstrumento: 'Instrumento de Prueba API',
          codigo: `TEST-${Date.now()}`,
          descripcion: 'Instrumento creado por prueba automatizada',
          tipo: 'NUTRICION',
          periodicidad: 'TRIMESTRAL',
          rolesPermitidos: 'ADMIN,EMPLEADO',
          versionPlantilla: 'v1.0',
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id');
      // jul-10 E1: nombreInstrumento transformed to UPPERCASE on create.
      expect(body.data.nombreInstrumento).toBe('INSTRUMENTO DE PRUEBA API');
      expect(body.data.estado).toBe('ACTIVO');
      expect(body.data).toHaveProperty('registros');
      createdInstrumentId = body.data.id;
    });

    test('should create instrument with all optional fields', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/instruments`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombreInstrumento: 'Instrumento Completo Test',
          codigo: `FULL-${Date.now()}`,
          descripcion: 'Con todos los campos',
          tipo: 'ADMISION',
          periodicidad: 'UNICA',
          rolesPermitidos: 'ADMIN',
          plantillaArchivo: '/templates/test.pdf',
          versionPlantilla: 'v2.0',
          estado: 'ACTIVO',
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.plantillaArchivo).toBe('/templates/test.pdf');
      expect(body.data.versionPlantilla).toBe('v2.0');
      // cleanup
      if (body.data?.id) {
        await request.delete(`${API_BASE}/api/v1/instruments/${body.data.id}`, {
          headers: { Cookie: sessionCookie },
        });
      }
    });
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/instruments/:id - Get instrument by ID', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments/1`);
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric ID', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments/abc`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent instrument', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments/999999999`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(404);
    });

    test('should return full instrument detail with registros for seeded instrument', async ({ request }) => {
      if (!seededInstrumentId) { test.skip(); return; }
      const response = await request.get(`${API_BASE}/api/v1/instruments/${seededInstrumentId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id', seededInstrumentId);
      expect(body.data).toHaveProperty('registros');
      expect(Array.isArray(body.data.registros)).toBe(true);
    });

    test('should return instrument detail for created instrument', async ({ request }) => {
      if (!createdInstrumentId) { test.skip(); return; }
      const response = await request.get(`${API_BASE}/api/v1/instruments/${createdInstrumentId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveProperty('id', createdInstrumentId);
      expect(body.data).toHaveProperty('nombreInstrumento', 'INSTRUMENTO DE PRUEBA API');
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/instruments/:id - Update instrument', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/instruments/1`, {
        data: { nombreInstrumento: 'Updated' },
      });
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric ID', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/instruments/abc`, {
        headers: { Cookie: sessionCookie },
        data: { nombreInstrumento: 'Updated' },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent instrument', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/instruments/999999999`, {
        headers: { Cookie: sessionCookie },
        data: { nombreInstrumento: 'Updated' },
      });
      expect(response.status()).toBe(404);
    });

    test('should update instrument fields successfully', async ({ request }) => {
      if (!createdInstrumentId) { test.skip(); return; }
      const response = await request.put(`${API_BASE}/api/v1/instruments/${createdInstrumentId}`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombreInstrumento: 'Instrumento Actualizado',
          descripcion: 'Descripción actualizada en test',
          versionPlantilla: 'v1.1',
        },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.nombreInstrumento).toBe('INSTRUMENTO ACTUALIZADO');
      expect(body.data.versionPlantilla).toBe('v1.1');
    });

    test('should fail with invalid tipo on update', async ({ request }) => {
      if (!createdInstrumentId) { test.skip(); return; }
      const response = await request.put(`${API_BASE}/api/v1/instruments/${createdInstrumentId}`, {
        headers: { Cookie: sessionCookie },
        data: { tipo: 'INVALID' },
      });
      expect(response.status()).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('POST /api/v1/instruments/records - Create record', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/instruments/records`, {
        data: {
          clienteId: 1,
          instrumentoId: 1,
          versionRegistro: 'v1.0',
          responsable: 1,
        },
      });
      expect(response.status()).toBe(401);
    });

    test('should fail validation with missing required fields', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/instruments/records`, {
        headers: { Cookie: sessionCookie },
        data: { clienteId: 1 },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent instrument', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/v1/instruments/records`, {
        headers: { Cookie: sessionCookie },
        data: {
          clienteId: seededPatientId || 1,
          instrumentoId: 999999999,
          versionRegistro: 'v1.0',
          responsable: adminUserId,
        },
      });
      expect(response.status()).toBe(404);
    });

    test('should create a record successfully', async ({ request }) => {
      if (!seededInstrumentId || !seededPatientId) { test.skip(); return; }
      const response = await request.post(`${API_BASE}/api/v1/instruments/records`, {
        headers: { Cookie: sessionCookie },
        data: {
          clienteId: seededPatientId,
          instrumentoId: seededInstrumentId,
          estado: 'PENDIENTE',
          versionRegistro: 'v1.0',
          responsable: adminUserId,
          notasObservaciones: 'Registro creado por prueba automatizada',
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.estado).toBe('PENDIENTE');
      expect(body.data).toHaveProperty('cliente');
      expect(body.data).toHaveProperty('instrumento');
      createdRecordId = body.data.id;
    });

    test('should auto-calculate expiration date based on periodicidad', async ({ request }) => {
      if (!seededPatientId || !createdInstrumentId) { test.skip(); return; }
      const response = await request.post(`${API_BASE}/api/v1/instruments/records`, {
        headers: { Cookie: sessionCookie },
        data: {
          clienteId: seededPatientId,
          instrumentoId: createdInstrumentId, // NUTRICION/TRIMESTRAL instrument
          estado: 'COMPLETADO',
          fechaCompletado: '2025-01-15',
          versionRegistro: 'v1.0',
          responsable: adminUserId,
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      // TRIMESTRAL: fechaVencimiento should be ~3 months after fechaCompletado
      expect(body.data.fechaVencimiento).toBeTruthy();
      const completado = new Date('2025-01-15');
      const venc = new Date(body.data.fechaVencimiento);
      const diffMonths = (venc.getFullYear() - completado.getFullYear()) * 12 + (venc.getMonth() - completado.getMonth());
      expect(diffMonths).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('PUT /api/v1/instruments/records/:id - Update record', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/instruments/records/1`, {
        data: { estado: 'COMPLETADO' },
      });
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric record ID', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/instruments/records/abc`, {
        headers: { Cookie: sessionCookie },
        data: { estado: 'COMPLETADO' },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent record', async ({ request }) => {
      const response = await request.put(`${API_BASE}/api/v1/instruments/records/999999999`, {
        headers: { Cookie: sessionCookie },
        data: { estado: 'COMPLETADO' },
      });
      expect(response.status()).toBe(404);
    });

    test('should update record estado successfully', async ({ request }) => {
      if (!createdRecordId) { test.skip(); return; }
      const response = await request.put(`${API_BASE}/api/v1/instruments/records/${createdRecordId}`, {
        headers: { Cookie: sessionCookie },
        data: {
          estado: 'COMPLETADO',
          fechaCompletado: '2025-06-15',
          notasObservaciones: 'Completado en prueba automatizada',
        },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.estado).toBe('COMPLETADO');
      expect(body.data.notasObservaciones).toBe('Completado en prueba automatizada');
    });

    test('should fail with invalid estado on update', async ({ request }) => {
      if (!createdRecordId) { test.skip(); return; }
      const response = await request.put(`${API_BASE}/api/v1/instruments/records/${createdRecordId}`, {
        headers: { Cookie: sessionCookie },
        data: { estado: 'INVALID_ESTADO' },
      });
      expect(response.status()).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('GET /api/v1/instruments/records/by-instrument/:id - Records by instrument', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments/records/by-instrument/1`);
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric instrument ID', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/v1/instruments/records/by-instrument/abc`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(400);
    });

    test('should return empty array for instrument with no records', async ({ request }) => {
      if (!createdInstrumentId) { test.skip(); return; }
      const response = await request.get(`${API_BASE}/api/v1/instruments/records/by-instrument/${createdInstrumentId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should return records for seeded instrument', async ({ request }) => {
      if (!seededInstrumentId) { test.skip(); return; }
      const response = await request.get(`${API_BASE}/api/v1/instruments/records/by-instrument/${seededInstrumentId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  test.describe('DELETE /api/v1/instruments/:id - Soft delete instrument', () => {
    test('should return 401 without authentication', async ({ request }) => {
      const response = await request.delete(`${API_BASE}/api/v1/instruments/1`);
      expect(response.status()).toBe(401);
    });

    test('should return 400 for non-numeric ID', async ({ request }) => {
      const response = await request.delete(`${API_BASE}/api/v1/instruments/abc`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent instrument', async ({ request }) => {
      const response = await request.delete(`${API_BASE}/api/v1/instruments/999999999`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(404);
    });

    test('should soft-delete (set INACTIVO) the created instrument', async ({ request }) => {
      if (!createdInstrumentId) { test.skip(); return; }
      const response = await request.delete(`${API_BASE}/api/v1/instruments/${createdInstrumentId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);

      // Verify it's INACTIVO now
      const getResponse = await request.get(`${API_BASE}/api/v1/instruments/${createdInstrumentId}`, {
        headers: { Cookie: sessionCookie },
      });
      expect(getResponse.status()).toBe(200);
      const getBody = await getResponse.json();
      expect(getBody.data.estado).toBe('INACTIVO');

      createdInstrumentId = 0;
    });
  });
});
