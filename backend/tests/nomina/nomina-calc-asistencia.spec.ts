import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — nomina-asistencia-jul-18: nómina enrichment + calc + aportes rules.
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
  valorJornada: number,
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

  const contratoBody: any = {
    tipoContrato,
    fechaInicio: '2026-01-01',
    cargoId,
    valorJornada,
    activo: true,
  };
  if (tipoContrato !== 'TERMINO_INDEFINIDO' as any) {
    contratoBody.fechaFin = '2027-01-01';
  }
  if (tipoContrato === 'TERMINO_FIJO') {
    contratoBody.fechaFin = '2027-01-01';
  }
  if (tipoContrato === 'OPS') {
    contratoBody.fechaFin = '2026-12-31';
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

  test('POST periodos FIJO with aportes → 201 + dual-write salario=totalPagado', async ({ request }) => {
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

    const resp = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: fijoEmpleadoId,
        periodo: PERIODO,
        mediasJornadas: 10,
        valorJornada: 50000,
        aportesSociales: 100000,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    createdPeriodoIds.push(body.data.id);
    expect(Number(body.data.mediasJornadas)).toBe(10);
    expect(Number(body.data.valorJornada)).toBe(50000);
    expect(Number(body.data.subtotalCalculado)).toBe(500000);
    expect(Number(body.data.aportesSociales)).toBe(100000);
    expect(Number(body.data.totalPagado)).toBe(600000);
    expect(Number(body.data.salario)).toBe(600000);
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
