/**
 * LOCAL QA — jul-9 (W4 — T13): B1/B2 NotaCliente required `fechaIncidente`
 * with L3 hard 2-business-day rule.
 *
 * Reference: `development/improvements-jul-9/orchestration-ctx/decisions/schema-contract-jul9.md`
 * §5.5 — `businessDaysBetween` (weekday-only, no holiday table).
 *
 * Deterministic date math (relative to "now" at test start):
 *   today      = new Date() at suite startup        ─ uses local-calendar getters
 *   yesterday  = weekday 1 day back
 *   future     = today + 1 day
 *   tooOld     = 10 weekdays back
 *
 * The L3 rule (from util/businessDays.ts.isWithinLastBusinessDays):
 *   - Reject if candidate > now (future)
 *   - Accept if back <= 2 business days
 *   - Reject if back > 2 business days
 *
 * Weekday handling notes:
 *   - When today=Monday, "1 business day back" should be Friday (skip Sat/Sun).
 *     We compute "yesterday-weekday" by walking backward until `isWeekday`.
 *   - When today=Wednesday, yesterday-weekday = Tuesday (1 weekday back).
 *   - "Future" date is today+1 local-calendar day.
 *   - "Too old" date = 10 weekdays back (always rejected by the 2-day window).
 *
 * We compute these at `beforeAll` so the test is deterministic across runs in
 * the dev TZ (container is UTC, but the backend uses local-calendar getters).
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let sessionCookie: string;
let patientId: number;

async function loginAndGetCookie(request: any): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

const isWeekday = (d: Date) => {
  const dow = d.getDay();
  return dow !== 0 && dow !== 6;  // not Sun, not Sat
};

const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let today: Date;
let yesterdayWeekday: Date;
let futureDate: Date;
let tooOldDate: Date;

test.describe.configure({ mode: 'serial' });

test.describe('NotaCliente fechaIncidente (jul-9 B1/B2)', () => {
  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginAndGetCookie(request);

    // Compute deterministic date fixtures
    const now = new Date();
    today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    while (!isWeekday(y)) y.setDate(y.getDate() - 1);
    yesterdayWeekday = y;
    const f = new Date(today);
    f.setDate(f.getDate() + 1);
    futureDate = f;
    const t = new Date(today);
    let back = 10;
    while (back > 0) {
      t.setDate(t.getDate() - 1);
      if (isWeekday(t)) back--;
    }
    tooOldDate = t;

    // Pick a seeded patient to attach notes to
    const listRes = await request.get(`${API_BASE}/api/v1/patients?limit=1`, {
      headers: { Cookie: sessionCookie },
    });
    expect(listRes.status()).toBe(200);
    const body = await listRes.json();
    expect(body.data.length).toBeGreaterThan(0);
    patientId = body.data[0].id;
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/logout`, {
      headers: { Cookie: sessionCookie },
    }).catch(() => {});
  });

  test('POST /patients/:id/notes with today\'s date → 201', async ({ request }) => {
    const today_ = fmtYMD(today);
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/notes`, {
      headers: { Cookie: sessionCookie },
      data: {
        tipo: 'NEUTRAL',
        prioridad: 'BAJA',
        contenido: `today note ${today_}`,
        fechaIncidente: today_,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.fechaIncidente).toContain(today_);  // formatted as ISO string
  });

  test('POST /patients/:id/notes with previous weekday → 201', async ({ request }) => {
    const ymd = fmtYMD(yesterdayWeekday);
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/notes`, {
      headers: { Cookie: sessionCookie },
      data: {
        tipo: 'POSITIVA',
        prioridad: 'MEDIA',
        contenido: `yesterday-weekday note ${ymd}`,
        fechaIncidente: ymd,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.fechaIncidente).toContain(ymd);
  });

  test('POST /patients/:id/notes with future date → 400 field=fechaIncidente', async ({ request }) => {
    const ymd = fmtYMD(futureDate);
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/notes`, {
      headers: { Cookie: sessionCookie },
      data: {
        tipo: 'NEUTRAL',
        prioridad: 'BAJA',
        contenido: 'future note',
        fechaIncidente: ymd,
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('fechaIncidente');
  });

  test('POST /patients/:id/notes with missing fechaIncidente → 400 (Zod)', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/notes`, {
      headers: { Cookie: sessionCookie },
      data: {
        tipo: 'NEUTRAL',
        prioridad: 'BAJA',
        contenido: 'missing fechaIncidente',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    // Zod issue path may identify fechaIncidente or message may include the field name
    const flat = JSON.stringify(body).toLowerCase();
    expect(flat).toContain('fechaincidente');
  });

  test('POST /patients/:id/notes with date > 2 business days back → 400 field=fechaIncidente', async ({ request }) => {
    const ymd = fmtYMD(tooOldDate);
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/notes`, {
      headers: { Cookie: sessionCookie },
      data: {
        tipo: 'NEUTRAL',
        prioridad: 'BAJA',
        contenido: 'too old note',
        fechaIncidente: ymd,
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.field).toBe('fechaIncidente');
  });
});
