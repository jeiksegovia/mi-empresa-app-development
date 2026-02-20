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
  const match = setCookie.match(/session=([^;]+)/);
  expect(match).toBeTruthy();
  return setCookie;
}

test.describe.configure({ mode: 'serial' });

test.describe('Employees Full Create API', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);
  });

  test.afterAll(async ({ request }) => {
    // Soft delete the created employee
    if (createdEmployeeId) {
      await request.delete(`${API_BASE}/api/v1/employees/${createdEmployeeId}`, {
        headers: { Cookie: sessionCookie },
      });
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    });
  });

  test('should create employee with all nested relations', async ({ request }) => {
    const uniqueDoc = `FULL${Date.now()}`;
    const response = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: sessionCookie },
      data: {
        nombre: 'Carlos',
        apellido: 'Fulltest',
        tipoDocumento: 'CC',
        numeroDocumento: uniqueDoc,
        genero: 'MASCULINO',
        fechaNacimiento: '1990-01-15',
        telefono: '3001234567',
        email: `fulltest.${Date.now()}@test.com`,
        cargos: [
          {
            fechaIngreso: '2022-01-01',
            nombreCargo: 'Ingeniero Senior',
            ubicacion: 'Bogotá',
          },
        ],
        contactosEmergencia: [
          {
            nombre: 'Ana',
            apellido: 'Fulltest',
            telefono: '3007654321',
            parentesco: 'HERMANO',
          },
        ],
        nucleoFamiliar: [
          {
            nombre: 'Laura',
            apellido: 'Fulltest',
            tipoDocumento: 'CC',
            fechaNacimiento: '1992-05-10',
            genero: 'FEMENINO',
            parentesco: 'CONYUGE',
          },
        ],
        experienciasLaborales: [
          {
            empresa: 'Tech Corp',
            telefonoEmpresa: '6012345678',
            cargo: 'Developer',
            sector: 'IT',
            periodoInicio: '2018-01-01',
            periodoFin: '2021-12-31',
            funcionesLogros: 'Desarrollé sistemas críticos',
          },
        ],
        educacionIdiomas: [
          {
            institucion: 'Universidad Nacional',
            nivelEscritura: 'AVANZADO',
            nivelHabla: 'INTERMEDIO',
            capacidadTraducir: true,
          },
        ],
        vehiculos: [
          {
            tipoVehiculo: 'MOTO',
            placas: 'XYZ123',
            tipoLicencia: 'A1',
            numeroLicencia: 'LIC001',
          },
        ],
        certificadoAlturas: {
          fechaExpedicion: '2023-01-01',
          fechaVencimiento: '2026-01-01',
        },
        certificadoRiesgoElectrico: {
          fechaExpedicion: '2023-02-01',
          fechaVencimiento: '2026-02-01',
        },
        datosMigracion: {
          numeroPasaporte: 'PA123456',
          pasaporteExpedicion: '2020-01-01',
          pasaporteVencimiento: '2030-01-01',
          numeroVisa: 'VISA789',
          visaExpedicion: '2022-01-01',
          visaVencimiento: '2027-01-01',
        },
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    createdEmployeeId = body.data.id;

    // Verify nested relations in response
    expect(body.data.cargos).toHaveLength(1);
    expect(body.data.contactosEmergencia).toHaveLength(1);
    expect(body.data.nucleoFamiliar).toHaveLength(1);
    expect(body.data.experienciasLaborales).toHaveLength(1);
    expect(body.data.experienciasLaborales[0].empresa).toBe('Tech Corp');
    expect(body.data.educacionIdiomas).toHaveLength(1);
    expect(body.data.educacionIdiomas[0].institucion).toBe('Universidad Nacional');
    expect(body.data.vehiculos).toHaveLength(1);
    expect(body.data.vehiculos[0].placas).toBe('XYZ123');
    expect(body.data.certificadoAlturas).toBeTruthy();
    expect(body.data.certificadoRiesgoElectrico).toBeTruthy();
    expect(body.data.datosMigracion).toBeTruthy();
    expect(body.data.datosMigracion.numeroPasaporte).toBe('PA123456');
  });

  test('should GET employee and verify all relations persisted', async ({ request }) => {
    if (!createdEmployeeId) {
      test.skip();
      return;
    }
    const response = await request.get(`${API_BASE}/api/v1/employees/${createdEmployeeId}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.experienciasLaborales).toHaveLength(1);
    expect(body.data.educacionIdiomas).toHaveLength(1);
    expect(body.data.vehiculos).toHaveLength(1);
    expect(body.data.certificadoAlturas).not.toBeNull();
    expect(body.data.certificadoRiesgoElectrico).not.toBeNull();
    expect(body.data.datosMigracion).not.toBeNull();
  });
});
