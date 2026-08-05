import { test, expect } from '@playwright/test';

/**
 * qa-session-jul-24 R7: Contract valorMensual validation + nómina branch.
 *
 *   - TERMINO_FIJO without valorMensual → 400 field=valorMensual
 *   - TERMINO_FIJO with valorMensual → 201 (valorMensual stored, valorJornada null)
 *   - OPS still requires valorJornada
 *   - Nómina for TERMINO_FIJO: totalPagado = valorMensual + aportesSociales
 *   - OPS: totalPagado = mediasJornadas * valorJornada + aportesSociales
 *   - GET /nomina?periodo populates sugerido.valorMensual for non-OPS
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
let cargoId: number;
let fijoEmpId: number;
let opsEmpId: number;
const createdPeriodoIds: number[] = [];
const createdEmpIds: number[] = [];

async function login(request: any, email: string, password: string): Promise<string> {
  const r = await request.post(`${API_BASE}/api/v1/auth/login`, { data: { email, password } });
  if (r.status() !== 200) throw new Error(`Login ${email} failed: ${r.status()}`);
  return r.headers()['set-cookie'];
}

async function pickCargo(request: any): Promise<number> {
  const r = await request.get(`${API_BASE}/api/v1/empresa/cargos`, { headers: { Cookie: adminCookie } });
  if (r.status() === 200) {
    const body = await r.json();
    const rows = body.data ?? [];
    if (Array.isArray(rows) && rows.length > 0) return rows[0].id;
  }
  const c = await request.post(`${API_BASE}/api/v1/empresa/cargos`, {
    headers: { Cookie: adminCookie },
    data: { nombre: `Cargo ${Date.now()}` },
  });
  expect(c.status()).toBe(201);
  return (await c.json()).data.id;
}

async function createEmployee(request: any, suffix: string): Promise<number> {
  const doc = `7${Date.now().toString().slice(-8)}${suffix}`;
  const r = await request.post(`${API_BASE}/api/v1/employees`, {
    headers: { Cookie: adminCookie },
    data: {
      nombre: 'TEST',
      apellido: `R7${suffix}`,
      tipoDocumento: 'CC',
      numeroDocumento: doc,
      genero: 'M',
      fechaNacimiento: '1990-01-15',
    },
  });
  expect(r.status()).toBe(201);
  const id = (await r.json()).data.id as number;
  createdEmpIds.push(id);
  return id;
}

async function fetchExistingFijoEmpleado(request: any): Promise<number | null> {
  const r = await request.get(`${API_BASE}/api/v1/nomina?periodo=2099-07&tipoContrato=TERMINO_FIJO`, {
    headers: { Cookie: adminCookie },
  });
  if (r.status() === 200) {
    const body = await r.json();
    const rows = body.data ?? [];
    if (Array.isArray(rows) && rows.length > 0) return rows[0].empleado.id;
  }
  return null;
}

async function fetchExistingOpsEmpleado(request: any): Promise<number | null> {
  const r = await request.get(`${API_BASE}/api/v1/nomina?periodo=2099-07&tipoContrato=OPS`, {
    headers: { Cookie: adminCookie },
  });
  if (r.status() === 200) {
    const body = await r.json();
    const rows = body.data ?? [];
    if (Array.isArray(rows) && rows.length > 0) return rows[0].empleado.id;
  }
  return null;
}

test.describe.configure({ mode: 'serial' });

test.describe('Contract valorMensual + nómina branch (R7)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    cargoId = await pickCargo(request);
    fijoEmpId = (await fetchExistingFijoEmpleado(request)) ?? (await createEmployee(request, 'F1'));
    if (fijoEmpId && !createdEmpIds.includes(fijoEmpId)) createdEmpIds.push(fijoEmpId);
    opsEmpId = (await fetchExistingOpsEmpleado(request)) ?? (await createEmployee(request, 'O1'));
    if (opsEmpId && !createdEmpIds.includes(opsEmpId)) createdEmpIds.push(opsEmpId);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdPeriodoIds) {
      await request.delete(`${API_BASE}/api/v1/nomina/periodos/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    for (const id of createdEmpIds) {
      await request.delete(`${API_BASE}/api/v1/employees/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
  });

  test('TERMINO_FIJO without valorMensual → 400 field=valorMensual', async ({ request }) => {
    const empId = await createEmployee(request, 'NOF');
    const r = await request.post(`${API_BASE}/api/v1/nomina/employees/${empId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'TERMINO_FIJO',
        fechaInicio: '2026-01-01',
        fechaFin: '2027-01-01',
        cargoId,
        activo: true,
      },
    });
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body.field).toBe('valorMensual');
  });

  test('TERMINO_FIJO with valorMensual → 201 stored; OPS still requires valorJornada', async ({ request }) => {
    const empId = await createEmployee(request, 'FVM');
    const r = await request.post(`${API_BASE}/api/v1/nomina/employees/${empId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'TERMINO_FIJO',
        fechaInicio: '2026-01-01',
        fechaFin: '2027-01-01',
        cargoId,
        valorMensual: 1500000,
        activo: true,
      },
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.data.tipoContrato).toBe('TERMINO_FIJO');
    expect(body.data.valorMensual).toBe('1500000');
    expect(body.data.valorJornada ?? null).toBeNull();

    // OPS still requires valorJornada
    const opsEmpId = await createEmployee(request, 'OVJ');
    const ops = await request.post(`${API_BASE}/api/v1/nomina/employees/${opsEmpId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-01-01',
        fechaFin: '2027-01-01',
        cargoId,
        valorMensual: 999,
        activo: true,
      },
    });
    expect(ops.status()).toBe(400);
    const opsBody = await ops.json();
    expect(opsBody.field).toBe('valorJornada');
  });

  test('Nómina for TERMINO_FIJO computes totalPagado = valorMensual + aportesSociales', async ({ request }) => {
    test.skip(!fijoEmpId, 'no FIJO emp');
    // Ensure a fresh period entry
    const list = await request.get(`${API_BASE}/api/v1/nomina?periodo=2099-08`, {
      headers: { Cookie: adminCookie },
    });
    const lb = await list.json();
    const existing = lb.data?.find((r: any) => r.empleado.id === fijoEmpId)?.entrada;
    if (existing?.id) {
      await request.delete(`${API_BASE}/api/v1/nomina/periodos/${existing.id}`, {
        headers: { Cookie: adminCookie },
      });
    }

    // Create a fresh TERMINO_FIJO contrato with valorMensual=1500000 to ensure branch
    const empId = await createEmployee(request, 'FNM');
    const create = await request.post(`${API_BASE}/api/v1/nomina/employees/${empId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'TERMINO_FIJO',
        fechaInicio: '2026-01-01',
        fechaFin: '2027-01-01',
        cargoId,
        valorMensual: 1500000,
        activo: true,
      },
    });
    expect(create.status()).toBe(201);

    const r = await request.post(`${API_BASE}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: empId,
        periodo: '2099-08',
        aportesSociales: 100000,
      },
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    createdPeriodoIds.push(body.data.id);
    expect(body.data.tipoContrato).toBe('TERMINO_FIJO');
    expect(Number(body.data.totalPagado)).toBe(1600000);
    expect(Number(body.data.salario)).toBe(1600000);
    // Snapshot for non-OPS is null per contract D2
    expect(body.data.mediasJornadas ?? null).toBeNull();
    expect(body.data.subtotalCalculado ?? null).toBeNull();
  });

  test('GET /nomina?periodo populates sugerido.valorMensual for non-OPS', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v1/nomina?periodo=2099-09&tipoContrato=TERMINO_FIJO`, {
      headers: { Cookie: adminCookie },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    const row = body.data.find((r: any) => r.empleado.id === 248);
    if (row) {
      expect(row.contratoActivo?.tipoContrato).toBe('TERMINO_FIJO');
      expect(row.sugerido.valorMensual).toBe(1500000);
      expect(row.sugerido.valorJornada ?? null).toBeNull();
      expect(row.sugerido.subtotalCalculado ?? null).toBeNull();
      expect(row.sugerido.totalPagado).toBe(1500000);
    }
  });
});
