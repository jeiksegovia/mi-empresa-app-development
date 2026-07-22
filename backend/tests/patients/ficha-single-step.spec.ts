/**
 * LOCAL QA — jul-10 (W3 — T7): C1 single-step ficha.
 *
 * W5 modernization (2026-07-17): the legacy `archivoCompletado` /
 * `singleStepCompleted` / `plantillaArchivo` fields were REMOVED in
 * contract §3.2/§3.3 + W4 endpoint evolution. Per contract §4.3:
 *   - POST without `respuestas` → legacy PENDIENTE flow (kept as-is)
 *   - POST with `respuestas` → atomic single-step assign+complete:
 *     estado=COMPLETADO, fechaCompletado=now
 * This spec was modernized to assert the new shape; old assertions on
 * removed fields were dropped (no behaviour loosening — just field
 * removal that the contract no longer carries).
 *
 * Reference: schema-contract-instrumentos-dynamic-fichas.md §4.3.
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101';
const ADMIN_EMAIL = 'admin@miempresa.com';
const ADMIN_PASSWORD = 'password123';

test.describe.configure({ mode: 'serial' });

test.describe('Ficha single-step C1 (jul-10, modernized W5)', () => {
  let adminCookie: string;
  let patientId: number;
  // Resolve a dynamic instrument (BARTHEL) so we can build a valid
  // respuestas payload for the single-step completion path. Falls back
  // to any ACTIVO instrument for the PENDIENTE branch (no answers needed).
  let barthelId: number;
  let legacyInstrumentId: number;
  const createdFichaIds: number[] = [];
  let createdPatient = false;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    adminCookie = loginRes.headers()['set-cookie'];

    // Pick or create a patient
    const list = await request.get(`${API_BASE}/api/v1/patients?limit=1`, { headers: { Cookie: adminCookie } });
    const listBody = await list.json();
    if (listBody.data?.length > 0) {
      patientId = listBody.data[0].id;
    } else {
      const uniq = `C1PAT-${Date.now()}`;
      const created = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: adminCookie },
        data: {
          nombre: `C1 PATIENT`,
          tipoDocumento: 'CC',
          numeroDocumento: uniq,
          genero: 'FEMENINO',
          fechaNacimiento: '1990-01-01',
        },
      });
      patientId = (await created.json()).data.id;
      createdPatient = true;
    }

    // Pick an active instrument with an active version (dynamic ones).
    // The legacy "first ACTIVO instrument" trap: legacy placeholder
    // instruments (FVM-001, NUT-001, ADM-001) have NO InstrumentoVersion
    // and return NO_ACTIVE_VERSION on POST. Only dynamic codigos
    // (BARTHEL, MINI_MENTAL, etc.) have an active version — so we
    // must filter for `activeVersion` to be safe.
    const instrRes = await request.get(`${API_BASE}/api/v1/instruments?estado=ACTIVO&limit=100`, {
      headers: { Cookie: adminCookie },
    });
    const instrBody = await instrRes.json();
    expect(instrBody.data?.length, 'need at least one ACTIVO instrument').toBeGreaterThan(0);
    // Pick a dynamic instrument for the PENDIENTE branch.
    const withActiveVersion = (instrBody.data as any[]).filter((r) => r.activeVersion)
    expect(withActiveVersion.length, 'need at least one ACTIVO instrument with activeVersion').toBeGreaterThan(0);
    legacyInstrumentId = withActiveVersion[0].id;
    const barthel = instrBody.data.find((r: any) => r.codigo === 'BARTHEL');
    expect(barthel, 'BARTHEL must be seeded').toBeTruthy();
    barthelId = barthel.id;
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup of created fichas
    for (const id of createdFichaIds) {
      await request.delete(`${API_BASE}/api/v1/patients/${patientId}/fichas/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    if (createdPatient && patientId) {
      await request.delete(`${API_BASE}/api/v1/patients/${patientId}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {});
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: adminCookie } }).catch(() => {});
  });

  // C1 (modernized): POST without respuestas → legacy PENDIENTE flow.
  // The old assertion on `singleStepCompleted` / `archivoCompletado`
  // is dropped (those fields no longer exist on the response shape).
  test('POST sin respuestas → legacy PENDIENTE (no singleStepCompleted field)', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: { instrumentoId: legacyInstrumentId, versionRegistro: 'v1.0' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.estado).toBe('PENDIENTE');
    expect(body.data.fechaCompletado).toBeNull();
    expect(body.data.respuestas).toBeNull();
    expect(body.data.puntajeTotal).toBeNull();
    expect(body.data.clasificacion).toBeNull();
    // Removed fields must NOT be on the response (no zombie values).
    expect(body.data).not.toHaveProperty('singleStepCompleted');
    expect(body.data).not.toHaveProperty('archivoCompletado');
    createdFichaIds.push(body.data.id);
  });

  // C1 (modernized): POST with respuestas → atomic single-step
  // assign+complete (contract §4.3). For BARTHEL all-max: total=100,
  // clasificacion="Dependencia ligera".
  test('POST con respuestas (BARTHEL all-max) → single-step COMPLETADO', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: {
        instrumentoId: barthelId,
        versionRegistro: 'v1.0',
        respuestas: barthelMaxAnswer(),
        notasObservaciones: 'jul10 c1 single-step (modernized)',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.estado).toBe('COMPLETADO');
    expect(body.data.fechaCompletado).toBeTruthy();
    expect(body.data.respuestas.comida).toBe('independiente');
    expect(body.data.puntajeTotal).toBe(100);
    expect(body.data.clasificacion).toBe('Dependencia ligera');
    expect(body.data.subtotales.abvd).toBe(100);
    expect(body.data.skippedSections).toEqual([]);
    // Removed fields must NOT be on the response.
    expect(body.data).not.toHaveProperty('singleStepCompleted');
    expect(body.data).not.toHaveProperty('archivoCompletado');
    // Round-trip via GET patient.
    const get = await request.get(`${API_BASE}/api/v1/patients/${patientId}`, {
      headers: { Cookie: adminCookie },
    });
    expect(get.status()).toBe(200);
    const detail = (await get.json()).data;
    const found = detail.registrosFichas.find((r: any) => r.id === body.data.id);
    expect(found).toBeDefined();
    expect(found.estado).toBe('COMPLETADO');
    createdFichaIds.push(body.data.id);
  });
});

// BARTHEL all-max answer (mirrors api-fichas.spec.ts helper).
function barthelMaxAnswer(): Record<string, string> {
  return {
    comida: 'independiente', // 10
    lavado: 'independiente', // 5
    vestido: 'independiente', // 10
    arreglo: 'independiente', // 5
    deposicion: 'continente', // 10
    miccion: 'continente', // 10
    retrete: 'independiente', // 10
    transferencia: 'independiente', // 15
    deambulacion: 'independiente', // 15
    desniveles: 'independiente', // 10
  }
}
