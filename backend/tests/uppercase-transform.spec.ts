/**
 * LOCAL QA — jul-10 (W3 — T7): E1 Zod uppercase-transform on entity nombre fields.
 *
 * Reference: schema-contract-jul10.md §4 — `.transform(v => v.trim().toUpperCase())`
 * applied at the API layer (create + update) on:
 *   - CertificadoEmpresa.nombre
 *   - Instrumento.nombreInstrumento
 *   - Cliente.nombre
 *   - Empleado.nombre, Empleado.apellido
 *   - Empresa.nombre
 *
 * NOT transformed: descripcion, notas, CargoEmpresa.nombre.
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

test.describe.configure({ mode: 'serial' });

test.describe('E1 uppercase transform (jul-10)', () => {
  let adminCookie: string;
  const uniq = Date.now();
  const createdIds = { cert: 0, instrument: 0, client: 0, employee: 0 };

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    adminCookie = loginRes.headers()['set-cookie'];
  });

  test.afterAll(async ({ request }) => {
    if (createdIds.cert) {
      await request.delete(`${API_BASE}/api/v1/certificates/${createdIds.cert}`, { headers: { Cookie: adminCookie } }).catch(() => {});
    }
    if (createdIds.instrument) {
      await request.delete(`${API_BASE}/api/v1/instruments/${createdIds.instrument}`, { headers: { Cookie: adminCookie } }).catch(() => {});
    }
    if (createdIds.client) {
      await request.delete(`${API_BASE}/api/v1/patients/${createdIds.client}`, { headers: { Cookie: adminCookie } }).catch(() => {});
    }
    if (createdIds.employee) {
      await request.delete(`${API_BASE}/api/v1/employees/${createdIds.employee}`, { headers: { Cookie: adminCookie } }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: adminCookie } }).catch(() => {});
  });

  test('POST /certificates with lowercase nombre → UPPERCASE; descripcion preserved', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/certificates`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: `  prueba minuscula e1 ${uniq}  `,
        descripcion: 'preserva minuscula e1',
        tipoCertificado: 'TRIBUTARIOS',
        periodicidad: 'UNICA',
        fechaEmision: '2026-07-10',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.nombre).toBe(`PRUEBA MINUSCULA E1 ${uniq}`);
    expect(body.data.descripcion).toBe('preserva minuscula e1');
    createdIds.cert = body.data.id;
  });

  test('POST /instruments with lowercase nombreInstrumento → UPPERCASE', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: { Cookie: adminCookie },
      data: {
        nombreInstrumento: `  minimo valoracion e1 ${uniq}  `,
        descripcion: 'preserva minuscula instr',
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'ADMIN,EMPLEADO',
        versionPlantilla: 'v1.0',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.nombreInstrumento).toBe(`MINIMO VALORACION E1 ${uniq}`);
    expect(body.data.descripcion).toBe('preserva minuscula instr');
    createdIds.instrument = body.data.id;
  });

  test('POST /patients with lowercase nombre → UPPERCASE; notas preserved', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/patients`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: `  maria e1 ${uniq}  `,
        tipoDocumento: 'CC',
        numeroDocumento: `E1-${uniq}`,
        genero: 'FEMENINO',
        fechaNacimiento: '1990-01-01',
        notas: 'preserva minuscula paciente',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.nombre).toBe(`MARIA E1 ${uniq}`);
    expect(body.data.notas).toBe('preserva minuscula paciente');
    createdIds.client = body.data.id;
  });

  test('POST /employees with lowercase nombre+apellido → UPPERCASE', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: `  juan e1 ${uniq}  `,
        apellido: `  perez e1 ${uniq}  `,
        tipoDocumento: 'CC',
        numeroDocumento: `E1EMP-${uniq}`,
        genero: 'MASCULINO',
        fechaNacimiento: '1990-01-01',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.nombre).toBe(`JUAN E1 ${uniq}`);
    expect(body.data.apellido).toBe(`PEREZ E1 ${uniq}`);
    createdIds.employee = body.data.id;
  });

  test('PUT /empresa/6 with lowercase nombre → UPPERCASE', async ({ request }) => {
    // Empresa PUT always returns the same row; do a no-op reset after to avoid drift.
    const before = await request.get(`${API_BASE}/api/v1/empresa`, { headers: { Cookie: adminCookie } });
    const original = (await before.json()).data.nombre;
    try {
      const res = await request.put(`${API_BASE}/api/v1/empresa/6`, {
        headers: { Cookie: adminCookie },
        data: { nombre: `  mi empresa e1 test ${uniq}  ` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.nombre).toBe(`MI EMPRESA E1 TEST ${uniq}`);
    } finally {
      // restore original nombre
      await request.put(`${API_BASE}/api/v1/empresa/6`, {
        headers: { Cookie: adminCookie },
        data: { nombre: original },
      }).catch(() => {});
    }
  });
});
