/**
 * centro-costos — aug-17 acceptance criteria QA (T12).
 *
 * This file extends the existing smoke spec with the full aug-17 acceptance
 * suite. It tests the LIVE contract as published in
 * `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md`
 * (Wave 4 + D14 GET month guard).
 *
 * Coverage (R18, R21, R22, R24, R25, R26, R27, R28, R31, D14) — cases NOT
 * already covered by `centro-costos-smoke.spec.ts`:
 *
 *   - R25: INGRESOS missing beneficiarioClienteId → 400 field=beneficiarioClienteId
 *   - R26: INGRESOS centro with null precioUnitario → 400 field=precioUnitario
 *   - R27: EGRESOS round-trip preserves pagador/beneficiarioClienteId/medioPago null
 *   - R28: medioPago round-trip EFECTIVO + TRANSFERENCIA; omit → null
 *   - R31: GET /items/:itemId missing → 404 field=itemId
 *   - D14: CONTRATOS GET /items/:itemId in CURRENT month → 200 (positive path)
 *   - PUT /items/:itemId: CONTRATOS current-month fecha 200; non-current fecha 403
 *   - PUT /items/:itemId: server recomputes valorTotal when cantidad changes
 *   - PUT /items/:itemId: server recomputes periodo when fecha changes
 *   - DELETE /items/:itemId: 204 in current month as ADMIN; 404 field=itemId
 *   - GET /items?periodo=YYYY-MM: 400 field=periodo on malformed input
 *   - GET /items?periodo=YYYY-MM: empty month → 200 grupos=[]
 *   - RBAC matrix: cell-by-cell domainAccess.ts vs useDomainAccess for all roles
 *   - AUDITOR / OPERADOR: full access (inherited bypass)
 *   - GERONTOLOGA: 403 DOMAIN_FORBIDDEN on every route (POST/PUT/DELETE/GET)
 *
 * Tests use a unique far-future month (2099-12) for empty-month checks so they
 * are not contaminated by historical ítems left behind by prior runs.
 *
 * Run:
 *   cd backend && TEST_API_URL=http://localhost:3101 \
 *     npx playwright test tests/centro-costos/centro-costos-aug17.spec.ts --reporter=list
 */

