/**
 * LOCAL QA — jul-10 (W3 — T7): C4 lazy flip PENDIENTE→VENCIDO on read.
 *
 * Reference: schema-contract-jul10.md §5.B — `flipExpiredFichas(prisma, clienteId?)`
 * runs BEFORE getPatient so subsequent reads reflect the flipped estado.
 *
 * Approach: seed a past-due PENDIENTE row directly via the test prisma client
 * (no API endpoint to set fechaVencimiento retroactively on PENDIENTE), then
 * GET /patients/:id and assert the row's estado reads as VENCIDO.
 *
 * Cleanup deletes the seeded row in afterAll.
 */
import { test, expect } from '@playwright/test';
import { getPrisma } from '../../src/config/database.js';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

test.describe.configure({ mode: 'serial' });

test.describe('Ficha lazy-flip C4 (jul-10)', () => {
  let adminCookie: string;
  let patientId: number;
  let instrumentId: number;
  let createdFichaId: number;
  const pastDue = '2024-01-01';

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    adminCookie = loginRes.headers()['set-cookie'];

    // Pick first patient
    const list = await request.get(`${API_BASE}/api/v1/patients?limit=1`, {
      headers: { Cookie: adminCookie },
    });
    const data = (await list.json()).data;
    expect(data?.length).toBeGreaterThan(0);
    patientId = data[0].id;

    // Pick an instrument
    const insRes = await request.get(`${API_BASE}/api/v1/instruments?limit=1`, {
      headers: { Cookie: adminCookie },
    });
    const ins = (await insRes.json()).data;
    expect(ins?.length).toBeGreaterThan(0);
    instrumentId = ins[0].id;
  });

  test.afterAll(async ({ request }) => {
    if (createdFichaId) {
      // Delete via raw prisma to bypass the PENDIENTE-only delete guard
      const prisma = getPrisma();
      await prisma.registroFichaCompletada.delete({
        where: { id: createdFichaId },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: adminCookie } }).catch(() => {});
  });

  test('GET patient flips past-due PENDIENTE row to VENCIDO (C4)', async ({ request }) => {
    // Seed via prisma directly: get the admin user id (responsable)
    const prisma = getPrisma();
    const adminUser = await prisma.usuario.findUnique({ where: { email: ADMIN_EMAIL } });
    expect(adminUser, 'admin user must exist').toBeTruthy();

    const seeded = await prisma.registroFichaCompletada.create({
      data: {
        clienteId: patientId,
        instrumentoId: instrumentId,
        estado: 'PENDIENTE',
        versionRegistro: 'vC4-test',
        responsable: adminUser!.id,
        fechaVencimiento: new Date(pastDue),
      },
    });
    createdFichaId = seeded.id;

    // GET patient → C4 flip happens before the include. Row should now be VENCIDO.
    const get = await request.get(`${API_BASE}/api/v1/patients/${patientId}`, {
      headers: { Cookie: adminCookie },
    });
    expect(get.status()).toBe(200);
    const detail = (await get.json()).data;
    const found = detail.registrosFichas.find((r: any) => r.id === createdFichaId);
    expect(found, 'seeded ficha should appear in patient detail').toBeDefined();
    expect(found.estado).toBe('VENCIDO');
  });
});
