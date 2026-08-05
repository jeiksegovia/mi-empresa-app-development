import { test, expect } from '@playwright/test';

/**
 * qa-session-jul-31 R2b: GET /nomina suggestion surfaces valorMensual base
 * for non-OPS contracts (OBRA_O_LABOR, TERMINO_FIJO, TERMINO_INDEFINIDO).
 *
 *   - Non-OPS row: sugerido.valorMensual == contrato.valorMensual,
 *     sugerido.valorJornada == null, sugerido.subtotalCalculado == null,
 *     sugerido.totalPagado == valorMensual.
 *   - OPS row: sugerido.valorJornada != null, sugerido.valorMensual == null,
 *     sugerido.subtotalCalculado == mediasJornadas * valorJornada.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
let cargoId: number;
const createdEmpIds: number[] = [];

async function login(request: any): Promise<string> {
  const r = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(r.status()).toBe(200);
  return r.headers()['set-cookie'];
}

async function pickCargo(request: any): Promise<number> {
  const r = await request.get(`${API_BASE}/api/v1/empresa/cargos`, {
    headers: { Cookie: adminCookie },
  });
  const body = await r.json();
  const rows = body.data ?? [];
  if (Array.isArray(rows) && rows.length > 0) return rows[0].id as number;
  throw new Error('No cargo available');
}

async function createEmployee(request: any, suffix: string): Promise<number> {
  const doc = `6${Date.now().toString().slice(-8)}${suffix}`;
  const r = await request.post(`${API_BASE}/api/v1/employees`, {
    headers: { Cookie: adminCookie },
    data: {
      nombre: 'TEST',
      apellido: `R2B${suffix}`,
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

async function createContrato(
  request: any,
  empId: number,
  tipo: 'OPS' | 'OBRA_O_LABOR' | 'TERMINO_FIJO' | 'TERMINO_INDEFINIDO',
  valor: { valorJornada?: number; valorMensual?: number },
): Promise<any> {
  const body: Record<string, unknown> = {
    tipoContrato: tipo,
    fechaInicio: '2026-01-01',
    cargoId,
    activo: true,
  };
  if (tipo === 'OPS') body.valorJornada = valor.valorJornada;
  else body.valorMensual = valor.valorMensual;
  if (tipo !== 'TERMINO_INDEFINIDO') body.fechaFin = '2027-01-01';
  const r = await request.post(`${API_BASE}/api/v1/nomina/employees/${empId}/contratos`, {
    headers: { Cookie: adminCookie },
    data: body,
  });
  expect(r.status()).toBe(201);
  return (await r.json()).data;
}

test.describe.configure({ mode: 'serial' });

test.describe('GET /nomina suggestion valorMensual for non-OPS (qa-jul-31 R2b)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request);
    cargoId = await pickCargo(request);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdEmpIds) {
      await request.delete(`${API_BASE}/api/v1/employees/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
  });

  test('TERMINO_FIJO row: sugerido.valorMensual surfaces + totalPagado = valorMensual', async ({ request }) => {
    const empId = await createEmployee(request, 'F1');
    await createContrato(request, empId, 'TERMINO_FIJO', { valorMensual: 1800000 });

    const r = await request.get(`${API_BASE}/api/v1/nomina?periodo=2099-10`, {
      headers: { Cookie: adminCookie },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    const row = body.data.find((x: any) => x.empleado.id === empId);
    expect(row).toBeTruthy();
    expect(row.contratoActivo.tipoContrato).toBe('TERMINO_FIJO');
    expect(Number(row.contratoActivo.valorMensual)).toBe(1800000);
    expect(row.contratoActivo.valorJornada ?? null).toBeNull();
    expect(Number(row.sugerido.valorMensual)).toBe(1800000);
    expect(row.sugerido.valorJornada ?? null).toBeNull();
    expect(row.sugerido.subtotalCalculado ?? null).toBeNull();
    expect(row.sugerido.mediasJornadas ?? null).toBeNull();
    expect(Number(row.sugerido.totalPagado)).toBe(1800000);
  });

  test('OBRA_O_LABOR row: valorMensual surfaced, totalPagado = valorMensual (D1: no aportes)', async ({ request }) => {
    const empId = await createEmployee(request, 'O1');
    await createContrato(request, empId, 'OBRA_O_LABOR', { valorMensual: 1200000 });

    const r = await request.get(`${API_BASE}/api/v1/nomina?periodo=2099-11`, {
      headers: { Cookie: adminCookie },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    const row = body.data.find((x: any) => x.empleado.id === empId);
    expect(row).toBeTruthy();
    expect(row.contratoActivo.tipoContrato).toBe('OBRA_O_LABOR');
    expect(Number(row.sugerido.valorMensual)).toBe(1200000);
    expect(row.sugerido.subtotalCalculado ?? null).toBeNull();
    expect(Number(row.sugerido.totalPagado)).toBe(1200000);
  });

  test('OPS row: valorJornada surfaced (valorMensual null)', async ({ request }) => {
    const empId = await createEmployee(request, 'P1');
    await createContrato(request, empId, 'OPS', { valorJornada: 50000 });

    const r = await request.get(`${API_BASE}/api/v1/nomina?periodo=2099-12`, {
      headers: { Cookie: adminCookie },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    const row = body.data.find((x: any) => x.empleado.id === empId);
    expect(row).toBeTruthy();
    expect(row.contratoActivo.tipoContrato).toBe('OPS');
    expect(Number(row.sugerido.valorJornada)).toBe(50000);
    expect(row.sugerido.valorMensual ?? null).toBeNull();
    // No asistencia rows for this period → subtotal 0
    expect(row.sugerido.mediasJornadas).toBe(0);
    expect(Number(row.sugerido.subtotalCalculado)).toBe(0);
  });
});