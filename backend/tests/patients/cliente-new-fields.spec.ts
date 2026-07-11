/**
 * LOCAL QA — jul-9 (W4 — T13): B3/B4/B5 — cliente new fields:
 *   - fechaCumpleanos (optional, ISO date string)
 *   - tipoSangre (optional, enum: A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG)
 *   - eps (optional, VARCHAR(200))
 *
 * Reference: `schema-contract-jul9.md` §5.1 (Cliente — added fields).
 *
 * Test pattern: POST then GET → assert round-trip equality; verify Zod rejects
 * invalid enum values.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Cliente new fields (jul-9 B3/B4/B5)', () => {
  let createdPatientId = 0;

  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);
  });

  test.afterAll(async ({ request }) => {
    if (createdPatientId) {
      await request.delete(`${API_BASE}/api/v1/patients/${createdPatientId}`, {
        headers: { Cookie: sessionCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    }).catch(() => {});
  });

  test('POST /patients with fechaCumpleanos + tipoSangre + eps → 201 with round-trip', async ({ request }) => {
    const uniq = `NEWCL${Date.now()}`;
    const res = await request.post(`${API_BASE}/api/v1/patients`, {
      headers: { Cookie: sessionCookie },
      data: {
        nombre: 'Cliente Cumple',
        tipoDocumento: 'CC',
        numeroDocumento: uniq,
        genero: 'Femenino',
        fechaNacimiento: '1985-08-20',
        fechaCumpleanos: '1990-08-20',
        tipoSangre: 'O_POS',
        eps: 'Sura Póliza 12345',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data.fechaCumpleanos).toContain('1990-08-20');
    expect(body.data.tipoSangre).toBe('O_POS');
    expect(body.data.eps).toBe('Sura Póliza 12345');
    createdPatientId = body.data.id;
  });

  test('PUT /patients/:id updates fechaCumpleanos + tipoSangre + eps → 200 with round-trip', async ({ request }) => {
    if (!createdPatientId) { test.skip(); return; }
    const res = await request.put(`${API_BASE}/api/v1/patients/${createdPatientId}`, {
      headers: { Cookie: sessionCookie },
      data: {
        fechaCumpleanos: '1992-12-15',
        tipoSangre: 'AB_NEG',
        eps: 'Nueva EPS',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.fechaCumpleanos).toContain('1992-12-15');
    expect(body.data.tipoSangre).toBe('AB_NEG');
    expect(body.data.eps).toBe('Nueva EPS');
  });

  test('POST /patients with invalid tipoSangre → 400', async ({ request }) => {
    const uniq = `BADCL${Date.now()}`;
    const res = await request.post(`${API_BASE}/api/v1/patients`, {
      headers: { Cookie: sessionCookie },
      data: {
        nombre: 'Cliente Invalido',
        tipoDocumento: 'CC',
        numeroDocumento: uniq,
        genero: 'Masculino',
        fechaNacimiento: '1990-01-01',
        // 'X_POS' is NOT a valid TipoSangre enum value
        tipoSangre: 'X_POS',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('PUT /patients/:id with invalid tipoSangre value → 400', async ({ request }) => {
    if (!createdPatientId) { test.skip(); return; }
    const res = await request.put(`${API_BASE}/api/v1/patients/${createdPatientId}`, {
      headers: { Cookie: sessionCookie },
      data: { tipoSangre: 'Z_NEVER' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST without new fields is valid (backward compatible)', async ({ request }) => {
    const uniq = `OLDCM${Date.now()}`;
    const res = await request.post(`${API_BASE}/api/v1/patients`, {
      headers: { Cookie: sessionCookie },
      data: {
        nombre: 'Cliente Sin Nuevos',
        tipoDocumento: 'CC',
        numeroDocumento: uniq,
        genero: 'Masculino',
        fechaNacimiento: '1990-01-01',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.fechaCumpleanos).toBeNull();
    expect(body.data.tipoSangre).toBeNull();
    expect(body.data.eps).toBeNull();

    // Cleanup the secondary patient
    await request.delete(`${API_BASE}/api/v1/patients/${body.data.id}`, {
      headers: { Cookie: sessionCookie },
    }).catch(() => {});
  });
});
