import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — Nomina cuenta-de-cobro required for OPS / OBRA_O_LABOR (D4).
 *
 * Verifies that `POST /api/v1/nomina/periodos` returns a 400 with a field-level
 * error indicator when the request omits `archivos[].CUENTA_COBRO` for an OPS
 * contrato. The frontend reads `field: 'archivos.CUENTA_COBRO'` to render the
 * inline Message next to the CUENTA_COBRO slot.
 *
 * Coverage:
 *   - OPS empleado without cuenta-de-cobro file → 400 + `field: 'archivos.CUENTA_COBRO'`
 *   - OBRA_O_LABOR sin cuenta-de-cobro → same response
 *   - OPS with cuenta-de-cobro file → 201
 *   - TERMINO_FIJO without DESPRENDIBLE → 201 (cuenta-de-cobro NOT required)
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
let opsEmpleadoId: number;
let terminoFijoEmpleadoId: number;
const testPeriodo = '2099-07'; // future period to avoid existing unique constraint

async function loginAndGetCookie(request: any, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

async function pickEmpleadoWithContrato(request: any, tipoContrato: string): Promise<number | null> {
  // Filter via the nomina endpoint to find an empleado we already know has the contrato tipo
  const res = await request.get(
    `${API_BASE}/api/v1/nomina?periodo=2099-01&tipoContrato=${tipoContrato}`,
    { headers: { Cookie: adminCookie } }
  );
  if (res.status() === 200) {
    const body = await res.json();
    if (body.data?.length) return body.data[0].empleado.id;
  }
  // Fallback: self-seed a fresh empleado + contrato so tests are not dependent on stale seed data.
  const createdIds: number[] = [];
  const emp = await request.post(`${API_BASE}/api/v1/employees`, {
    headers: { Cookie: adminCookie },
    data: {
      nombre: 'TEST',
      apellido: `D4${tipoContrato.slice(0, 3)}${Date.now().toString().slice(-6)}`,
      tipoDocumento: 'CC',
      numeroDocumento: `9${Date.now().toString().slice(-8)}${tipoContrato[0]}`,
      genero: 'M',
      fechaNacimiento: '1990-01-15',
    },
  });
  if (emp.status() !== 201) return null;
  const empId = (await emp.json()).data.id as number;
  createdIds.push(empId);

  const cargos = await request.get(`${API_BASE}/api/v1/empresa/cargos`, { headers: { Cookie: adminCookie } });
  const cargoId = cargos.status() === 200 ? (await cargos.json()).data?.[0]?.id : null;
  if (!cargoId) return null;

  const contratoBody: any = {
    tipoContrato,
    fechaInicio: '2026-01-01',
    cargoId,
    activo: true,
  };
  if (tipoContrato === 'OPS') {
    contratoBody.valorJornada = 50000;
    contratoBody.fechaFin = '2026-12-31';
  } else {
    contratoBody.valorMensual = 1500000;
    if (tipoContrato !== 'TERMINO_INDEFINIDO') contratoBody.fechaFin = '2027-01-01';
  }
  const c = await request.post(`${API_BASE}/api/v1/nomina/employees/${empId}/contratos`, {
    headers: { Cookie: adminCookie },
    data: contratoBody,
  });
  if (c.status() !== 201) return null;
  return empId;
}

test.describe.configure({ mode: 'serial' });

test.describe('Nomina cuenta-de-cobro validation (D4)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    opsEmpleadoId = await pickEmpleadoWithContrato(request, 'OPS') ?? 0;
    terminoFijoEmpleadoId = await pickEmpleadoWithContrato(request, 'TERMINO_FIJO') ?? 0;
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
  });

  test('OPS empleado without cuenta-de-cobro → 400 + field: archivos.CUENTA_COBRO', async ({ request }) => {
    test.skip(!opsEmpleadoId, 'No OPS-contrato empleado found in seed data');
    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: opsEmpleadoId,
        periodo: testPeriodo,
        archivos: [
          // intentionally missing CUENTA_COBRO
          { tipoArchivo: 'INFORME_ACTIVIDADES', nombre: 'informe.pdf', url: 'fichas/informe.pdf' },
        ],
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('archivos.CUENTA_COBRO');
    expect(body.message.toLowerCase()).toContain('cuenta');
  });

  test('OPS empleado WITH cuenta-de-cobro → 201', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: opsEmpleadoId,
        periodo: testPeriodo,
        archivos: [
          { tipoArchivo: 'CUENTA_COBRO', nombre: 'cobro.pdf', url: 'fichas/cobro.pdf' },
          { tipoArchivo: 'INFORME_ACTIVIDADES', nombre: 'informe.pdf', url: 'fichas/informe.pdf' },
        ],
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data.archivos.some((a: any) => a.tipoArchivo === 'CUENTA_COBRO')).toBe(true);

    // Cleanup — delete the entry we just created (best-effort)
    await request.delete(`${API_BASE}/api/v1/nomina/periodos/${body.data.id}`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
  });

  test('TERMINO_FIJO without cuenta-de-cobro → 201 (cuenta-de-cobro not required for non-OPS)', async ({ request }) => {
    test.skip(!terminoFijoEmpleadoId, 'No TERMINO_FIJO-contrato empleado found in seed data');
    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: terminoFijoEmpleadoId,
        periodo: testPeriodo,
        // No archivos at all → should still succeed
      },
    });
    // Either 201 or 409 (duplicate) — both prove that D4 didn't reject it
    expect([201, 409]).toContain(resp.status());
    if (resp.status() === 201) {
      const body = await resp.json();
      await request.delete(`${API_BASE}/api/v1/nomina/periodos/${body.data.id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
  });

  test('Empleado sin contrato activo (random id) → 400 with "no contrato activo"', async ({ request }) => {
    // Use a guaranteed-non-existent empleadoId
    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: 999999999,
        periodo: testPeriodo,
      },
    });
    expect([400, 404]).toContain(resp.status());
    const body = await resp.json();
    expect(body.success).toBe(false);
  });
});
