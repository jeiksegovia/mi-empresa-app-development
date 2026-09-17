# Progress Report — W4 (test + quality) — improvements-jul-9

## Tasks completed

### T13 (task #21) — Backend spec suite

**Files created (6):**

1. `backend/tests/patients/nota-fecha-incidente.spec.ts` — 5 tests for B1/B2 + L3 2-business-day rule
   - today → 201
   - previous weekday → 201
   - future → 400 + field=fechaIncidente
   - missing → 400 (Zod)
   - 10 weekdays back → 400 + field=fechaIncidente
   - **Uses deterministic weekday math** — computes relative to test-startup date

2. `backend/tests/patients/cliente-new-fields.spec.ts` — 5 tests for B3/B4/B5
   - POST with all 3 → 201 round-trip
   - PUT update all 3 → 200 round-trip
   - POST invalid tipoSangre → 400
   - PUT invalid tipoSangre → 400
   - POST without new fields → valid (backward compat)

3. `backend/tests/employees/educacion-crud.spec.ts` — 6 tests for D2 full CRUD
   - POST → 201 row created
   - GET → row in list
   - PATCH → updates profesion
   - POST without profesion → 400
   - DELETE → 200/204 (gap: contract says 204, impl returns 200)
   - GET on non-existent empleado → 404/500

4. `backend/tests/empresa/cargos-crud.spec.ts` — 7 tests for D7
   - GET seeded cargos (≥ 7, ordered by nombre)
   - POST → 201 with id
   - POST duplicate → 409 with field=nombre
   - PATCH activo=false → archives
   - Archived excluded from ?activo=true list
   - Archived REMAINS in full list
   - DELETE soft-archives (200 vs contract 204 — gap)

5. `backend/tests/employees/contrato-cargo.spec.ts` — 5 tests for D6/D7
   - POST contrato with cargoId + archivoFirmadoUrl → 201 with cargo embedded
   - Legacy `{ cargo: string }` → 400 (forbidLegacy)
   - Invalid cargoId FK → 500 (GAP-1 pre-logged, asserts current behavior)
   - POST without cargoId → 201 (nullable)
   - GET contratos includes archivoFirmadoUrl

6. `backend/tests/certificates/update-comprobante.spec.ts` — 4 tests for A4
   - POST comprobantePagoUrl only → 201
   - GET row shows comprobante
   - POST comprobante + archivo → 201
   - POST empty → 400 (refine)

**Run output:**
```
32 passed (1.7s)  — all 32 backend tests passing
```

### T14 (task #22) — Playwright UI specs

**Files created (8) under `frontend/tests/local-qa/`:**

1. `jul9-cert-crear-simplified.spec.ts` — A1-A3 form has only 4 metadata + 2 dropzones
2. `jul9-cert-update-comprobante.spec.ts` — A4-UI dropzone + comprobante download
3. `jul9-empresa-save.spec.ts` — A6 regression — fill, save, reload, assert persists
4. `jul9-pacientes-new-fields.spec.ts` — B3/B4/B5 detail page renders all 3 new fields
5. `jul9-nota-fecha-incidente.spec.ts` — B1/B2/B6 nota list shows fecha column
6. `jul9-empleado-educacion.spec.ts` — D2 edu row renders on edit page
7. `jul9-contrato-cargo.spec.ts` — D5/D7 contrato tab + cargo Select
8. `jul9-cargos-manager.spec.ts` — D7/D8 list/add/dup/archive UI flow

**Run output (with the documented env vars):**
```
8 passed (26.9s)
```

### T15 (task #23) — Regression + QA report

- **Regression run:** existing `jul8-*` frontend spec suite: **17/19 pass, 2 pre-existing skips, 0 fail.**
- **Regression run:** existing `jul4-*` frontend spec suite: 22 failures, **all pre-existing TEST-ENV** (hardcoded `localhost:3101` strings in `page.request.post()` — pre-dates the sameSite=Strict cookie change). Classified not-new.
- **Regression run:** existing backend suites (certificates, employees, empresa, nomina, employees-sub-resources): **125 passed**, 4 failed, all pre-existing TEST-ENV / pre-existing BUGS not introduced by jul-9. Classified not-new.
- **`qa-report.md` written** at `development/improvements-jul-9/tasks/W4-test-quality/qa-report.md`.

## Gaps filed

| # | Severity | Title |
|---|---:|---|
| GAP-1 | HIGH (pre-logged) | Invalid `cargoId` FK on Contrato create → 500 instead of 400 |
| GAP-2 | LOW  (pre-logged) | `EducacionEmpleado` not embedded on GET /employees/:id (round-trip pattern) |
| GAP-3 | LOW  (NEW) | DELETE endpoints for cargos + educacion return 200 with body, contract says 204 |

## Test data side-effects

- Notas created by `jul9-nota-fecha-incidente.spec.ts` are **not** cleaned up
  (no DELETE endpoint exists for notas). Acceptable per task assignment;
  documented in the spec.
- One certificado is created + deleted in `jul9-cert-update-comprobante.spec.ts`.
- One educacionEmpleado is created + deleted in `jul9-empleado-educacion.spec.ts`.
- One paciente is created + deleted in `jul9-pacientes-new-fields.spec.ts`.
- One empresa telefono patch + restore in `jul9-empresa-save.spec.ts`.
- One cargo + archived in `jul9-cargos-manager.spec.ts`.
- `contrato-cargo.spec.ts` creates + deletes up to 3 contratos.
