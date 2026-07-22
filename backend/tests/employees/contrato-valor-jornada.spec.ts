import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — nomina-asistencia-jul-18: valorJornada required on contrato CREATE.
 * Self-seeds employee + cargo when seed is sparse.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
let employeeId: number;
let cargoId: number;
const createdContratoIds: number[] = [];
let createdEmployee = false;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

async function ensureCargo(request: any): Promise<number> {
  const list = await request.get(`${API_BASE}/api/v1/empresa/cargos`, {
    headers: { Cookie: adminCookie },
  });
  if (list.status() === 200) {
    const body = await list.json();
    const rows = body.data ?? [];
    if (Array.isArray(rows) && rows.length > 0) return rows[0].id;
  }
  const create = await request.post(`${API_BASE}/api/v1/empresa/cargos`, {
    headers: { Cookie: adminCookie },
    data: { nombre: `Cargo VJ ${Date.now()}` },
  });
  expect(create.status()).toBe(201);
  return (await create.json()).data.id;
}

test.describe.configure({ mode: 'serial' });

test.describe('Contrato valorJornada (jul-18)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request);

    const listRes = await request.get(`${API_BASE}/api/v1/employees?limit=1&estado=ACTIVO`, {
      headers: { Cookie: adminCookie },
    });
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    employeeId = listBody.data?.[0]?.id;
    if (!employeeId) {
      const create = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: adminCookie },
        data: {
          nombre: 'TEST',
          apellido: 'VALORJORNADA',
          tipoDocumento: 'CC',
          numeroDocumento: `8${Date.now().toString().slice(-9)}`,
          genero: 'F',
          fechaNacimiento: '1988-05-01',
        },
      });
      expect(create.status()).toBe(201);
      employeeId = (await create.json()).data.id;
      createdEmployee = true;
    }

    cargoId = await ensureCargo(request);
  });

  test.afterAll(async ({ request }) => {
    for (const cid of createdContratoIds) {
      await request.delete(`${API_BASE}/api/v1/nomina/employees/${employeeId}/contratos/${cid}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    if (createdEmployee && employeeId) {
      await request.delete(`${API_BASE}/api/v1/employees/${employeeId}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
  });

  test('POST contrato without valorJornada → 400 field valorJornada', async ({ request }) => {
    expect(employeeId && cargoId).toBeTruthy();
    const resp = await request.post(`${API_BASE}/api/v1/nomina/employees/${employeeId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'TERMINO_INDEFINIDO',
        fechaInicio: '2026-01-01',
        cargoId,
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('valorJornada');
  });

  test('POST contrato with valorJornada → 201', async ({ request }) => {
    expect(employeeId && cargoId).toBeTruthy();
    const resp = await request.post(`${API_BASE}/api/v1/nomina/employees/${employeeId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'TERMINO_INDEFINIDO',
        fechaInicio: '2026-01-01',
        cargoId,
        valorJornada: 45000,
        activo: true,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Number(body.data.valorJornada)).toBe(45000);
    createdContratoIds.push(body.data.id);
  });
});
