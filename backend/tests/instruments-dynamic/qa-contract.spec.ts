/**
 * W5 — Contract validation additions for instrumentos-dynamic-fichas.
 *
 * Per task #21 step 4 — covered scenarios:
 *   1. G2-11: POST /patients/:id/fichas with bogus instrumentoVersionId
 *      → 201, response instrumentoVersionId matches the REAL active
 *      version (verified against GET /instruments activeVersion).
 *   2. 403 ROLE_NOT_ALLOWED: login as AUDITOR (not in ADMIN,EMPLEADO
 *      rolesPermitidos) → GET /instruments/BARTHEL/definition → 403 +
 *      code ROLE_NOT_ALLOWED.
 *   3. resultEvaluation boundary sweeps:
 *      - MINI_MENTAL: 26/27 Normal edge, 23/24, 11/12, 8/9
 *      - TINETTI: 24/25, 18/19
 *      Server classification matches the contract ranges.
 *   4. INVALID_STATE: PATCH .../completar on an already-COMPLETADO
 *      ficha → 400 + code INVALID_STATE.
 *   5. Vencimientos + lazy flip: re-run tests/patients/ficha-vencido-flip.spec.ts
 *      and tests/patients/fichas-vencimientos.spec.ts.
 *
 * W6 — Contract addendum (G2-12):
 *   6. G2-12: POST /patients/:id/fichas WITHOUT `versionRegistro` in the
 *      body → 201, persisted `versionRegistro === "v1"` (server-derived
 *      from the resolved active version per contract §4.3).
 *
 * Run:
 *   TEST_API_URL=http://localhost:3101 \
 *     npx playwright test tests/instruments-dynamic/qa-contract.spec.ts
 */

import { test, expect } from '@playwright/test'

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = 'admin@miempresa.com'
const ADMIN_PASSWORD = 'password123'
const AUDITOR_EMAIL = 'auditor@miempresa.com'
const AUDITOR_PASSWORD = 'password123'

test.describe.configure({ mode: 'serial' })

async function login(request: any, email: string, password: string): Promise<string> {
  const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  })
  expect(res.status(), `login for ${email}`).toBe(200)
  return res.headers()['set-cookie']
}

