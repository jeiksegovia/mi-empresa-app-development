import { test, expect } from '@playwright/test';

/**
 * EDGE — nomina-asistencia-jul-18: default calc from asistencia + total override.
 *
 * Covers contract §5:
 * - When medias/valor/subtotal/total omitted → defaults from asistencia + contrato
 * - Client totalPagado override allowed even if ≠ subtotal+aportes
 * - Dual-write salario = totalPagado when total is set
 *
 * Run (from backend/):
 *   npx playwright test tests/nomina/nomina-calc-edge.spec.ts --reporter=line
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
const PERIODO = '2097-08';
const FECHA = '2097-08-15';
const VALOR_JORNADA = 40000;

let adminCookie: string;
let empleadoId: number;
let cargoId: number;
const createdPeriodoIds: number[] = [];
const createdEmployeeIds: number[] = [];

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
    data: { nombre: `Cargo Edge ${Date.now()}` },
  });
  expect(create.status()).toBe(201);
  return (await create.json()).data.id;
}

test.describe.configure({ mode: 'serial' });

test.describe('Nómina calc edges (jul-18)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request);
    cargoId = await ensureCargo(request);

    const emp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'EDGE',
        apellido: `CALC${Date.now().toString().slice(-6)}`,
        tipoDocumento: 'CC',
        numeroDocumento: `93${Date.now().toString().slice(-8)}`,
        genero: 'M',
        fechaNacimiento: '1993-03-03',
      },
    });
    expect(emp.status()).toBe(201);
    empleadoId = (await emp.json()).data.id as number;
    createdEmployeeIds.push(empleadoId);

    const contrato = await request.post(
      `${API_BASE}/api/v1/nomina/employees/${empleadoId}/contratos`,
      {
        headers: { Cookie: adminCookie },
        data: {
          tipoContrato: 'TERMINO_INDEFINIDO',
          fechaInicio: '2026-01-01',
          cargoId,
          valorJornada: VALOR_JORNADA,
          activo: true,
        },
      },
    );
    expect(contrato.status()).toBe(201);

    // Seed 1 full day (AM+PM = 2 medias) in the period month
    const put = await request.put(`${API_BASE}/api/v1/asistencia/dia`, {
      headers: { Cookie: adminCookie },
      data: {
        fecha: FECHA,
        items: [{ empleadoId, jornadaAm: true, jornadaPm: true }],
      },
    });
    expect(put.status()).toBe(200);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdPeriodoIds) {
      await request
        .delete(`${API_BASE}/api/v1/nomina/periodos/${id}`, {
          headers: { Cookie: adminCookie },
        })
        .catch(() => {});
    }
    for (const id of createdEmployeeIds) {
      await request
        .delete(`${API_BASE}/api/v1/employees/${id}`, {
          headers: { Cookie: adminCookie },
        })
        .catch(() => {});
    }
    await request
      .post(`${API_BASE}/api/v1/auth/logout`, {
        headers: { Cookie: adminCookie },
      })
      .catch(() => {});
  });

  test('POST periodos with omitted calc fields → defaults from asistencia + contrato', async ({
    request,
  }) => {
    expect(empleadoId).toBeTruthy();

    // Clean residue for period if any
    const list = await request.get(`${API_BASE}/api/v1/nomina?periodo=${PERIODO}`, {
      headers: { Cookie: adminCookie },
    });
    const lBody = await list.json();
    const existing = lBody.data?.find((r: any) => r.empleado.id === empleadoId)?.entrada;
    if (existing?.id) {
      await request.delete(`${API_BASE}/api/v1/nomina/periodos/${existing.id}`, {
        headers: { Cookie: adminCookie },
      });
    }

    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId,
        periodo: PERIODO,
        // omit mediasJornadas, valorJornada, subtotalCalculado, totalPagado, aportes
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    createdPeriodoIds.push(body.data.id);

    // medias default from asistencia: 2 (AM+PM)
    expect(Number(body.data.mediasJornadas)).toBe(2);
    // valorJornada default from active contrato
    expect(Number(body.data.valorJornada)).toBe(VALOR_JORNADA);
    // subtotal = 2 * 40000 = 80000
    expect(Number(body.data.subtotalCalculado)).toBe(80000);
    // aportes default 0
    expect(Number(body.data.aportesSociales ?? 0)).toBe(0);
    // total = subtotal + aportes
    expect(Number(body.data.totalPagado)).toBe(80000);
    // dual-write
    expect(Number(body.data.salario)).toBe(80000);
  });

  test('POST periodos totalPagado override allowed even if ≠ subtotal+aportes; dual-write salario', async ({
    request,
  }) => {
    expect(empleadoId).toBeTruthy();
    const overridePeriodo = '2097-09';

    const list = await request.get(`${API_BASE}/api/v1/nomina?periodo=${overridePeriodo}`, {
      headers: { Cookie: adminCookie },
    });
    const lBody = await list.json();
    const existing = lBody.data?.find((r: any) => r.empleado.id === empleadoId)?.entrada;
    if (existing?.id) {
      await request.delete(`${API_BASE}/api/v1/nomina/periodos/${existing.id}`, {
        headers: { Cookie: adminCookie },
      });
    }

    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId,
        periodo: overridePeriodo,
        mediasJornadas: 5,
        valorJornada: 10000,
        aportesSociales: 1000,
        // subtotal would be 50000; total with aportes 51000 — override to 77777
        totalPagado: 77777,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    createdPeriodoIds.push(body.data.id);

    expect(Number(body.data.mediasJornadas)).toBe(5);
    expect(Number(body.data.valorJornada)).toBe(10000);
    expect(Number(body.data.subtotalCalculado)).toBe(50000);
    expect(Number(body.data.aportesSociales)).toBe(1000);
    // Override accepted without reject
    expect(Number(body.data.totalPagado)).toBe(77777);
    expect(Number(body.data.salario)).toBe(77777);
  });

  test('GET /nomina row exposes sugerido + asistenciaMes + medio fields', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/nomina?periodo=${PERIODO}`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const row = body.data.find((r: any) => r.empleado.id === empleadoId);
    expect(row).toBeTruthy();
    expect(row.empleado).toHaveProperty('medioPagoTipo');
    expect(row.asistenciaMes).toBeTruthy();
    expect(row.asistenciaMes).toHaveProperty('mediasJornadas');
    expect(row.asistenciaMes).toHaveProperty('horas');
    expect(row.sugerido).toBeTruthy();
    expect(row.sugerido).toHaveProperty('mediasJornadas');
    expect(row.sugerido).toHaveProperty('valorJornada');
    expect(row.sugerido).toHaveProperty('subtotalCalculado');
    expect(row.sugerido).toHaveProperty('aportesSociales');
    expect(row.sugerido).toHaveProperty('totalPagado');
    if (row.contratoActivo) {
      expect(row.contratoActivo).toHaveProperty('valorJornada');
    }
  });

  test('OBRA_O_LABOR aportesSociales > 0 → 400 field aportesSociales', async ({ request }) => {
    // Seed OPS-like OBRA employee
    const emp = await request.post(`${API_BASE}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'EDGE',
        apellido: `OBRA${Date.now().toString().slice(-5)}`,
        tipoDocumento: 'CC',
        numeroDocumento: `95${Date.now().toString().slice(-8)}`,
        genero: 'F',
        fechaNacimiento: '1990-01-01',
      },
    });
    expect(emp.status()).toBe(201);
    const obraId = (await emp.json()).data.id as number;
    createdEmployeeIds.push(obraId);

    const c = await request.post(`${API_BASE}/api/v1/nomina/employees/${obraId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'OBRA_O_LABOR',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        cargoId,
        valorJornada: 30000,
        activo: true,
      },
    });
    expect(c.status()).toBe(201);

    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: obraId,
        periodo: '2097-10',
        aportesSociales: 50,
        archivos: [
          { tipoArchivo: 'CUENTA_COBRO', nombre: 'cobro.pdf', url: 'fichas/cobro-obra-edge.pdf' },
        ],
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('aportesSociales');
  });
});
