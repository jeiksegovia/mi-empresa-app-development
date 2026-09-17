# Progress Report: W1 · data + backend · qa-session-jul-31

## Subtask 1 (T1): Author contract-schema-qa-jul-31.md — ✅ Done

**Where:** `development/qa-session-jul-31/orchestration-ctx/decisions/contract-schema-qa-jul-31.md`

**What:** Authored the shared interface contract covering R1 (Nequi/Bre-B label),
R2/R2b (nómina interface matrix by `tipoContrato`, with the existing
`getNominaMonth` `sugerido` payload documented), and R3 (eps/fondoPensiones/arl
fields: DB columns, camelCase API names, optional validation, persistence rules).

**Why this shape:**
- Matches the jul-24 contract structure (sections, headings, "cross-cutting
  acceptance" block) so W2 has a familiar reading pattern.
- Documents the **existing** `getNominaMonth` payload so W2 can implement the R2
  dialog branch without reading `nominaService.ts` directly — that's the
  "do not read schema.prisma directly" rule generalized to service files.
- R2b is satisfied by jul-24 R7 (verified in `nominaService.ts:263-303`); the
  contract records the payload W2 reads, but **adds no new BE code**.

**CHECKPOINT sent** to team-lead after T1.

---

## Subtask 2 (T2): Schema + migration — ✅ Done

**Where:**
- `backend/prisma/schema.prisma` — added 3 nullable VARCHAR(100) fields under the
  existing medioPago block (line ~104).
- `backend/prisma/migrations/20260803022244_add_empleado_eps_fondo_arl/migration.sql`
  — auto-generated additive DDL.

**DDL:**
```sql
ALTER TABLE "empleados" ADD COLUMN "arl" VARCHAR(100),
ADD COLUMN "eps" VARCHAR(100),
ADD COLUMN "fondo_pensiones" VARCHAR(100);
```

**`npx prisma migrate status`** output:
> `Database schema is up to date!`

Used `npx prisma migrate dev --name add_empleado_eps_fondo_arl`. Did NOT use
`migrate diff --shadow-database-url` (would wipe DB).

---

## Subtask 3 (T3): Backend R3 persistence — ✅ Done

**Where:**
- `backend/src/services/employeeService.ts` — added `eps`/`fondoPensiones`/`arl`
  to `EmployeeDetail` (lines ~64-66) and to `CreateEmployeeInput` (lines ~204-206).
  `UpdateEmployeeInput` extends the base input type, so partial updates work
  automatically.
- `backend/src/routes/employees.routes.ts` — added 3 `z.string().max(100).nullable().optional()`
  fields to `employeeBaseSchema` (lines ~125-127). `updateEmployeeSchema` is
  `.partial()` over this base, so the fields are auto-accepted in PUT.

**Persistence path:** `createEmployee` spreads `...baseFields` into the
`prisma.empleado.create({ data })` call; `updateEmployee` spreads `...rest`
into `updateData`. Both flows write the new columns when present and preserve
existing values when absent (matching the bancoNombre pattern from jul-24 R7).

**Typecheck:** `npm run typecheck` clean.

**Smoke test (verbatim curl):**
```
$ curl POST /api/v1/employees { …, eps:"Sura", fondoPensiones:"Porvenir", arl:"Positiva" }
{"success":true,"data":{"id":362,…,"eps":"Sura","fondoPensiones":"Porvenir","arl":"Positiva",…}}
$ curl PUT /api/v1/employees/363 { eps:"Sanitas", fondoPensiones:"Colfondos", arl:"Sura ARL" }
$ curl GET /api/v1/employees/363
eps: Sanitas
fondoPensiones: Colfondos
arl: Sura ARL
```

Test IDs 362/363 cleaned up via DELETE.

---

## Subtask 4 (T4): Backend R2b nómina suggestion — ✅ Done

**Decision:** **No new code.** The `getNominaMonth` service already surfaces
`valorMensual` and `totalPagado=valorMensual` for non-OPS contracts (and
`valorJornada`/`subtotalCalculado` for OPS). This was implemented in jul-24 R7
(`nominaService.ts:263-303`). Verified via the new `nomina-sugerencia-valormensual.spec.ts`.

**Where documented:** the contract's §3 spells out the response shape (the
`sugerido` block) and the prefill rules so W2 can implement the R2 dialog branch
without reading `nominaService.ts`.

---

## Subtask 5 (T5): Backend Playwright tests — ✅ Done

**Where:**
- `backend/tests/employees/empleado-eps-fondo-arl.spec.ts` — 4 tests, all pass:
  1. POST without fields → 201, fields null on GET.
  2. POST with all 3 → 201, persisted + returned.
  3. PUT partial (only eps) → 200, others preserved.
  4. POST with eps > 100 chars → 400 (Zod length validation).
- `backend/tests/nomina/nomina-sugerencia-valormensual.spec.ts` — 3 tests, all pass:
  1. TERMINO_FIJO row: `sugerido.valorMensual=1800000`,
     `subtotalCalculado=null`, `totalPagado=1800000`.
  2. OBRA_O_LABOR row: `sugerido.valorMensual=1200000`,
     `totalPagado=1200000` (D1: no aportes).
  3. OPS row: `sugerido.valorJornada=50000`, `valorMensual=null`.

**Run command + summary:**
```
$ npx playwright test tests/employees/empleado-eps-fondo-arl.spec.ts \
                    tests/nomina/nomina-sugerencia-valormensual.spec.ts
Running 7 tests using 1 worker
  ✓ …empleado-eps-fondo-arl.spec.ts: POST without … → 201; fields null on GET
  ✓ …empleado-eps-fondo-arl.spec.ts: POST with all 3 → 201; persisted and returned
  ✓ …empleado-eps-fondo-arl.spec.ts: PUT partial (eps only) → 200; others preserved
  ✓ …empleado-eps-fondo-arl.spec.ts: POST with eps > 100 chars → 400
  ✓ …nomina-sugerencia-valormensual.spec.ts: TERMINO_FIJO row surfaces valorMensual
  ✓ …nomina-sugerencia-valormensual.spec.ts: OBRA_O_LABOR row surfaces valorMensual
  ✓ …nomina-sugerencia-valormensual.spec.ts: OPS row surfaces valorJornada
  7 passed
```

**Regression check** on adjacent jul-24 R7 specs:
- `tests/nomina/contrato-valormensual.spec.ts` — 4/4 pass.
- `tests/employees/medio-pago*.spec.ts` + `employees-partial-medio-pago.spec.ts` —
  16/16 pass.

No regressions.