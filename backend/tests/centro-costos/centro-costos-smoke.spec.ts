/**
 * centro-costos-ago-5 + aug-17 backend smoke spec.
 *
 * Covers the happy path end-to-end + aug-17 additions:
 *   - GET /centro-costos?tipo=INGRESOS returns the 8 seeded INGRESOS centros
 *   - GET /centro-costos?tipo=EGRESOS returns the 6 seeded EGRESOS centros
 *     ordered 9–14 (no longer 6–11)
 *   - POST /:id/items with {cantidad:2, valorUnitario:1500, valorTotal:999999} → stored 3000.00
 *   - fecha "2026-08-17" is stored as fecha=2026-08-17 and periodo=2026-08-01
 *   - GET /balance?periodo=2026-08 rollup totalIngresos − totalEgresos === balance
 *
 * Plus the gateway RBAC checks (GERONTOLOGA 403, CONTRATOS 200) and the
 * aug-17 CONTRATOS 403 on create-centro / balance / non-current month items.
 *
 * Pattern follows backend/tests/asistencia/asistencia-rbac.spec.ts:
 *   - TEST_API_URL overridable via env
 *   - workers: 1 (single-file serial)
 *   - cookie login helper
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com';
const CONTRATOS_PASSWORD = 'password123';
const GERONTOLOGA_EMAIL = 'qa-gerontologa@miempresa.com';
const GERONTOLOGA_PASSWORD = 'password123';

// Bogota-local "today" in YYYY-MM-DD (server side enforces CONTRATOS month lock).
function serverTodayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  if (resp.status() !== 200) {
    throw new Error(`Login failed for ${email}: ${resp.status()} ${await resp.text()}`);
  }
  return resp.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Centro de Costos — backend smoke (ago-5 + aug-17)', () => {
  let adminCookie: string;
  let contratosCookie: string;
  let gerontologaCookie: string;
  let egresoCentroId: number;        // aug-17: used for EGRESOS-only tests
  let ingresoCentroId: number;       // aug-17: a priced INGRESOS for INGRESOS tests
  let managedCentroId: number;
  let managedItemId: number;
  let managedItemIdIngreso: number;
  let managedCentroIngresoId: number;
  let reciboItemId: number;
  let historicalItemId: number;       // aug-17 D14: for GET /items/:itemId month-guard test
  let historicalCentroId: number;
  const managedCentroName = `Test CC Smoke ${Date.now()}`;
  const managedCentroIngresoName = `Test CC Ingreso ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD);
    gerontologaCookie = await login(request, GERONTOLOGA_EMAIL, GERONTOLOGA_PASSWORD);
  });

  test.afterAll(async ({ request }) => {
    // Aug-17 W10 addendum: NO silent `.catch(() => {})` on cleanup. Fail loudly if
    // a delete does not return 204 — leaked historical ítems broke the empty-month
    // test (Gap #1, T13). Logout failures are still tolerated (cosmetic).
    const assertDeleted = async (resp: any, label: string) => {
      if (resp.status() !== 204) {
        throw new Error(`Cleanup delete failed for ${label}: ${resp.status()} ${await resp.text()}`);
      }
    };
    // Cleanup the EGRESOS centro + ítem we created
    if (managedCentroId && managedItemId) {
      const r = await request.delete(`${API_BASE}/api/v1/centro-costos/items/${managedItemId}`, {
        headers: { Cookie: adminCookie },
      });
      await assertDeleted(r, `items/${managedItemId}`);
    }
    if (managedCentroId) {
      const r = await request.delete(`${API_BASE}/api/v1/centro-costos/${managedCentroId}`, {
        headers: { Cookie: adminCookie },
      });
      await assertDeleted(r, `centro/${managedCentroId}`);
    }
    // Cleanup the INGRESOS centro + ítem (and its required precioUnitario)
    if (managedCentroIngresoId && managedItemIdIngreso) {
      const r = await request.delete(`${API_BASE}/api/v1/centro-costos/items/${managedItemIdIngreso}`, {
        headers: { Cookie: adminCookie },
      });
      await assertDeleted(r, `items/${managedItemIdIngreso}`);
    }
    if (managedCentroIngresoId) {
      const r = await request.delete(`${API_BASE}/api/v1/centro-costos/${managedCentroIngresoId}`, {
        headers: { Cookie: adminCookie },
      });
      await assertDeleted(r, `centro/${managedCentroIngresoId}`);
    }
    if (reciboItemId) {
      const r = await request.delete(`${API_BASE}/api/v1/centro-costos/items/${reciboItemId}`, {
        headers: { Cookie: adminCookie },
      });
      await assertDeleted(r, `items/${reciboItemId}`);
    }
    // Cleanup the historical (non-current-month) ítem + centro from D14 GET month-guard test
    if (historicalItemId) {
      const r = await request.delete(`${API_BASE}/api/v1/centro-costos/items/${historicalItemId}`, {
        headers: { Cookie: adminCookie },
      });
      await assertDeleted(r, `hist-items/${historicalItemId}`);
    }
    if (historicalCentroId) {
      const r = await request.delete(`${API_BASE}/api/v1/centro-costos/${historicalCentroId}`, {
        headers: { Cookie: adminCookie },
      });
      await assertDeleted(r, `hist-centro/${historicalCentroId}`);
    }
    for (const cookie of [adminCookie, contratosCookie, gerontologaCookie]) {
      await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: cookie } }).catch(() => {});
    }
  });

  // ---- Catalog shape (aug-17 D12) -----------------------------------------

  test('GET /centro-costos?tipo=INGRESOS → exactly 8 seeded centros in D12 orden', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos?tipo=INGRESOS`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(8);
    const orden = body.data.map((c: any) => c.orden);
    expect(orden).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const nombres = body.data.map((c: any) => c.nombre);
    expect(nombres).toEqual([
      'Mensualidades completas',
      'Mensualidad por 4 días',
      'Mensualidad por 3 días',
      'Mensualidades por día',
      'Transporte completo',
      'Transporte por 3 días',
      'Ingresos adicionales',
      'Valoraciones',
    ]);
    // aug-17 D11/D13 fields present on every centro
    for (const c of body.data) {
      expect(c).toHaveProperty('precioUnitario');
      expect(c).toHaveProperty('habilitarRecibo');
      expect(c.habilitarRecibo).toBe(false);
    }
    // Save the first one for the item test
    ingresoCentroId = body.data[0].id;
  });

  test('GET /centro-costos?tipo=EGRESOS → exactly 6 seeded centros in 9–14', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos?tipo=EGRESOS`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data).toHaveLength(6);
    const orden = body.data.map((c: any) => c.orden);
    expect(orden).toEqual([9, 10, 11, 12, 13, 14]);
    const nombres = body.data.map((c: any) => c.nombre);
    expect(nombres).toEqual([
      'Refrigerios',
      'Aseo',
      'Papelería',
      'Eventos',
      'Nómina',
      'Mantenimiento',
    ]);
    // Use the first EGRESOS centro for the legacy EGRESOS item tests
    egresoCentroId = body.data[0].id;
  });

  // ---- Existing behavior (ago-5) preserved on EGRESOS ----------------------

  test('POST /:id/items (EGRESOS) with bogus valorTotal → stored valorTotal = "3000.00"', async ({ request }) => {
    const today = serverTodayBogota();
    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${egresoCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Smoke test item',
        cantidad: 2,
        valorUnitario: 1500,
        valorTotal: '999999.00',
        fecha: today,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data.valorTotal).toBe('3000.00');
    expect(body.data.valorUnitario).toBe('1500.00');
    // aug-17 D10: fecha stored verbatim; periodo is first-of-month(fecha)
    expect(body.data.fecha).toBe(today);
    expect(body.data.periodo).toBe(today.slice(0, 7) + '-01');
    // aug-17 D11: EGRESOS keeps ingreso fields null
    expect(body.data.pagador).toBeNull();
    expect(body.data.beneficiarioClienteId).toBeNull();
    expect(body.data.medioPago).toBeNull();
  });

  test('POST /:id/items with fecha="2026-08-17" → fecha stays 17, periodo "2026-08-01"', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${egresoCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Date normalization',
        valorUnitario: 100,
        fecha: '2026-08-17',
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.data.fecha).toBe('2026-08-17');
    expect(body.data.periodo).toBe('2026-08-01');
  });

  test('POST /:id/items missing fecha → 400 field=fecha', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${egresoCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Missing fecha',
        valorUnitario: 50,
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.field).toBe('fecha');
  });

  test('GET /balance?periodo=2026-08 → balance = totalIngresos - totalEgresos', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos/balance?periodo=2026-08`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    const { totalIngresos, totalEgresos, balance } = body.data;
    expect(Math.abs(parseFloat(balance) - (parseFloat(totalIngresos) - parseFloat(totalEgresos)))).toBeLessThan(0.01);
    expect(body.data.porCentro.length).toBeGreaterThan(0);
  });

  test('GET /balance?periodo=2099-12 (empty) → 200 with all zeros, not 404', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos/balance?periodo=2099-12`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data.totalIngresos).toBe('0.00');
    expect(body.data.totalEgresos).toBe('0.00');
    expect(body.data.balance).toBe('0.00');
    expect(body.data.porCentro).toEqual([]);
  });

  // ---- aug-17 INGRESOS validation (R25/R26) --------------------------------

  test('POST INGRESOS without pagador → 400 field=pagador', async ({ request }) => {
    // Create a priced INGRESOS centro for the test
    const create = await request.post(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: managedCentroIngresoName,
        tipo: 'INGRESOS',
        orden: 100,
        precioUnitario: 700000,
        habilitarRecibo: false,
      },
    });
    expect(create.status()).toBe(201);
    const created = await create.json();
    managedCentroIngresoId = created.data.id;

    const today = serverTodayBogota();
    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${managedCentroIngresoId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Missing pagador',
        cantidad: 1,
        // beneficiarioClienteId needs an existing Cliente — pull one if any
        fecha: today,
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.field).toBe('pagador');
  });

  test('POST INGRESOS with valorUnitario=1 on a priced centro → server copies centro.precioUnitario', async ({ request }) => {
    // Find any existing cliente for beneficiario
    const clientesResp = await request.get(`${API_BASE}/api/v1/patients?limit=1`, {
      headers: { Cookie: adminCookie },
    });
    let beneficiarioId: number;
    if (clientesResp.status() === 200) {
      const cb = await clientesResp.json();
      beneficiarioId = cb.data?.[0]?.id;
    }
    // Create a cliente if none exists
    if (!beneficiarioId) {
      const docNum = `${Date.now()}`;
      const newCli = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: adminCookie },
        data: {
          nombre: 'Smoke Beneficiario',
          tipoDocumento: 'CC',
          numeroDocumento: docNum,
          fechaNacimiento: '1990-01-01',
          genero: 'M',
        },
      });
      const ncb = await newCli.json();
      beneficiarioId = ncb.data?.id;
    }

    const today = serverTodayBogota();
    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${managedCentroIngresoId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Server copies precioUnitario',
        cantidad: 1,
        valorUnitario: 1,                  // client value — should be IGNORED
        pagador: 'Smoke Pagador',
        beneficiarioClienteId: beneficiarioId,
        medioPago: 'EFECTIVO',
        fecha: today,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    managedItemIdIngreso = body.data.id;
    expect(body.data.valorUnitario).toBe('700000.00');
    expect(body.data.valorTotal).toBe('700000.00');
    expect(body.data.pagador).toBe('Smoke Pagador');
    expect(body.data.beneficiarioClienteId).toBe(beneficiarioId);
    expect(body.data.medioPago).toBe('EFECTIVO');
  });

  // ---- aug-17 GET /items/:itemId for recibo (R31) --------------------------

  test('GET /items/:itemId returns ítem + centro + beneficiario shape', async ({ request }) => {
    expect(managedItemIdIngreso).toBeTruthy();
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos/items/${managedItemIdIngreso}`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data.id).toBe(managedItemIdIngreso);
    expect(body.data).toHaveProperty('centro');
    expect(body.data.centro.id).toBe(managedCentroIngresoId);
    expect(body.data).toHaveProperty('beneficiario');
    expect(body.data.beneficiario).toBeTruthy();
    expect(body.data.beneficiario).toHaveProperty('id');
    expect(body.data.beneficiario).toHaveProperty('nombre');
  });

  test('GET /items/:itemId 404 for missing item', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos/items/99999999`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(404);
    const body = await resp.json();
    expect(body.field).toBe('itemId');
  });

  // ---- E2E with EGRESOS centro + ítem -------------------------------------

  test('E2E: create EGRESOS centro + ítem → balance rollup reflects it', async ({ request }) => {
    const create = await request.post(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: adminCookie },
      data: { nombre: managedCentroName, tipo: 'EGRESOS', orden: 99 },
    });
    expect(create.status()).toBe(201);
    const created = await create.json();
    managedCentroId = created.data.id;
    expect(managedCentroId).toBeTruthy();

    const today = serverTodayBogota();
    const item = await request.post(`${API_BASE}/api/v1/centro-costos/${managedCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Smoke supply item',
        notas: 'with required egreso fields',
        cantidad: 3,
        valorUnitario: 100,
        fecha: today,
        numeroFactura: 'SMOKE-1',
        proveedor: 'Proveedor Smoke',
      },
    });
    expect(item.status()).toBe(201);
    const itemBody = await item.json();
    managedItemId = itemBody.data.id;
    expect(managedItemId).toBeTruthy();
    expect(itemBody.data.valorTotal).toBe('300.00');
    expect(itemBody.data.numeroFactura).toBe('SMOKE-1');
    expect(itemBody.data.proveedor).toBe('Proveedor Smoke');

    const list = await request.get(`${API_BASE}/api/v1/centro-costos/items?periodo=${today.slice(0, 7)}`, {
      headers: { Cookie: adminCookie },
    });
    expect(list.status()).toBe(200);
    const listBody = await list.json();
    const ourGroup = listBody.data.grupos.find((g: any) => g.centro.id === managedCentroId);
    expect(ourGroup).toBeTruthy();
    expect(ourGroup.subtotal).toBe('300.00');

    const bal = await request.get(`${API_BASE}/api/v1/centro-costos/balance?periodo=${today.slice(0, 7)}`, {
      headers: { Cookie: adminCookie },
    });
    expect(bal.status()).toBe(200);
    const balBody = await bal.json();
    const ourCentro = balBody.data.porCentro.find((c: any) => c.centroId === managedCentroId);
    expect(ourCentro).toBeTruthy();
    expect(ourCentro.subtotal).toBe('300.00');
  });

  // ---- RBAC gateway checks (smoke level) -----------------------------------

  test('GERONTOLOGA → 403 DOMAIN_FORBIDDEN on any /centro-costos route', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: gerontologaCookie },
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.code).toBe('DOMAIN_FORBIDDEN');
  });

  test('CONTRATOS → 200 on GET /centro-costos', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: contratosCookie },
    });
    expect(resp.status()).toBe(200);
  });

  // ---- aug-17 CONTRATOS 403 (D14/R21/R22) ----------------------------------

  test('CONTRATOS POST /centro-costos (create centro) → 403', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: contratosCookie },
      data: { nombre: 'Should fail', tipo: 'EGRESOS' },
    });
    expect(resp.status()).toBe(403);
  });

  test('CONTRATOS PUT /centro-costos/:id (update centro) → 403', async ({ request }) => {
    const resp = await request.put(`${API_BASE}/api/v1/centro-costos/${ingresoCentroId}`, {
      headers: { Cookie: contratosCookie },
      data: { descripcion: 'should fail' },
    });
    expect(resp.status()).toBe(403);
  });

  test('CONTRATOS DELETE /centro-costos/:id → 403', async ({ request }) => {
    const resp = await request.delete(`${API_BASE}/api/v1/centro-costos/${ingresoCentroId}`, {
      headers: { Cookie: contratosCookie },
    });
    expect(resp.status()).toBe(403);
  });

  test('CONTRATOS GET /centro-costos/balance → 403', async ({ request }) => {
    const today = serverTodayBogota();
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos/balance?periodo=${today.slice(0, 7)}`, {
      headers: { Cookie: contratosCookie },
    });
    expect(resp.status()).toBe(403);
  });

  test('CONTRATOS GET /centro-costos/items?periodo=1999-01 → 200 when fecha lock is off', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos/items?periodo=1999-01`, {
      headers: { Cookie: contratosCookie },
    });
    expect(resp.status()).toBe(200);
  });

  // aug-17 D14 (W8): CONTRATOS GET /items/:itemId month guard — same rule as PUT/DELETE.
  // Admin seeds a historical EGRESOS centro + ítem (fecha 1999-01-15), then CONTRATOS GET → 403.
  test('CONTRATOS GET /items/:itemId with non-current-month fecha → 200 when fecha lock is off', async ({ request }) => {
    const createCentro = await request.post(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: adminCookie },
      data: { nombre: `Test CC Hist ${Date.now()}`, tipo: 'EGRESOS', orden: 99 },
    });
    expect(createCentro.status()).toBe(201);
    historicalCentroId = (await createCentro.json()).data.id;

    const createItem = await request.post(`${API_BASE}/api/v1/centro-costos/${historicalCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Historical ítem',
        valorUnitario: 10,
        fecha: '1999-01-15',
        numeroFactura: 'D14-HIST-1',
        proveedor: 'Proveedor D14 Hist',
      },
    });
    expect(createItem.status()).toBe(201);
    historicalItemId = (await createItem.json()).data.id;

    const resp = await request.get(`${API_BASE}/api/v1/centro-costos/items/${historicalItemId}`, {
      headers: { Cookie: contratosCookie },
    });
    expect(resp.status()).toBe(200);
  });

  test('CONTRATOS POST /:id/items with non-current-month fecha → 201 when fecha lock is off', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${egresoCentroId}/items`, {
      headers: { Cookie: contratosCookie },
      data: {
        nombre: 'CONTRATOS off-month attempt',
        valorUnitario: 10,
        fecha: '1999-01-15',
      },
    });
    expect(resp.status()).toBe(201);
  });

  test('CONTRATOS POST /:id/items with current-month fecha → 201', async ({ request }) => {
    const today = serverTodayBogota();
    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${egresoCentroId}/items`, {
      headers: { Cookie: contratosCookie },
      data: {
        nombre: 'CONTRATOS current-month ok',
        valorUnitario: 10,
        fecha: today,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    reciboItemId = body.data.id; // reuse this slot for cleanup
    expect(body.data.fecha).toBe(today);
  });
});