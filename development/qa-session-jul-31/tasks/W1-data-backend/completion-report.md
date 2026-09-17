# Completion Report: W1 · data + backend · qa-session-jul-31

**Worker:** worker-1 (pt-fullstack-impl)
**Plan:** qa-session-jul-31
**Status:** COMPLETE — all 5 W1 tasks done, all BE tests green, no regressions.

---

## Deliverables

| Artifact | Path | Status |
|---|---|---|
| Contract | `development/qa-session-jul-31/orchestration-ctx/decisions/contract-schema-qa-jul-31.md` | Published |
| Schema columns | `backend/prisma/schema.prisma` (3 new nullable VARCHAR(100) on `empleados`) | Applied |
| Migration | `backend/prisma/migrations/20260803022244_add_empleado_eps_fondo_arl/migration.sql` | Clean |
| R3 service | `backend/src/services/employeeService.ts` (input + detail interfaces) | Done |
| R3 routes | `backend/src/routes/employees.routes.ts` (Zod schema +3 fields) | Done |
| R2b BE | None — already implemented in jul-24 R7; documented in contract §3 | Done |
| R3 tests | `backend/tests/employees/empleado-eps-fondo-arl.spec.ts` (4 tests) | 4/4 pass |
| R2b tests | `backend/tests/nomina/nomina-sugerencia-valormensual.spec.ts` (3 tests) | 3/3 pass |
| Progress log | `development/qa-session-jul-31/tasks/W1-data-backend/progress-report.md` | Updated |
| Completion report | This file | — |

---

## Acceptance Criteria Evidence

### AC1 — Contract covers items 1–4
**File:** `development/qa-session-jul-31/orchestration-ctx/decisions/contract-schema-qa-jul-31.md`
- §4 = R1 label map (4 surfaces listed: empleados/nuevo, empleados/[id]/index,
  empleados/[id]/editar, nomina/index; option value stays `NEQUI`).
- §3 = R2 nómina interface matrix (4-row table by `tipoContrato`).
- §3 = R2b — `sugerido` payload documented field-by-field.
- §2 = R3 fields (DB columns `eps`/`fondo_pensiones`/`arl` VARCHAR(100) nullable;
  API `eps`/`fondoPensiones`/`arl`; optional; Datos personales step).

### AC2 — Migration clean + 3 new nullable columns
**Command + output:**
```
$ npx prisma migrate status
…
Database schema is up to date!
```
**DDL:**
```sql
ALTER TABLE "empleados"
  ADD COLUMN "arl"            VARCHAR(100),
  ADD COLUMN "eps"            VARCHAR(100),
  ADD COLUMN "fondo_pensiones" VARCHAR(100);
```
Prisma client regenerated (`✔ Generated Prisma Client (v6.19.2)`).

### AC3 — Employee create/update accept/persist/return eps/fondoPensiones/arl
**Curl (verbatim):**
```
$ curl -b /tmp/admin.cookie -X POST http://localhost:3101/api/v1/employees \
    -H 'Content-Type: application/json' \
    -d '{"nombre":"QAJ31","apellido":"EPS","tipoDocumento":"CC","numeroDocumento":"99999999A1","genero":"M","fechaNacimiento":"1990-01-15","eps":"Sura","fondoPensiones":"Porvenir","arl":"Positiva"}'
{"success":true,"data":{"id":362,…,"eps":"Sura","fondoPensiones":"Porvenir","arl":"Positiva",…}}

$ curl -b /tmp/admin.cookie -X POST http://localhost:3101/api/v1/employees \
    -d '{"nombre":"QAJ31","apellido":"OMIT","tipoDocumento":"CC","numeroDocumento":"99999999B1","genero":"M","fechaNacimiento":"1990-01-15"}'
{"success":true,"data":{"id":363,…,"eps":null,"fondoPensiones":null,"arl":null,…}}

$ curl -b /tmp/admin.cookie -X PUT http://localhost:3101/api/v1/employees/363 \
    -d '{"eps":"Sanitas","fondoPensiones":"Colfondos","arl":"Sura ARL"}'
{"success":true,…}
$ curl -b /tmp/admin.cookie http://localhost:3101/api/v1/employees/363
eps: Sanitas
fondoPensiones: Colfondos
arl: Sura ARL
```