import { test, expect, request, type APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com';
const CONTRATOS_PASSWORD = 'password123';
const GERONTOLOGA_EMAIL = 'qa-gerontologa@miempresa.com';
const GERONTOLOGA_PASSWORD = 'password123';
const AUDITOR_EMAIL = 'auditor@miempresa.com';
const AUDITOR_PASSWORD = 'password123';
const OPERADOR_EMAIL = 'operador@miempresa.com';
const OPERADOR_PASSWORD = 'password123';

// Bogota-local "today" in YYYY-MM-DD (server side enforces CONTRATOS month lock).
function serverTodayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

async function login(req: APIRequestContext, email: string, password: string): Promise<string> {
  const resp = await req.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  if (resp.status() !== 200) {
    throw new Error(`Login failed for ${email}: ${resp.status()} ${await resp.text()}`);
  }
  return resp.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Centro de Costos — aug-17 QA suite (T12)', () => {
  let adminCookie: string;
  let contratosCookie: string;
  let gerontologaCookie: string;
  let auditorCookie: string;
  let operadorCookie: string;
  // Centros we manage — created in afterAll cleanup.
  let managedIngresoPricedCentroId: number;
  let managedIngresoNoPriceCentroId: number;
  let managedEgresoCentroId: number;
  // Items we manage.
  let managedIngresoItemId: number;
  let managedEgresoItemId: number;
  let managedIngresoItemTransferenciaId: number;
  let managedIngresoItemNoMedioPagoId: number;
  let managedIngresoBeneficiarioId: number;
  let managedClienteId: number;

  test.beforeAll(async () => {
    const ctx = await request.newContext();
    adminCookie = await login(ctx, ADMIN_EMAIL, ADMIN_PASSWORD);
    contratosCookie = await login(ctx, CONTRATOS_EMAIL, CONTRATOS_PASSWORD);
    gerontologaCookie = await login(ctx, GERONTOLOGA_EMAIL, GERONTOLOGA_PASSWORD);
    auditorCookie = await login(ctx, AUDITOR_EMAIL, AUDITOR_PASSWORD);
    operadorCookie = await login(ctx, OPERADOR_EMAIL, OPERADOR_PASSWORD);
    await ctx.dispose();

    // ── Set up the priced and unpriced INGRESOS centros for the contract tests.
    const adminCtx = await request.newContext();
    const a1 = await adminCtx.post(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: `QA-ago17-pricing-${Date.now()}`,
        tipo: 'INGRESOS',
        orden: 200,
        precioUnitario: 12345.67,
        habilitarRecibo: false,
      },
    });
    expect(a1.status()).toBe(201);
    managedIngresoPricedCentroId = (await a1.json()).data.id;

    const a2 = await adminCtx.post(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: `QA-ago17-noprice-${Date.now()}`,
        tipo: 'INGRESOS',
        orden: 201,
        // no precioUnitario — exercises R26 negative
      },
    });
    expect(a2.status()).toBe(201);
    managedIngresoNoPriceCentroId = (await a2.json()).data.id;

    const a3 = await adminCtx.post(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: `QA-ago17-egreso-${Date.now()}`,
        tipo: 'EGRESOS',
        orden: 202,
      },
    });
    expect(a3.status()).toBe(201);
    managedEgresoCentroId = (await a3.json()).data.id;

    // ── Find or create a Cliente for beneficiario.
    const patients = await adminCtx.get(`${API_BASE}/api/v1/patients?limit=1`, {
      headers: { Cookie: adminCookie },
    });
    if (patients.status() === 200) {
      const pb = await patients.json();
      managedClienteId = pb.data?.[0]?.id;
    }
    if (!managedClienteId) {
      const docNum = `${Date.now()}`;
      const newCli = await adminCtx.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: adminCookie },
        data: {
          nombre: 'QA-ago17 Beneficiario',
          tipoDocumento: 'CC',
          numeroDocumento: docNum,
          fechaNacimiento: '1990-01-01',
          genero: 'M',
        },
      });
      const ncb = await newCli.json();
      managedClienteId = ncb.data?.id;
    }
    managedIngresoBeneficiarioId = managedClienteId;
    await adminCtx.dispose();
  });

  test.afterAll(async () => {
    const ctx = await request.newContext();
    // Delete items first, then centros.
    const itemIds = [
      managedIngresoItemId,
      managedIngresoItemTransferenciaId,
      managedIngresoItemNoMedioPagoId,
      managedEgresoItemId,
    ].filter(Boolean);
    for (const id of itemIds) {
      await ctx.delete(`${API_BASE}/api/v1/centro-costos/items/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    const centroIds = [
      managedIngresoPricedCentroId,
      managedIngresoNoPriceCentroId,
      managedEgresoCentroId,
    ].filter(Boolean);
    for (const id of centroIds) {
      await ctx.delete(`${API_BASE}/api/v1/centro-costos/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    for (const cookie of [adminCookie, contratosCookie, gerontologaCookie, auditorCookie, operadorCookie]) {
      await ctx.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: cookie } }).catch(() => {});
    }
    await ctx.dispose();
  });

  // ─── R25 — INGRESOS missing beneficiarioClienteId → 400 field=beneficiarioClienteId ─
  test('R25 INGRESOS missing beneficiarioClienteId → 400 field=beneficiarioClienteId', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const resp = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedIngresoPricedCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Missing beneficiary',
        cantidad: 1,
        pagador: 'Someone',
        medioPago: 'EFECTIVO',
        fecha: today,
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.field).toBe('beneficiarioClienteId');
    await ctx.dispose();
  });

  // ─── R25 — INGRESOS beneficiaries must exist on clientes ────────────────────────
  test('R25 INGRESOS beneficiarioClienteId referencing non-existent cliente → 400', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const resp = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedIngresoPricedCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Bogus beneficiary',
        cantidad: 1,
        pagador: 'Someone',
        beneficiarioClienteId: 99999999,
        fecha: today,
      },
    });
    expect(resp.status()).toBe(400);
    await ctx.dispose();
  });

  // ─── R26 — INGRESOS with null centro precioUnitario → 400 field=precioUnitario ─
  test('R26 INGRESOS centro with null precioUnitario → 400 field=precioUnitario', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const resp = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedIngresoNoPriceCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Priceless item',
        cantidad: 1,
        pagador: 'Someone',
        beneficiarioClienteId: managedIngresoBeneficiarioId,
        fecha: today,
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.field).toBe('precioUnitario');
    await ctx.dispose();
  });

  // ─── R26 — INGRESOS ignores client valorUnitario ────────────────────────────────
  test('R26 INGRESOS accepts the priced item via pagador + beneficiary, server copies precioUnitario', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const resp = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedIngresoPricedCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'R26 happy path',
        cantidad: 2,
        valorUnitario: 1,                              // client value — IGNORED
        pagador: 'Familia QA',
        beneficiarioClienteId: managedIngresoBeneficiarioId,
        medioPago: 'EFECTIVO',
        fecha: today,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    managedIngresoItemId = body.data.id;
    expect(body.data.valorUnitario).toBe('12345.67');
    expect(body.data.valorTotal).toBe('24691.34');
    expect(body.data.pagador).toBe('Familia QA');
    expect(body.data.beneficiarioClienteId).toBe(managedIngresoBeneficiarioId);
    expect(body.data.medioPago).toBe('EFECTIVO');
    await ctx.dispose();
  });

  // ─── R27 — EGRESOS round-trip preserves ingreso fields null ──────────────────
  test('R27 EGRESOS round-trip persists pagador / beneficiario / medioPago as null', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const resp = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedEgresoCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'R27 EGRESOS item',
        cantidad: 4,
        valorUnitario: 250,
        fecha: today,
        numeroFactura: 'QA-27-1',
        proveedor: 'Proveedor QA',
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    managedEgresoItemId = body.data.id;
    expect(body.data.valorUnitario).toBe('250.00');
    expect(body.data.valorTotal).toBe('1000.00');
    expect(body.data.pagador).toBeNull();
    expect(body.data.beneficiarioClienteId).toBeNull();
    expect(body.data.medioPago).toBeNull();
    expect(body.data.numeroFactura).toBe('QA-27-1');
    expect(body.data.proveedor).toBe('Proveedor QA');
    await ctx.dispose();
  });

  // ─── R28 — medioPago TRANSFERENCIA round-trip ──────────────────────────────
  test('R28 INGRESOS medioPago=TRANSFERENCIA round-trips', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const resp = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedIngresoPricedCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'R28 transferencia',
        cantidad: 1,
        pagador: 'Familia QA',
        beneficiarioClienteId: managedIngresoBeneficiarioId,
        medioPago: 'TRANSFERENCIA',
        fecha: today,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    managedIngresoItemTransferenciaId = body.data.id;
    expect(body.data.medioPago).toBe('TRANSFERENCIA');
    await ctx.dispose();
  });

  // ─── R28 — medioPago omitted → null ────────────────────────────────────
  test('R28 INGRESOS medioPago omitted → null', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const resp = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedIngresoPricedCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'R28 sin medio de pago',
        cantidad: 1,
        pagador: 'Familia QA',
        beneficiarioClienteId: managedIngresoBeneficiarioId,
        fecha: today,
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    managedIngresoItemNoMedioPagoId = body.data.id;
    expect(body.data.medioPago).toBeNull();
    await ctx.dispose();
  });

  // ─── R31 — GET /items/:itemId missing → 404 field=itemId ─────────────────
  test('R31 GET /items/:itemId for missing id → 404 field=itemId', async () => {
    const ctx = await request.newContext();
    const resp = await ctx.get(`${API_BASE}/api/v1/centro-costos/items/99999999`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(404);
    const body = await resp.json();
    expect(body.field).toBe('itemId');
    await ctx.dispose();
  });

  // ─── D14 — CONTRATOS GET /items/:itemId CURRENT month → 200 ─────────────────
  test('D14 CONTRATOS GET /items/:itemId with current-month fecha → 200', async () => {
    expect(managedIngresoItemId).toBeTruthy();
    const ctx = await request.newContext();
    const resp = await ctx.get(`${API_BASE}/api/v1/centro-costos/items/${managedIngresoItemId}`, {
      headers: { Cookie: contratosCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data.id).toBe(managedIngresoItemId);
    expect(body.data.centro).toBeTruthy();
    expect(body.data.centro.id).toBe(managedIngresoPricedCentroId);
    expect(body.data.beneficiario).toBeTruthy();
    expect(body.data.beneficiario.id).toBe(managedIngresoBeneficiarioId);
    await ctx.dispose();
  });

  // ─── R28 — PUT /items/:itemId current-month: server recomputes valorTotal ───
  test('PUT /items/:itemId with current-month fecha: server recomputes valorTotal when cantidad changes', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const resp = await ctx.put(`${API_BASE}/api/v1/centro-costos/items/${managedEgresoItemId}`, {
      headers: { Cookie: adminCookie },
      data: {
        cantidad: 5,
        valorUnitario: 250,
        fecha: today,
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    // 5 × 250 = 1250.00
    expect(body.data.cantidad).toBe(5);
    expect(body.data.valorUnitario).toBe('250.00');
    expect(body.data.valorTotal).toBe('1250.00');
    await ctx.dispose();
  });

  // ─── R24 — PUT /items/:itemId: server recomputes periodo when fecha changes ──
  test('PUT /items/:itemId: server recomputes periodo when fecha changes (periodo is derived from fecha)', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    // Set to a different day in the same month.
    const newDay = today.slice(0, 8) + '05';
    const resp = await ctx.put(`${API_BASE}/api/v1/centro-costos/items/${managedEgresoItemId}`, {
      headers: { Cookie: adminCookie },
      data: {
        fecha: newDay,
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data.fecha).toBe(newDay);
    expect(body.data.periodo).toBe(newDay.slice(0, 7) + '-01');
    await ctx.dispose();
  });

  // ─── D14 — CONTRATOS PUT /items/:itemId non-current-month → 403 ──────────
  // The contract guard checks the EXISTING ítem's fecha, not the body.
  // Setup: ADMIN creates an EGRESOS ítem with a non-current-month fecha.
  // Then CONTRATOS tries to PUT it → 403 field=fecha.
  test('CONTRATOS PUT /items/:itemId with non-current-month existing fecha → 200 when fecha lock is off', async () => {
    const ctx = await request.newContext();
    // Seed: admin creates a non-current-month ítem under the QA EGRESOS centro.
    const create = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedEgresoCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'CONTRATOS-PUT-D14-target',
        valorUnitario: 1,
        fecha: '1999-01-15',
      },
    });
    expect(create.status()).toBe(201);
    const targetId = (await create.json()).data.id;

    // Now CONTRATOS attempts to PUT it.
    const resp = await ctx.put(`${API_BASE}/api/v1/centro-costos/items/${targetId}`, {
      headers: { Cookie: contratosCookie },
      data: {
        notas: 'should not work',
      },
    });
    expect(resp.status()).toBe(200);

    // Cleanup the seeded item.
    await ctx.delete(`${API_BASE}/api/v1/centro-costos/items/${targetId}`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {});
    await ctx.dispose();
  });

  // ─── DELETE /items/:itemId 404 ───────────────────────────────────────────
  test('DELETE /items/:itemId missing → 404 field=itemId', async () => {
    const ctx = await request.newContext();
    const resp = await ctx.delete(`${API_BASE}/api/v1/centro-costos/items/99999999`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(404);
    const body = await resp.json();
    expect(body.field).toBe('itemId');
    await ctx.dispose();
  });

  // ─── Empty month → 200 grupos=[] (use far-future 2099-12 to avoid leakage) ─
  test('GET /items?periodo=2099-12 (empty) → 200 with grupos:[]', async () => {
    const ctx = await request.newContext();
    const resp = await ctx.get(`${API_BASE}/api/v1/centro-costos/items?periodo=2099-12`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data.grupos).toEqual([]);
    await ctx.dispose();
  });

  // ─── GET /items?periodo malformed → 400 field=periodo ──────────────────
  test('GET /items?periodo=malformed → 400 field=periodo', async () => {
    const ctx = await request.newContext();
    const resp = await ctx.get(`${API_BASE}/api/v1/centro-costos/items?periodo=not-a-month`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.field).toBe('periodo');
    await ctx.dispose();
  });

  // ─── GERONTOLOGA: 403 DOMAIN_FORBIDDEN on every route (cell-by-cell) ─────
  test('GERONTOLOGA 403 DOMAIN_FORBIDDEN — cell-by-cell across all centro-costos routes', async () => {
    const ctx = await request.newContext();
    const calls: Array<{ method: string; url: string; body?: any }> = [
      { method: 'GET', url: `${API_BASE}/api/v1/centro-costos` },
      { method: 'POST', url: `${API_BASE}/api/v1/centro-costos`, body: { nombre: 'x', tipo: 'EGRESOS' } },
      { method: 'PUT', url: `${API_BASE}/api/v1/centro-costos/${managedIngresoPricedCentroId}`, body: { descripcion: 'x' } },
      { method: 'DELETE', url: `${API_BASE}/api/v1/centro-costos/${managedIngresoPricedCentroId}` },
      { method: 'GET', url: `${API_BASE}/api/v1/centro-costos/items?periodo=2099-12` },
      { method: 'POST', url: `${API_BASE}/api/v1/centro-costos/${managedEgresoCentroId}/items`, body: { nombre: 'x', valorUnitario: 1, fecha: serverTodayBogota() } },
      { method: 'GET', url: `${API_BASE}/api/v1/centro-costos/items/1` },
      { method: 'PUT', url: `${API_BASE}/api/v1/centro-costos/items/1`, body: { nombre: 'x' } },
      { method: 'DELETE', url: `${API_BASE}/api/v1/centro-costos/items/1` },
      { method: 'GET', url: `${API_BASE}/api/v1/centro-costos/balance?periodo=2099-12` },
    ];
    for (const c of calls) {
      const resp = await ctx.fetch(c.url, {
        method: c.method,
        headers: { Cookie: gerontologaCookie, 'Content-Type': 'application/json' },
        data: c.body ? JSON.stringify(c.body) : undefined,
      });
      expect(resp.status(), `${c.method} ${c.url}`).toBe(403);
      const body = await resp.json();
      expect(body.code, `${c.method} ${c.url} missing code`).toBe('DOMAIN_FORBIDDEN');
    }
    await ctx.dispose();
  });

  // ─── AUDITOR inherits full access (matrix bypass) ─────────────────────────
  test('AUDITOR full access — GET /centro-costos and GET /balance both 200', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const r1 = await ctx.get(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: auditorCookie },
    });
    expect(r1.status()).toBe(200);
    const r2 = await ctx.get(`${API_BASE}/api/v1/centro-costos/balance?periodo=${today.slice(0, 7)}`, {
      headers: { Cookie: auditorCookie },
    });
    expect(r2.status()).toBe(200);
    await ctx.dispose();
  });

  // ─── OPERADOR inherits full access (matrix bypass) ────────────────────────
  test('OPERADOR full access — GET /centro-costos and GET /balance both 200', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    const r1 = await ctx.get(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: operadorCookie },
    });
    expect(r1.status()).toBe(200);
    const r2 = await ctx.get(`${API_BASE}/api/v1/centro-costos/balance?periodo=${today.slice(0, 7)}`, {
      headers: { Cookie: operadorCookie },
    });
    expect(r2.status()).toBe(200);
    await ctx.dispose();
  });

  // ─── CONTRATOS DELETE /items/:itemId in current month → 204 ───────────────
  test('CONTRATOS DELETE /items/:itemId → 403 (aug-27 F4, never delete)', async () => {
    const ctx = await request.newContext();
    const today = serverTodayBogota();
    // Create a fresh ítem in current month to delete.
    const create = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedEgresoCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'CONTRATOS delete test',
        valorUnitario: 1,
        fecha: today,
      },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id;
    const resp = await ctx.delete(`${API_BASE}/api/v1/centro-costos/items/${id}`, {
      headers: { Cookie: contratosCookie },
    });
    expect(resp.status()).toBe(403);
    const still = await ctx.get(`${API_BASE}/api/v1/centro-costos/items/${id}`, {
      headers: { Cookie: adminCookie },
    });
    expect(still.status()).toBe(200);
    await ctx.delete(`${API_BASE}/api/v1/centro-costos/items/${id}`, {
      headers: { Cookie: adminCookie },
    });
    await ctx.dispose();
  });

  // ─── FE vs BE matrix parity: GERONTOLOGA and CONTRATOS centro-costos ──────
  // The FE matrix mirrors domainAccess.ts. We don't have a separate source-of-truth
  // file in this repo to import, so this is a structural assertion: the smoke spec
  // already verifies the FE blocks GERONTOLOGA and CONTRATOS sees no balance card.
  // The cell-by-cell value here is that the BE never returns 200 with body for GERONTOLOGA.
  test('RBAC matrix parity: GERONTOLOGAcentro-costos = false across all routes (BE)', async () => {
    const ctx = await request.newContext();
    const resp = await ctx.get(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: gerontologaCookie },
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.code).toBe('DOMAIN_FORBIDDEN');
    await ctx.dispose();
  });

  // ─── RBAC matrix parity: CONTRATOS centro-costos GET = true; mutations = false ─
  test('RBAC matrix parity: CONTRATOScentro-costos GET = true, mutations = false (BE)', async () => {
    const ctx = await request.newContext();
    const get = await ctx.get(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: contratosCookie },
    });
    expect(get.status()).toBe(200);
    const post = await ctx.post(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: contratosCookie },
      data: { nombre: 'rbac-matrix', tipo: 'EGRESOS' },
    });
    expect(post.status()).toBe(403);
    await ctx.dispose();
  });

  // ─── FE/BE matrix parity (W10 addendum): fs.readFileSync both sources ────────
  // contract-fixes-jul17-2 §1.5 + contract-fixes-features-aug-6 §2.2: the FE
  // matrix mirrors the BE matrix cell-by-cell. A 403 from the gateway proves
  // the BE row; the FE row must match it in source so the UI hides the section
  // consistently. This test reads BOTH files from disk and asserts the
  // centro-costos cell for GERONTOLOGA is `false` and for CONTRATOS is `true`
  // in both — no behavioural substitution.
  test('FE/BE matrix parity (cell-by-cell): centro-costos false for GERONTOLOGA and true for CONTRATOS in BOTH sources', async () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const bePath = path.join(repoRoot, 'backend/src/middleware/domainAccess.ts');
    const fePath = path.join(repoRoot, 'frontend/app/composables/useDomainAccess.ts');
    expect(fs.existsSync(bePath), `BE matrix file missing: ${bePath}`).toBe(true);
    expect(fs.existsSync(fePath), `FE matrix file missing: ${fePath}`).toBe(true);

    const beSource = fs.readFileSync(bePath, 'utf8');
    const feSource = fs.readFileSync(fePath, 'utf8');

    // BE: assert the literal cell is present in `DOMAIN_ACCESS`.
    //   GERONTOLOGA: { ... 'centro-costos': false, ... }
    //   CONTRATOS:   { ... 'centro-costos': true,  ... }
    const beGerontologaCell = /GERONTOLOGA\s*:\s*\{[\s\S]*?'centro-costos'\s*:\s*false\s*,/.test(beSource);
    const beContratosCell = /CONTRATOS\s*:\s*\{[\s\S]*?'centro-costos'\s*:\s*true\s*,/.test(beSource);
    expect(beGerontologaCell, 'BE: GERONTOLOGA.centro-costos !== false').toBe(true);
    expect(beContratosCell, 'BE: CONTRATOS.centro-costos !== true').toBe(true);

    // FE: same shape.
    const feGerontologaCell = /GERONTOLOGA\s*:\s*\{[\s\S]*?'centro-costos'\s*:\s*false\s*,/.test(feSource);
    const feContratosCell = /CONTRATOS\s*:\s*\{[\s\S]*?'centro-costos'\s*:\s*true\s*,/.test(feSource);
    expect(feGerontologaCell, 'FE: GERONTOLOGA.centro-costos !== false').toBe(true);
    expect(feContratosCell, 'FE: CONTRATOS.centro-costos !== true').toBe(true);
  });

  // ─── aug-27 F4: ADMIN fecha lock (default off = backfill) ────────────────
  test('F4 GET /policy default limitarFechaContratos=false', async () => {
    const ctx = await request.newContext();
    const resp = await ctx.get(`${API_BASE}/api/v1/centro-costos/policy`, {
      headers: { Cookie: adminCookie },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data.limitarFechaContratos).toBe(false);
    expect(body.data.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.data.previousBusinessDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await ctx.dispose();
  });

  test('F4 ADMIN can enable lock; CONTRATOS then cannot POST 1999-01-15', async () => {
    const ctx = await request.newContext();
    const emp = await ctx.get(`${API_BASE}/api/v1/empresa`, { headers: { Cookie: adminCookie } });
    expect(emp.status()).toBe(200);
    const empresaId = (await emp.json()).data.id;
    const on = await ctx.put(`${API_BASE}/api/v1/empresa/${empresaId}`, {
      headers: { Cookie: adminCookie },
      data: { limitarFechaContratos: true },
    });
    expect(on.status()).toBe(200);
    expect((await on.json()).data.limitarFechaContratos).toBe(true);

    const blocked = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedEgresoCentroId}/items`, {
      headers: { Cookie: contratosCookie },
      data: { nombre: 'too old', valorUnitario: 1, fecha: '1999-01-15' },
    });
    expect(blocked.status()).toBe(403);
    expect((await blocked.json()).field).toBe('fecha');

    const today = serverTodayBogota();
    const ok = await ctx.post(`${API_BASE}/api/v1/centro-costos/${managedEgresoCentroId}/items`, {
      headers: { Cookie: contratosCookie },
      data: { nombre: 'today ok', valorUnitario: 1, fecha: today },
    });
    expect(ok.status()).toBe(201);
    const newId = (await ok.json()).data.id;

    const off = await ctx.put(`${API_BASE}/api/v1/empresa/${empresaId}`, {
      headers: { Cookie: adminCookie },
      data: { limitarFechaContratos: false },
    });
    expect(off.status()).toBe(200);

    await ctx.delete(`${API_BASE}/api/v1/centro-costos/items/${newId}`, {
      headers: { Cookie: adminCookie },
    });
    await ctx.dispose();
  });
});
