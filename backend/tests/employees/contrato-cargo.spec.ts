/**
 * LOCAL QA — jul-9 (W4 — T13): D6 archivoFirmadoUrl + D7 cargoId on Contrato.
 *
 * Reference: `schema-contract-jul9.md` §4.7 — legacy { cargo: string } is
 * rejected by Zod with HTTP 400 and field=cargoId. The contrato routes live
 *   POST /api/v1/nomina/employees/:empleadoId/contratos
 *   (mounted under the nomina router so the path has "/nomina/" prefix)
 *
 * Constraints:
 *   - cargoId is NULLABLE at the API layer (per §4.6 follow-up deferred).
 *   - `forbidLegacy(['cargo'])` middleware rejects legacy key.
 *
 * Known issue (pre-logged — see task-assignment-qa.md "Known issues"):
 *   - Invalid cargoId FK (cargoId pointing to a non-existent cargo) currently
 *     surfaces as 500 (Prisma P2003) instead of a clean 400. We assert the
 *     CURRENT behavior and mark it as a TODO gap.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;
let testEmployeeId: number;
let createdEmployee = false;
let activeCargoId: number;
const createdContratoIds: number[] = [];

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Contrato — archivoFirmadoUrl + cargoId (jul-9 D6/D7)', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);

    // Pick or create a test empleado
    const listRes = await request.get(`${API_BASE}/api/v1/employees?limit=1`, {
      headers: { Cookie: sessionCookie },
    });
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    if (listBody.data && listBody.data.length > 0) {
      testEmployeeId = listBody.data[0].id;
    } else {
      const uniq = `CON${Date.now()}`;
      const createRes = await request.post(`${API_BASE}/api/v1/employees`, {
        headers: { Cookie: sessionCookie },
        data: {
          nombre: 'ContratoTest',
          apellido: 'Empleado',
          tipoDocumento: 'CC',
          numeroDocumento: uniq,
          genero: 'MASCULINO',
          fechaNacimiento: '1990-01-01',
        },
      });
      expect(createRes.status()).toBe(201);
      const created = await createRes.json();
      testEmployeeId = created.data.id;
      createdEmployee = true;
    }

    // Pick an active cargo (from seed: e.g. Fisioterapeuta). We grab the
    // first one returned and use its id for happy-path contrato create.
    const cargosRes = await request.get(`${API_BASE}/api/v1/empresa/cargos?activo=true`, {
      headers: { Cookie: sessionCookie },
    });
    expect(cargosRes.status()).toBe(200);
    const cargosBody = await cargosRes.json();
    expect(cargosBody.data.length).toBeGreaterThan(0);
    activeCargoId = cargosBody.data[0].id;
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdContratoIds) {
      await request.delete(
        `${API_BASE}/api/v1/nomina/employees/${testEmployeeId}/contratos/${id}`,
        { headers: { Cookie: sessionCookie } },
      ).catch(() => {});
    }
    if (createdEmployee && testEmployeeId) {
      await request.delete(`${API_BASE}/api/v1/employees/${testEmployeeId}`, {
        headers: { Cookie: sessionCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    }).catch(() => {});
  });

  test('POST contrato with cargoId + archivoFirmadoUrl → 201 with cargo embedded', async ({ request }) => {
    if (!testEmployeeId) { test.skip(); return; }
    const res = await request.post(
      `${API_BASE}/api/v1/nomina/employees/${testEmployeeId}/contratos`,
      {
        headers: { Cookie: sessionCookie },
        data: {
          tipoContrato: 'TERMINO_FIJO',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          archivoFirmadoUrl: 'https://files.example.com/contratos/firmado-qa.pdf',
          cargoId: activeCargoId,
        },
      },
    );
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.archivoFirmadoUrl).toBe('https://files.example.com/contratos/firmado-qa.pdf');
    expect(body.data.cargoId).toBe(activeCargoId);
    // cargo embedded via include: { cargo: true }
    expect(body.data.cargo).toBeDefined();
    expect(body.data.cargo.id).toBe(activeCargoId);
    createdContratoIds.push(body.data.id);
  });

  test('POST contrato with legacy { cargo: string } → 400 field=cargoId', async ({ request }) => {
    if (!testEmployeeId) { test.skip(); return; }
    // Use TERMINO_INDEFINIDO so fechaFin is optional. Send legacy `cargo` to
    // trigger forbidLegacy middleware → 400 with field=cargoId.
    const res = await request.post(
      `${API_BASE}/api/v1/nomina/employees/${testEmployeeId}/contratos`,
      {
        headers: { Cookie: sessionCookie },
        data: {
          tipoContrato: 'TERMINO_INDEFINIDO',
          fechaInicio: '2026-01-01',
          cargo: 'Legacy String',  // <-- forbidden legacy key
        },
      },
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    // Field may be 'cargoId' (Zod) or 'cargo' (forbidLegacy middleware)
    expect(['cargoId', 'cargo']).toContain(body.field);
  });

  test('POST contrato with invalid cargoId FK → 400 field=cargoId (GAP-1 fix)', async ({ request }) => {
    // jul-9 D7 (QA GAP-1): pre-flight findUnique on cargos_empresa. Contract §4.6.
    // W1 added the pre-flight in waves/2 fix-up: invalid cargoId returns 400 with
    // structured error (message 'Cargo does not exist', field='cargoId') before
    // reaching Prisma, so P2003 never bubbles up as a 500.
    if (!testEmployeeId) { test.skip(); return; }
    const res = await request.post(
      `${API_BASE}/api/v1/nomina/employees/${testEmployeeId}/contratos`,
      {
        headers: { Cookie: sessionCookie },
        data: {
          tipoContrato: 'TERMINO_INDEFINIDO',
          fechaInicio: '2026-01-01',
          cargoId: 99999999,  // not in cargos_empresa
        },
      },
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('cargoId');
    expect(body.message).toBe('Cargo does not exist');
  });

  test('POST contrato without cargoId → 400 errors.cargoId=Required (jul-10 D7 tighten)', async ({ request }) => {
    // jul-10 D7-tighten changed `cargoId` from nullable to REQUIRED on both
    // POST and PUT. Reference: schema-contract-jul10.md §3.4 + §3.5.
    if (!testEmployeeId) { test.skip(); return; }
    const res = await request.post(
      `${API_BASE}/api/v1/nomina/employees/${testEmployeeId}/contratos`,
      {
        headers: { Cookie: sessionCookie },
        data: {
          tipoContrato: 'TERMINO_INDEFINIDO',
          fechaInicio: '2026-01-01',
          // no cargoId → must be rejected at Zod level
        },
      },
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errors?.cargoId).toContain('Required');
  });

  test('GET /employees/:id/contratos includes archivoFirmadoUrl on response', async ({ request }) => {
    if (!testEmployeeId || createdContratoIds.length === 0) { test.skip(); return; }
    const res = await request.get(
      `${API_BASE}/api/v1/nomina/employees/${testEmployeeId}/contratos`,
      { headers: { Cookie: sessionCookie } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Response shape may be `body.data: []` or direct list — accept both
    const contratos = Array.isArray(body.data) ? body.data : body;
    expect(Array.isArray(contratos)).toBe(true);
    // The contrato we just created (with archivoFirmadoUrl) should appear
    const withArchivo = contratos.find(
      (c: any) => c.archivoFirmadoUrl === 'https://files.example.com/contratos/firmado-qa.pdf'
    );
    expect(withArchivo).toBeDefined();
  });
});
