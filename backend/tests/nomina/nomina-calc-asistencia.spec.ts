import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — qa-session-jul-24 R7: nómina enrichment + calc + aportes rules.
 * Branches on tipoContrato:
 *   - OPS:       total = mediasJornadas * valorJornada + aportes
 *   - non-OPS:   total = valorMensual + aportes (snapshot null per D2)
 * Self-seeds FIJO + OPS employees with contratos when seed is sparse.
 * Uses far-future periods to avoid unique collisions.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
const PERIODO = '2099-11';
const FECHA = '2099-11-10';

let adminCookie: string;
let fijoEmpleadoId: number;
let opsEmpleadoId: number;
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
    data: { nombre: `Cargo Nomina ${Date.now()}` },
  });
  expect(create.status()).toBe(201);
  return (await create.json()).data.id;
}

async function createEmployeeWithContrato(
  request: any,
  tipoContrato: 'TERMINO_FIJO' | 'OPS',
  valorJornadaOrMensual: number = 50000,
): Promise<number> {
  const suffix = `${tipoContrato.slice(0, 3)}${Date.now().toString().slice(-6)}`;
  const emp = await request.post(`${API_BASE}/api/v1/employees`, {
    headers: { Cookie: adminCookie },
    data: {
      nombre: 'TEST',
      apellido: suffix,
      tipoDocumento: 'CC',
      numeroDocumento: `7${Date.now().toString().slice(-8)}${tipoContrato[0]}`,
      genero: 'M',
      fechaNacimiento: '1991-03-03',
    },
  });
  expect(emp.status()).toBe(201);
  const id = (await emp.json()).data.id as number;
  createdEmployeeIds.push(id);

  // qa-session-jul-24 R7: branch required-field on tipoContrato.
  const contratoBody: any = {
    tipoContrato,
    fechaInicio: '2026-01-01',
    cargoId,
    activo: true,
  }
  if (tipoContrato === 'OPS') {
    contratoBody.valorJornada = valorJornadaOrMensual
    contratoBody.fechaFin = '2026-12-31'
  } else {
    // TERMINO_FIJO: requires valorMensual
    contratoBody.valorMensual = valorJornadaOrMensual
    contratoBody.fechaFin = '2027-01-01'
  }

  const c = await request.post(`${API_BASE}/api/v1/nomina/employees/${id}/contratos`, {
    headers: { Cookie: adminCookie },
    data: contratoBody,
  });
  expect(c.status()).toBe(201);
  return id;
}

async function pickOrCreate(
  request: any,
  tipo: 'TERMINO_FIJO' | 'OPS',
): Promise<number> {
  const res = await request.get(
    `${API_BASE}/api/v1/nomina?periodo=2099-01&tipoContrato=${tipo}`,
    { headers: { Cookie: adminCookie } },
  );
  if (res.status() === 200) {
    const body = await res.json();
    if (body.data?.length) return body.data[0].empleado.id;
  }
  return createEmployeeWithContrato(request, tipo, 50000);
}

test.describe.configure({ mode: 'serial' });

test.describe('Nómina calc + asistencia enrichment (jul-18)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request);
    cargoId = await ensureCargo(request);
    fijoEmpleadoId = await pickOrCreate(request, 'TERMINO_FIJO');
    opsEmpleadoId = await pickOrCreate(request, 'OPS');

    await request.put(`${API_BASE}/api/v1/asistencia/dia`, {
      headers: { Cookie: adminCookie },
      data: {
        fecha: FECHA,
        items: [{ empleadoId: fijoEmpleadoId, jornadaAm: true, jornadaPm: false }],
      },
    });
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdPeriodoIds) {
      await request.delete(`${API_BASE}/api/v1/nomina/periodos/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    for (const id of createdEmployeeIds) {
      await request.delete(`${API_BASE}/api/v1/employees/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
  });

  test('GET /nomina?periodo= includes medio + asistenciaMes + valorJornada', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/nomina?periodo=${PERIODO}`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data?.length).toBeGreaterThan(0);
    const row =
      body.data.find((r: any) => r.empleado.id === fijoEmpleadoId) ?? body.data[0];
    expect(row.empleado).toHaveProperty('medioPagoTipo');
    expect(row).toHaveProperty('asistenciaMes');
    expect(row.asistenciaMes).toHaveProperty('mediasJornadas');
    expect(row.asistenciaMes).toHaveProperty('horas');
    expect(row).toHaveProperty('sugerido');
    if (row.contratoActivo) {
      expect(row.contratoActivo).toHaveProperty('valorJornada');
    }
  });

  test('POST periodos FIJO with aportes → 201 + totalPagado = valorMensual + aportes', async ({ request }) => {
    expect(fijoEmpleadoId).toBeTruthy();
    // Clean residue for period
    const list = await request.get(`${API_BASE}/api/v1/nomina?periodo=${PERIODO}`, {
      headers: { Cookie: adminCookie },
    });
    const lBody = await list.json();
    const existing = lBody.data?.find((r: any) => r.empleado.id === fijoEmpleadoId)?.entrada;
    if (existing?.id) {
      await request.delete(`${API_BASE}/api/v1/nomina/periodos/${existing.id}`, {
        headers: { Cookie: adminCookie },
      });
    }

    // qa-session-jul-24 R7: non-OPS base is valorMensual from the contrato.
    // fijoEmpleadoId was created in beforeAll with valorMensual=50000 (jul-18 era)
    // — we don't rely on that, just override with valorMensual=500000 explicitly.
    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: fijoEmpleadoId,
        periodo: PERIODO,
        valorMensual: 500000,
        aportesSociales: 100000,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    createdPeriodoIds.push(body.data.id);
    expect(Number(body.data.aportesSociales)).toBe(100000);
    expect(Number(body.data.totalPagado)).toBe(600000);
    expect(Number(body.data.salario)).toBe(600000);
    // Snapshot null for non-OPS (D2)
    expect(body.data.mediasJornadas ?? null).toBeNull();
    expect(body.data.subtotalCalculado ?? null).toBeNull();
  });

  test('POST periodos OPS with aportes > 0 → 400 field aportesSociales', async ({ request }) => {
    expect(opsEmpleadoId).toBeTruthy();
    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: opsEmpleadoId,
        periodo: '2099-12',
        aportesSociales: 50000,
        archivos: [
          { tipoArchivo: 'CUENTA_COBRO', nombre: 'cobro.pdf', url: 'fichas/cobro.pdf' },
        ],
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('aportesSociales');
  });
});
