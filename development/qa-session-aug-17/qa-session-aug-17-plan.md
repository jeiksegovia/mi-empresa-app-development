# Feature Plan: qa-session-aug-17

## Objective
Ship the 2026-08-17 QA cycle: empleados Activos/Inactivos tabs, CONTRATOS GET cargos, nómina bonos + total-without-aportes, periodos validation + CONTRATOS write, and **Registro de actividades** under Asistencia.

## Assumptions & Constraints
- Decisions locked 2026-08-18 (see intake Qs + 01-requirements).
- Contract-first: W1 writes `orchestration-ctx/decisions/contract-schema-qa-aug-17.md` before anyone else codes names.
- Orchestrator does not implement.
- Working tree already dirty — workers touch **only** listed files.
- No commit / no deploy in this plan.
- Local BE `:3101`, FE `:3100`, db `:15432`. Restart BE via `lsof -ti :3101` after route-guard edits.

## Existing Patterns Used
- **Domain RBAC**: `backend/src/middleware/domainAccess.ts` + FE `useDomainAccess.ts` + `matrix-parity.spec.ts` → add domain `actividades`; CONTRATOS.empresa stays `false`.
- **Cargos GET hole**: `empresa.routes.ts` `router.use(requireDomain('empresa'))` → per-route GET exception for cargos (do not open whole empresa).
- **Employee lock**: `requireEmployeeUnlocked('empleadoId')` on mutating nomina periodos (same as contratos).
- **Today-only (Bogotá)**: `serverTodayBogota()` in `asistencia.routes.ts` → reuse for R6 writes by PROFESORES/AUXILIARES.
- **Own-item list**: `patientService` notes `where.autor = caller.userId` for PROFESORES/AUXILIARES → R6 `empleadoId` / `usuarioId` = self.
- **Nómina calc**: `nominaService.resolveCalcFields` + FE `usaValorMensual` in `nomina/index.vue`.
- **Decimal money**: `NominaPeriodo.aportesSociales` `@db.Decimal(12,2)` → clone for `bonos`.
- **Nav**: `frontend/app/app.config.ts` sidebar items + `AppSidebar` `can(domain)` + `DOMAIN_PREFIX_MAP`.
- **Tests**: Playwright `backend/tests/{employees,nomina,rbac}/**`, `frontend/tests/local-qa/**`.
- **Local users**: `backend/prisma/test-db/seed-qa.ts` pattern (`password123`).

## Requirements
R1–R4 + R6 as in `01-requirements-qa-session-aug-17.md`. R5 skipped.

## Technical Approach

### R1 — FE only
Replace estado dropdown with two tabs. `estadoFilter` default `'ACTIVO'`. Stats cards may remain; they must not reset the tab to Todos.

### R2 — BE only (narrow)
Keep `CONTRATOS.empresa = false`. On `GET /empresa/cargos` only: if `requireDomain('empresa')` would 403 CONTRATOS, allow. Writes stay `requireRole('ADMIN')` + domain false. Document the exception in the contract. Update matrix-parity comments so the cell stays `false` (exception is route-level, not matrix).

### R3 — schema + BE + FE
- Additive column `nomina_periodos.bonos Decimal(12,2) NULL`.
- Zod `bonos` optional nonnegative. Reject `bonos > 0` unless tipo is FIJO or INDEF (`BONOS_ALLOWED`).
- `resolveCalcFields` for FIJO/INDEF:
  - `subtotalCalculado = valorMensual + bonos` (unless client override)
  - `totalPagado = valorMensual + bonos` — **never add aportes**
- OBRA: still `totalPagado = valorMensual` (no aportes, no bonos).
- OPS: unchanged (`medias * valorJornada`; aportes still **not** in employee-pay story — **confirm in contract**: OPS total today adds aportes; this cycle only changes FIJO/INDEF formula unless tests force a wider change). **Decision in plan**: change **only FIJO/INDEF** totals; leave OPS formula as-is to bound risk.
- FE dialog: insert Bonos between Valor mensual and Subtotal; helper text that Total = mensual + bonos; aportes labeled as referente / no suma.

