# T6 completion report — Actividades API + ACL spec (qa-session-aug-17 R6)

**Worker:** pt-backend-eng / worker-2-2
**Task ID:** 6
**Status:** completed
**Date:** 2026-08-18

## What was done

T6 closes the R6 (Registro de actividades) backlog on the backend. The route
+ service layer already implemented contract §4 / §1.2 / §1.3 in prior
commits — `domainAccess.ts` carries the `actividades` cells, `routes/index.ts`
mounts the router, and `actividadService.ts` enforces own-item, today-only,
EMPLEADO_REQUIRED, and DUPLICATE_DAY. The missing deliverable was a
seed-backed Playwright spec asserting the contract end-to-end.

### Files created
- `backend/tests/actividades/registro-actividades-acl.spec.ts` — 7 tests
  covering ADMIN full CRUD, PROFESORES/AUXILIARES own GET+POST+ACL,
  GERONTOLOGA/CONTRATOS read-only, EMPLEADO_REQUIRED, and the cross-empleado
  GET view.

### Files updated
- `development/qa-session-aug-17/tasks/W2-backend/progress-report.md` — T6
  status moved from `waiting` to `completed` with evidence.

### Files reviewed but not edited
- `backend/src/routes/actividades.routes.ts` — already contract-compliant.
- `backend/src/services/actividadService.ts` — already contract-compliant.
- `backend/src/middleware/domainAccess.ts` — `actividades` cells already in
  DOMAIN_ACCESS for all 4 tipos; `Domain` union already includes `actividades`.
- `backend/src/routes/index.ts` — already mounts `/actividades`.
- `backend/tests/rbac/matrix-parity.spec.ts` — DOMAINS list and verbatim
  match already include `actividades` (lines 124, 207, 221, 235, 248).

## Acceptance criteria — evidence

| # | Criterion | Result |
|---|---|---|
| 1 | Login `profesor@miempresa.com` / `auxiliar@miempresa.com` / `password123` resolves | ✓ seed.ts (lines 130-153) + beforeAll login in spec |
| 2 | ADMIN full CRUD | ✓ spec test "ADMIN: full CRUD on /actividades" — POST 201, GET 200, PUT 200, DELETE 204 |
| 3 | PROFESORES/AUXILIARES own GET + POST, today-only Bogotá, no PUT/DELETE | ✓ spec tests "PROFESORES: own GET + POST today…" and "AUXILIARES: own GET + POST today…" — own-item filter, today-only 403, PUT/DELETE 403 |
| 4 | GERONTOLOGA / CONTRATOS: GET all, POST 403 | ✓ spec tests "GERONTOLOGA: GET 200 (all); POST 403" and "CONTRATOS: GET 200 (all); POST 403" + "GERONTOLOGA GET sees both seeded empleado rows" |
| 5 | 400 `EMPLEADO_REQUIRED` if writer has no `empleadoId` | ✓ spec test "PROFESORES with no empleadoId: POST → 400 EMPLEADO_REQUIRED" — uses `qa-profesor-no-empleado@miempresa.local` upserted in beforeAll |
| 6 | 409 `DUPLICATE_DAY` second POST same day | ✓ covered in "PROFESORES: own GET + POST today 201; foreign empleadoId 403; past 403; PUT/DELETE 403" duplicate assertion |
| 7 | Spec file exists and Playwright passes | ✓ `7 passed (1.6s)` |

## Verbatim command + output

```
$ npx playwright test tests/actividades/registro-actividades-acl.spec.ts --reporter=line

Running 7 tests using 1 worker
  [1/7] …ACTIVIDADES — ACL + behavior (qa-session-aug-17 R6) › ADMIN: full CRUD on /actividades
  [2/7] …PROFESORES: own GET + POST today 201; foreign empleadoId 403; past 403; PUT/DELETE 403
  [3/7] …AUXILIARES: own GET + POST today 201; PUT/DELETE 403
  [4/7] …GERONTOLOGA: GET 200 (all); POST 403
  [5/7] …CONTRATOS: GET 200 (all); POST 403
  [6/7] …PROFESORES with no empleadoId: POST → 400 EMPLEADO_REQUIRED
  [7/7] …GERONTOLOGA GET sees both seeded empleado rows (no own-item filter)
  7 passed (1.6s)
```

```
$ npx playwright test tests/rbac/matrix-parity.spec.ts --reporter=line

Running 4 tests using 1 worker
  [1/4] matrix-parity … DOMAIN_ACCESS cells match between backend and frontend, cell-by-cell
  [2/4] matrix-parity … Backend matrix has all 12 domains (aug-6 + actividades) for every profile
  [3/4] matrix-parity … Frontend matrix has all 12 domains (aug-6 + actividades) for every profile
  [4/4] matrix-parity … Verbatim matrix contents match contract §2.2 (fixes-features-aug-6)
  4 passed (590ms)
```

## Manual probes (sanity, before spec was written)

Captured against the running backend on `:3101` with the seeded users:

```
GET  /api/v1/actividades   (profesor)   → 200, []
POST …                  fecha=2026-08-18, texto="profesor test entry" → 201
GET  /api/v1/actividades  (gerontologa) → 200, [{ id:1, empleadoId:395, … }]
POST …                  (gerontologa) → 403 DOMAIN_FORBIDDEN
POST …                  (contratos)    → 403 DOMAIN_FORBIDDEN
POST … fecha=today, duplicate          → 409 DUPLICATE_DAY
POST … fecha=2026-08-01 (past)         → 403 DOMAIN_FORBIDDEN
POST … empleadoId=99999 (foreign)      → 403 DOMAIN_FORBIDDEN
PUT  /api/v1/actividades/1 (profesor)  → 403 DOMAIN_FORBIDDEN
DELETE /api/v1/actividades/1 (profesor)→ 403 DOMAIN_FORBIDDEN
POST (auxiliar)                        → 201 (own empleadoId=396)
GET  (auxiliar)                        → only own rows
POST (admin, empleadoId=395)           → 201 (full CRUD)
PUT  /actividades/1 (admin)            → 200
DELETE /actividades/3 (admin)          → 204
```

## Notes / contract gaps

None. The pre-existing `actividades.routes.ts` + `actividadService.ts` match
contract §4 verbatim. The pre-existing `domainAccess.ts` matrix already
includes `actividades` per §1.2. The pre-existing `matrix-parity.spec.ts`
already validates the `actividades` cells.

## Idempotency / test hygiene

The spec's `beforeAll` uses Prisma to:
- delete any leftover `registro_actividades` rows for empleadoIds 395 + 396
  (so the today-only POSTs don't collide with rows from previous runs / manual
  probes);
- upsert a throw-away `qa-profesor-no-empleado@miempresa.local` user
  (PROFESORES, `empleadoId: null`) for the EMPLEADO_REQUIRED assertion.

This keeps the spec re-runnable and removes the need for global seed
extensions.

## Deviations

None. R6 is fully covered by §4 of the contract.