test.describe('W5 — qa-contract validations', () => {
  let adminCookie: string
  let auditorCookie: string
  let patientId: number
  const createdFichaIds: number[] = []
  let createdPatient = false

  // Codigo → id + active version id resolution (admin).
  let barthelId: number
  let barthelVersionId: number
  let miniMentalId: number
  let miniMentalVersionId: number
  let tinettiId: number
  let tinettiVersionId: number
  let mnaId: number
  let mnaVersionId: number

  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    auditorCookie = await login(request, AUDITOR_EMAIL, AUDITOR_PASSWORD)

    // Pick or create a patient.
    const list = await request.get(`${API_BASE}/api/v1/patients?limit=1`, {
      headers: { Cookie: adminCookie },
    })
    const listBody = await list.json()
    if (listBody.data?.length) {
      patientId = listBody.data[0].id
    } else {
      const uniq = `W5Q-${Date.now()}`
      const created = await request.post(`${API_BASE}/api/v1/patients`, {
        headers: { Cookie: adminCookie },
        data: {
          nombre: `W5 QA PATIENT`,
          tipoDocumento: 'CC',
          numeroDocumento: uniq,
          genero: 'FEMENINO',
          fechaNacimiento: '1990-01-01',
        },
      })
      patientId = (await created.json()).data.id
      createdPatient = true
    }

    // Resolve codigo → id + active version id for the dynamic instruments.
    const instList = await request.get(
      `${API_BASE}/api/v1/instruments?estado=ACTIVO&limit=100`,
      { headers: { Cookie: adminCookie } },
    )
    const instBody = await instList.json()
    const map: Record<string, { id: number; versionId: number }> = {}
    for (const row of instBody.data as any[]) {
      if (['BARTHEL', 'MINI_MENTAL', 'TINETTI', 'MNA_CUADRO'].includes(row.codigo)) {
        expect(row.activeVersion, `${row.codigo} must have activeVersion per §4.1`).toBeTruthy()
        map[row.codigo] = { id: row.id, versionId: row.activeVersion.id }
      }
    }
    barthelId = map.BARTHEL.id
    barthelVersionId = map.BARTHEL.versionId
    miniMentalId = map.MINI_MENTAL.id
    miniMentalVersionId = map.MINI_MENTAL.versionId
    tinettiId = map.TINETTI.id
    tinettiVersionId = map.TINETTI.versionId
    mnaId = map.MNA_CUADRO.id
    mnaVersionId = map.MNA_CUADRO.versionId
  })

  test.afterAll(async ({ request }) => {
    for (const id of createdFichaIds) {
      await request
        .delete(`${API_BASE}/api/v1/patients/${patientId}/fichas/${id}`, {
          headers: { Cookie: adminCookie },
        })
        .catch(() => {})
    }
    if (createdPatient && patientId) {
      await request
        .delete(`${API_BASE}/api/v1/patients/${patientId}`, {
          headers: { Cookie: adminCookie },
        })
        .catch(() => {})
    }
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: adminCookie } }).catch(() => {})
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: auditorCookie } }).catch(() => {})
  })

  // ─── 1. G2-11: bogus instrumentoVersionId is ignored ─────────────────────
  test('G2-11: POST with bogus instrumentoVersionId → 201, version id matches real active', async ({
    request,
  }) => {
    // First fetch the real active version id from the public list endpoint.
    const list = await request.get(
      `${API_BASE}/api/v1/instruments?estado=ACTIVO&limit=100`,
      { headers: { Cookie: adminCookie } },
    )
    const realBarthel = (await list.json()).data.find((r: any) => r.codigo === 'BARTHEL')
    expect(realBarthel.activeVersion.id).toBe(barthelVersionId)

    // Now POST with a clearly bogus instrumentoVersionId.
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: {
        instrumentoId: barthelId,
        instrumentoVersionId: 999999, // intentionally wrong
        versionRegistro: 'v1.0',
        respuestas: barthelMaxAnswer(),
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.instrumentoVersionId).toBe(barthelVersionId)
    expect(body.data.instrumentoVersionId).not.toBe(999999)
    expect(body.data.puntajeTotal).toBe(100)
    expect(body.data.clasificacion).toBe('Dependencia ligera')
    createdFichaIds.push(body.data.id)
  })

  // ─── 2. 403 ROLE_NOT_ALLOWED negative path ───────────────────────────────
  test('403 ROLE_NOT_ALLOWED: AUDITOR → GET /instruments/BARTHEL/definition', async ({
    request,
  }) => {
    const res = await request.get(
      `${API_BASE}/api/v1/instruments/BARTHEL/definition`,
      { headers: { Cookie: auditorCookie } },
    )
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('ROLE_NOT_ALLOWED')
    expect(body.success).toBe(false)
  })

  test('ADMIN → GET /instruments/BARTHEL/definition → 200 (positive path)', async ({
    request,
  }) => {
    const res = await request.get(
      `${API_BASE}/api/v1/instruments/BARTHEL/definition`,
      { headers: { Cookie: adminCookie } },
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.instrumento.codigo).toBe('BARTHEL')
  })

  test('OPERADOR → GET /instruments/BARTHEL/definition → 403 (other non-allowed role)', async ({
    request,
  }) => {
    const opCookie = await login(request, 'operador@miempresa.com', 'password123')
    const res = await request.get(
      `${API_BASE}/api/v1/instruments/BARTHEL/definition`,
      { headers: { Cookie: opCookie } },
    )
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('ROLE_NOT_ALLOWED')
    await request.post(`${API_BASE}/api/v1/auth/logout`, { headers: { Cookie: opCookie } }).catch(() => {})
  })

  // ─── 3. resultEvaluation boundary sweeps ─────────────────────────────────
  //
  // MINI_MENTAL contract ranges:
  //   27-30 Normal, 24-26 Sospecha patológica, 12-23 Deterioro,
  //   9-11 Demencia, 0-8 Deterioro severo
  //
  // TINETTI contract ranges:
  //   25-28 Riesgo bajo, 19-24 Riesgo moderado, 0-18 Alto riesgo de caídas

  test('MINI_MENTAL boundary sweep (26/27, 23/24, 11/12, 8/9)', async ({ request }) => {
    // Every MINI_MENTAL item is single-select-scored with
    // "correcto" (score 1) / "incorrecto" (score 0). To hit a target
    // total T: answer T items with "correcto" and (30-T) with
    // "incorrecto".
    const def = await request.get(`${API_BASE}/api/v1/instruments/MINI_MENTAL/definition`, {
      headers: { Cookie: adminCookie },
    })
    const defBody = await def.json()
    const items = defBody.data.version.definition.sections.flatMap((s: any) => s.items)
    expect(items.length).toBe(30)
    for (const it of items as any[]) {
      expect(it.type).toBe('single-select-scored')
      const correcto = it.options.find((o: any) => o.value === 'correcto')
      const incorrecto = it.options.find((o: any) => o.value === 'incorrecto')
      expect(correcto?.score).toBe(1)
      expect(incorrecto?.score).toBe(0)
    }

    const expected: Array<[number, string]> = [
      [27, 'Normal'],
      [26, 'Sospecha patológica'],
      [24, 'Sospecha patológica'],
      [23, 'Deterioro'],
      [12, 'Deterioro'],
      [11, 'Demencia'],
      [9, 'Demencia'],
      [8, 'Deterioro severo'],
    ]
    for (const [target, label] of expected) {
      const respuestas: Record<string, string> = {}
      items.forEach((it: any, idx: number) => {
        respuestas[it.id] = idx < target ? 'correcto' : 'incorrecto'
      })
      const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
        headers: { Cookie: adminCookie },
        data: {
          instrumentoId: miniMentalId,
          versionRegistro: 'v1.0',
          respuestas,
        },
      })
      expect(res.status(), `POST MINI_MENTAL target=${target}`).toBe(201)
      const body = await res.json()
      expect(body.data.puntajeTotal, `MINI_MENTAL target=${target} puntaje`).toBe(target)
      expect(
        body.data.clasificacion,
        `MINI_MENTAL target=${target} classification`,
      ).toBe(label)
      createdFichaIds.push(body.data.id)
    }
  })

  test('TINETTI boundary sweep (24/25, 18/19)', async ({ request }) => {
    const def = await request.get(`${API_BASE}/api/v1/instruments/TINETTI/definition`, {
      headers: { Cookie: adminCookie },
    })
    const defBody = await def.json()
    const items = defBody.data.version.definition.sections.flatMap((s: any) => s.items)
    expect(items.length).toBe(20)

    // TINETTI items have heterogeneous scoring:
    //   - 8 items with ternary options (max=2, mid=1, min=0)
    //   - 12 items with binary options (max=1, min=0)
    // Global max = 8*2 + 12*1 = 28 (per contract §6.1).
    const itemsMax2: any[] = []
    const itemsMax1: any[] = []
    for (const it of items as any[]) {
      const opts = (it.options ?? []).slice()
      opts.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
      if ((opts[0].score ?? 0) === 2) itemsMax2.push(it)
      else itemsMax1.push(it)
    }
    expect(itemsMax2.length).toBe(8)
    expect(itemsMax1.length).toBe(12)

    // answerSet: start with all-max; demote the first N ternary items to
    // min (delta=-2 each) and the first M binary items to min (delta=-1
    // each). Returns the answer map and the computed total for sanity.
    function answerSet(demoteMax2: number, demoteMax1: number) {
      const respuestas: Record<string, string> = {}
      for (const it of items as any[]) {
        const opts = (it.options ?? []).slice()
        opts.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
        respuestas[it.id] = opts[0].value // max
      }
      for (let i = 0; i < demoteMax2 && i < itemsMax2.length; i++) {
        const it = itemsMax2[i]
        const opts = (it.options ?? []).slice()
        opts.sort((a: any, b: any) => (a.score ?? 0) - (b.score ?? 0))
        respuestas[it.id] = opts[0].value // min
      }
      for (let i = 0; i < demoteMax1 && i < itemsMax1.length; i++) {
        const it = itemsMax1[i]
        const opts = (it.options ?? []).slice()
        opts.sort((a: any, b: any) => (a.score ?? 0) - (b.score ?? 0))
        respuestas[it.id] = opts[0].value // min
      }
      let total = 0
      for (const it of items as any[]) {
        const opts = (it.options ?? []).slice()
        for (const o of opts) {
          if (o.value === respuestas[it.id]) {
            total += o.score ?? 0
            break
          }
        }
      }
      return { respuestas, total }
    }

    async function postAndAssert(
      target: number,
      demote2: number,
      demote1: number,
      expectedLabel: string,
    ) {
      const { respuestas, total } = answerSet(demote2, demote1)
      expect(total, `internal: expected=${target} computed=${total}`).toBe(target)
      const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
        headers: { Cookie: adminCookie },
        data: {
          instrumentoId: tinettiId,
          versionRegistro: 'v1.0',
          respuestas,
        },
      })
      expect(res.status()).toBe(201)
      const body = await res.json()
      expect(body.data.puntajeTotal).toBe(target)
      expect(body.data.clasificacion).toBe(expectedLabel)
      createdFichaIds.push(body.data.id)
    }

    // TINETTI ranges: 25-28 Riesgo bajo, 19-24 Riesgo moderado,
    // 0-18 Alto riesgo de caídas.
    await postAndAssert(28, 0, 0, 'Riesgo bajo')              // top of "bajo"
    await postAndAssert(25, 1, 1, 'Riesgo bajo')              // 28-2-1=25
    await postAndAssert(24, 2, 0, 'Riesgo moderado')         // 28-4=24
    await postAndAssert(19, 4, 1, 'Riesgo moderado')         // 28-8-1=19
    await postAndAssert(18, 5, 0, 'Alto riesgo de caídas')    // 28-10=18
  })

  // ─── 4. INVALID_STATE: completar on COMPLETADO ──────────────────────────
  test('INVALID_STATE: PATCH completar on already-COMPLETADO → 400', async ({ request }) => {
    // Create a new ficha (PENDIENTE) then complete it.
    const assign = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: {
        instrumentoId: barthelId,
        versionRegistro: 'v1.0',
      },
    })
    expect(assign.status()).toBe(201)
    const asignada = await assign.json()
    const fichaId = asignada.data.id
    createdFichaIds.push(fichaId)

    // First completion → 200.
    const first = await request.patch(
      `${API_BASE}/api/v1/patients/${patientId}/fichas/${fichaId}/completar`,
      {
        headers: { Cookie: adminCookie },
        data: { respuestas: barthelMaxAnswer() },
      },
    )
    expect(first.status()).toBe(200)

    // Second completion → 400 INVALID_STATE.
    const second = await request.patch(
      `${API_BASE}/api/v1/patients/${patientId}/fichas/${fichaId}/completar`,
      {
        headers: { Cookie: adminCookie },
        data: { respuestas: barthelMaxAnswer() },
      },
    )
    expect(second.status()).toBe(400)
    const body = await second.json()
    expect(body.code).toBe('INVALID_STATE')
  })

  // ─── 5. MNA_CUADRO §1.3 classification-source rule ──────────────────────
  test('MNA_CUADRO classification-source rule: cribaje ≥ 12 + evaluación absent → "Estado nutricional normal"', async ({
    request,
  }) => {
    // Build a cribaje payload that sums to exactly 13 (≥ 12 threshold).
    // a_apetito=2 + b_peso=3 + c_movilidad=2 + d_enfermedad=2 +
    // e_neuropsico=2 + f_imc=2 = 13. f1_peso + f2_talla are number-info
    // (no score contribution). evaluación is absent → skipped.
    // cuadro_alimentos is ALWAYS required (no skipIf) — its
    // group-info "frecuencia_grupos" must be present (1 entry per row).
    const respuestas = {
      a_apetito: 'igual', // 2
      b_peso: 'sin_perdida', // 3
      c_movilidad: 'sale', // 2
      d_enfermedad: 'no', // 2
      e_neuropsico: 'sin_problemas', // 2
      f1_peso: 70, // number-info, no score
      f2_talla: 170, // number-info, no score
      f_imc: 'imc_21_23', // 2
      // cuadro_alimentos — group-info (always required).
      frecuencia_grupos: [
        { rowId: 'cereales', columnId: 'diario' },
        { rowId: 'frutas', columnId: 'diario' },
        { rowId: 'verduras', columnId: 'diario' },
        { rowId: 'carnes', columnId: 'semanal' },
        { rowId: 'lacteos', columnId: 'diario' },
        { rowId: 'grasas', columnId: 'semanal' },
        { rowId: 'dulces', columnId: 'mensual' },
      ],
    }
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: {
        instrumentoId: mnaId,
        versionRegistro: 'v1.0',
        respuestas,
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.estado).toBe('COMPLETADO')
    // Per contract §1.3 classification-source rule: cribaje subtotal
    // (12) falls in the 12-14 range → "Estado nutricional normal".
    expect(body.data.clasificacion).toBe('Estado nutricional normal')
    expect(body.data.skippedSections).toContain('evaluacion')
    expect(body.data.instrumentoVersionId).toBe(mnaVersionId)
    createdFichaIds.push(body.data.id)
  })

  // ─── 6. G2-12: versionRegistro is OPTIONAL, server-defaults to `v{version}` ─
  //
  // Contract §4.3 (G2-12, 2026-07-17): clients SHOULD omit `versionRegistro`.
  // The service layer server-derives it as `v{version}` from the resolved
  // active version. This test proves:
  //   - POST without versionRegistro is accepted (no 400).
  //   - Persisted row carries versionRegistro === "v1" (matches BARTHEL v1).
  //   - Response echoes the derived value.
  test('G2-12: POST without versionRegistro → 201, persisted "v1"', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/patients/${patientId}/fichas`, {
      headers: { Cookie: adminCookie },
      data: {
        instrumentoId: barthelId,
        // versionRegistro intentionally omitted (G2-12 contract).
        respuestas: barthelMaxAnswer(),
      },
    })
    expect(res.status(), 'POST without versionRegistro must succeed').toBe(201)
    const body = await res.json()
    expect(body.data.estado).toBe('COMPLETADO')
    expect(body.data.puntajeTotal).toBe(100)
    expect(body.data.clasificacion).toBe('Dependencia ligera')
    expect(body.data.versionRegistro, 'server-derived versionRegistro').toBe('v1')
    expect(body.data.instrumentoVersionId).toBe(barthelVersionId)
    createdFichaIds.push(body.data.id)

    // Round-trip GET /patients/:id/fichas/:id — the persisted row must carry
    // the server-derived versionRegistro.
    const detail = await request.get(
      `${API_BASE}/api/v1/patients/${patientId}/fichas/${body.data.id}`,
      { headers: { Cookie: adminCookie } },
    )
    expect(detail.status()).toBe(200)
    const detailBody = await detail.json()
    expect(detailBody.data.versionRegistro, 'persisted versionRegistro').toBe('v1')
  })
})

// ─── helpers ──────────────────────────────────────────────────────────────

function barthelMaxAnswer(): Record<string, string> {
  return {
    comida: 'independiente',
    lavado: 'independiente',
    vestido: 'independiente',
    arreglo: 'independiente',
    deposicion: 'continente',
    miccion: 'continente',
    retrete: 'independiente',
    transferencia: 'independiente',
    deambulacion: 'independiente',
    desniveles: 'independiente',
  }
}