### R4 — BE
- Diagnose live 400 (do not assume). Likely `valorJornada` required on create leftover, or FE still posting empty jornada that fails a check.
- Required: FIJO/INDEF/OBRA create succeeds with `{ empleadoId, periodo, valorMensual, aportesSociales?, bonos? }` and **no** medias/valorJornada.
- Replace `requireRole('ADMIN')` on POST/PUT `/nomina/periodos` with `requireEmployeeUnlocked` (param `empleadoId` from body). DELETE stays ADMIN (not requested).
- CONTRATOS already pass `requireDomain('nomina')`.

### R6 — new vertical (existing patterns)
- Table `registro_actividades`: `id`, `empleadoId`, `fecha` (date), `texto` (TEXT), `registradoPor`, timestamps. Unique `(empleadoId, fecha)` — one row per employee per day (v1; edit = ADMIN only, so profesores create-once today).
- Domain `actividades`:
  - ADMIN: bypass (full)
  - PROFESORES / AUXILIARES: `create-only` + service own-filter + today-only
  - GERONTOLOGA / CONTRATOS: `read-only`
- Routes `/api/v1/actividades`:
  - `GET /` query `fecha` and/or `empleadoId` — filtered by ACL
  - `POST /` `{ fecha, texto }` — self for PROFESORES/AUXILIARES; ADMIN may pass `empleadoId`
  - `PUT /:id`, `DELETE /:id` — ADMIN only
- Link `empleadoId` via `Usuario.empleadoId` (must exist for those tipos). If missing → 400 `EMPLEADO_REQUIRED`.
- FE page `frontend/app/pages/actividades/index.vue`. Sidebar item **Registro de actividades** immediately after Asistencia (`pi-list` or `pi-book`).
- Seed local users `profesor@miempresa.com` + `auxiliar@miempresa.com` / `password123` **and** linked Empleado rows so own-item tests work.

## Risk & Unknowns
- **R4 400 root cause not reproduced in this session** — W2 must capture the actual response body first.
- OPS total still adds aportes (old formula). User rant was about FIJO/INDEF. If they later want OPS aligned, separate change.
- `Usuario` ↔ `Empleado` link may be missing on some QA users — seed must create it.
- Unique-per-day means a profesor cannot POST a second entry the same day (return 409). ADMIN can PUT.
- Dirty tree / centro-costos ride-along if anyone deploys later — not this plan.

## Implementation Scope
Schema + 1 migration · domain matrix + 1 route file · nomina service/routes · empresa GET exception · empleados tabs · nomina dialog · actividades page + nav · seeds · Playwright BE+FE.

## New Artifacts Proposed
These are **new files** that follow existing module shape (asistencia / nómina). Approval required before Phase 1.

1. `backend/prisma/migrations/YYYYMMDDHHMMSS_add_nomina_bonos_and_registro_actividades/` — additive
2. `backend/src/routes/actividades.routes.ts` + `backend/src/services/actividadService.ts`
3. `frontend/app/pages/actividades/index.vue`
4. Tests: `backend/tests/nomina/nomina-bonos-total.spec.ts`, `backend/tests/empresa/contratos-get-cargos.spec.ts`, `backend/tests/actividades/registro-actividades-acl.spec.ts`, `frontend/tests/local-qa/aug17-qa-frontend.spec.ts`
5. Contract: `development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md`
6. Local seed extras in existing `seed-qa.ts` / local seed (not a new framework)

**Not new abstractions**: no new RBAC engine, no new date helper if `serverTodayBogota` can be imported/shared.

## Open Items
- Staging QA users for PROFESORES/AUXILIARES — deploy/seed later.
- Whether DELETE periodos should also open to CONTRATOS — **no** unless asked.
- Unique-per-day vs multiple entries per day — **unique** for v1 (simple log).

## References
- `00-intake-qa-session-aug-17.md`
- `01-requirements-qa-session-aug-17.md`
- `context/user-feedback/qa-session-aug-17-cleaned.md`
- Prior: `contract-schema-qa-jul-31.md`, `contract-fixes-features-aug-6.md`
- Resume: `context/resume-session/summary-2026-08-17.md`
