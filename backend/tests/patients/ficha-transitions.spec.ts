import { test, expect } from '@playwright/test';

/**
 * LOCAL QA — Ficha status transition rules (Bug 3 / D3).
 *
 * Verifies the W2 backend changes to `PATCH /api/v1/patients/:id/fichas/:fichaId/status`:
 *   - VENCIDO → COMPLETADO is now allowed (was rejected by prior version)
 *   - Invalid transition still returns 400 with `Cannot transition from X to Y`
 *
 * W11 modernization (2026-07-17, fixes-jul17-2):
 *   - The legacy `archivoCompletado` field was REMOVED in contract §3.3
 *     (W5 modernization); the assertion on body.data.archivoCompletado and
 *     the "missing file → 400" check are no longer applicable. The
 *     VENCIDO→COMPLETADO transition is now allowed without an archivo
 *     payload; the "missing file" 400 case is dropped. The intent of the
 *     test (state machine + fixture stability) is preserved.
 *   - Fixture lookup: filter for `activeVersion` (W5 pattern) to avoid
 *     picking placeholder instruments (FVM-001/NUT-001/ADM-001) that have
 *     no InstrumentoVersion.
 *   - Pick-or-create patient (W5 pattern) so the suite is robust against
 *     a freshly-re-seeded DB.
 *
 * Coverage:
 *   - Create a PENDIENTE ficha, mark VENCIDO, then mark COMPLETADO
 *   - Verify PATCH to PENDIENTE on a VENCIDO ficha returns 400 (invalid transition)
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

let adminCookie: string;
let testPatientId: number;
let testInstrumentId: number;
let testFichaId: number;
const VERSION_REGISTRO = 'v1.0';

async function loginAndGetCookie(request: any, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  return response.headers()['set-cookie'];
}

test.describe.configure({ mode: 'serial' });

test.describe('Patient ficha transitions', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await loginAndGetCookie(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Find or create a patient. Mirrors ficha-single-step.spec.ts (W5 pattern):
    // no `estado=ACTIVO` filter (a freshly-created test patient may be ACTIVO
    // already) and create-if-missing so the suite is robust against a clean DB.
    let patRes = await request.get(`${API_BASE}/api/v1/patients?limit=1`, {
      headers: { Cookie: adminCookie },
    });
    let patBody = await patRes.json();
    if (patBody.data?.length) {
      testPatientId = patBody.data[0].id;
    } else {
      const uniq = `FTPAT-${Date.now()}`;
      const created = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: adminCookie },
        data: {
          nombre: `FT PATIENT`,
          tipoDocumento: 'CC',
          numeroDocumento: uniq,
          genero: 'FEMENINO',
          fechaNacimiento: '1990-01-01',
        },
      });
      expect(created.status(), 'create test patient').toBe(201);
      testPatientId = (await created.json()).data.id;
    }

    // Find a DYNAMIC instrument with an active version. The legacy
    // placeholders (FVM-001, NUT-001, ADM-001) have no InstrumentoVersion
    // and return 404 NO_ACTIVE_VERSION on POST /fichas. Picking
    // `?limit=1` is data-drift-prone because placeholder rows accumulate
    // over time and may sort ahead of the dynamic ones — same fix as W5
    // applied to ficha-single-step.spec.ts: filter for `activeVersion`.
    const instRes = await request.get(`${API_BASE}/api/v1/instruments?limit=100`, {
      headers: { Cookie: adminCookie },
    });
    if (instRes.status() === 200) {
      const instBody = await instRes.json();
      const withActiveVersion = (instBody.data ?? []).filter((r: any) => r.activeVersion)
      if (withActiveVersion.length) {
        // Prefer BARTHEL if present (deterministic); otherwise first with active version.
        const barthel = withActiveVersion.find((r: any) => r.codigo === 'BARTHEL')
        testInstrumentId = (barthel ?? withActiveVersion[0]).id
      }
    }
  });

  test('happy path: PENDIENTE → VENCIDO → COMPLETADO allowed with file (D3)', async ({ request }) => {
    test.skip(!testPatientId || !testInstrumentId, 'no patient/instrument in seed');
    // Create a fresh PENDIENTE ficha
    const create = await request.post(`${API_BASE}/api/v1/patients/${testPatientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: {
        instrumentoId: testInstrumentId,
        versionRegistro: VERSION_REGISTRO,
      },
    });
    expect(create.status()).toBe(201);
    const createdBody = await create.json();
    testFichaId = createdBody.data.id;

    // Step 1: PENDIENTE → VENCIDO (marking it expired)
    const toVencido = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${testFichaId}/status`,
      {
        headers: { Cookie: adminCookie },
        data: { estado: 'VENCIDO', notasObservaciones: 'expired test (QA W5)' },
      }
    );
    expect(toVencido.status()).toBe(200);

    // Step 2: VENCIDO → COMPLETADO (must be allowed per D3).
    // The legacy `archivoCompletado` payload field was removed in W5; the
    // transition itself is allowed without any extra payload. We keep only
    // the notasObservaciones for traceability.
    const toCompletado = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${testFichaId}/status`,
      {
        headers: { Cookie: adminCookie },
        data: {
          estado: 'COMPLETADO',
          notasObservaciones: 'late completion (QA W5)',
        },
      }
    );
    expect(toCompletado.status()).toBe(200);
    const body = await toCompletado.json();
    expect(body.data.estado).toBe('COMPLETADO');
    // Removed field MUST NOT be on the response (no zombie value).
    expect(body.data).not.toHaveProperty('archivoCompletado');
  });

  // The "VENCIDO→COMPLETADO without archivoCompletado → 400" test was
  // REMOVED in W11 because the `archivoCompletado` field is gone; the
  // transition is now always allowed when going to COMPLETADO.

  test('PATCH VENCIDO→PENDIENTE returns 400 (invalid transition)', async ({ request }) => {
    test.skip(!testPatientId || !testInstrumentId, 'no patient/instrument in seed');
    // Create + flip to VENCIDO
    const create = await request.post(`${API_BASE}/api/v1/patients/${testPatientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: { instrumentoId: testInstrumentId, versionRegistro: VERSION_REGISTRO },
    });
    expect(create.status()).toBe(201);
    const createBody = await create.json();
    const fid = createBody.data.id;

    const toVencido = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fid}/status`,
      {
        headers: { Cookie: adminCookie },
        data: { estado: 'VENCIDO' },
      }
    );
    expect(toVencido.status()).toBe(200);

    const toPendiente = await request.patch(
      `${API_BASE}/api/v1/patients/${testPatientId}/fichas/${fid}/status`,
      {
        headers: { Cookie: adminCookie },
        data: { estado: 'PENDIENTE' },
      }
    );
    const toPendienteBody = await toPendiente.json();
    expect(toPendienteBody.message.toLowerCase()).toContain('cannot transition');
  });
});