Test IDs cleaned up via DELETE.

### AC4 — GET /nomina suggestion returns valorMensual for non-OPS
**Spec evidence** (`nomina-sugerencia-valormensual.spec.ts`):
```
✓ TERMINO_FIJO row: sugerido.valorMensual surfaces + totalPagado = valorMensual
✓ OBRA_O_LABOR row: valorMensual surfaced, totalPagado = valorMensual (D1: no aportes)
✓ OPS row: valorJornada surfaced (valorMensual null)
3 passed
```
Specific assertion: `expect(Number(row.sugerido.valorMensual)).toBe(1800000)`;
`expect(row.sugerido.subtotalCalculado ?? null).toBeNull()`;
`expect(Number(row.sugerido.totalPagado)).toBe(1800000)`.

### AC5 — Backend specs pass locally
**Command + summary:**
```
$ npx playwright test \
    tests/employees/empleado-eps-fondo-arl.spec.ts \
    tests/nomina/nomina-sugerencia-valormensual.spec.ts
Running 7 tests using 1 worker
  ✓  … POST without → 201; fields null on GET
  ✓  … POST with all 3 → 201; persisted and returned
  ✓  … PUT partial (eps only) → 200; others preserved
  ✓  … POST with eps > 100 chars → 400
  ✓  … TERMINO_FIJO row surfaces valorMensual
  ✓  … OBRA_O_LABOR row surfaces valorMensual
  ✓  … OPS row surfaces valorJornada
  7 passed
```
No BUG/TEST-ENV/FLAKE failures. **All pre-existing port-3101 tests that ran also pass.**

---

## Key Decisions

1. **R2b BE = no code change.** The `getNominaMonth` payload already surfaces
   `valorMensual` for non-OPS (jul-24 R7). Documented in contract §3 so W2 can
   prefill the dialog without re-reading `nominaService.ts`.
2. **R3 columns are nullable VARCHAR(100) with no default.** Mirrors
   `bancoNombre`; allows omission without DB constraint errors. Free text per
   decision D2 — no enum/catalog.
3. **Update schema inherits from base via `.partial()`**. Adding the 3 fields
   to `employeeBaseSchema` automatically exposes them in
   `updateEmployeeSchema` — no extra wiring needed.
4. **OBRA_O_LABOR with no aportes (D1) is unchanged.** Verified in test 2 of
   `nomina-sugerencia-valormensual.spec.ts` — totalPagado = valorMensual only.

---

## Issues Encountered

- (none material)

---

## Known Issues NOT Fixed

- (none)

---

## Integration Notes (for worker-2 and orchestrator)

- **R1**: W2 must change `<option>` text and any display strings for `NEQUI`
  on the 4 surfaces (empleados/nuevo, empleados/[id]/index, empleados/[id]/editar,
  nomina/index). The stored enum value and option `value="NEQUI"` stay the same.
- **R2**: W2 reads `sugerido.valorMensual` for non-OPS rows and
  `sugerido.subtotalCalculado` for OPS rows. The dialog must hide the medias/
  valor-jornada inputs for non-OPS and hide aportes for OPS/OBRA. See
  contract §3 for the matrix.
- **R3**: W2 adds 3 free-text inputs (eps / fondoPensiones / arl) under
  "Datos personales" of `empleados/nuevo.vue` and `empleados/[id]/editar.vue`,
  and displays them on `empleados/[id]/index.vue`. No validation required; the
  Zod schema accepts up to 100 chars and treats missing as `null`.

---

## Deferred Items

- Staging deploy (gated, separate step).
- Migration safety on staging: re-runs are safe (additive, no `IF NOT EXISTS`
  needed because the migration is a single ALTER and Prisma tracks
  `_prisma_migrations`).
- Any enum/catalog for EPS / Fondo / ARL — deferred per D2.