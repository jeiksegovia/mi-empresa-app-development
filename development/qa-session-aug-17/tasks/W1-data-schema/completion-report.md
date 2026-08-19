# W1 completion — qa-session-aug-17 (data-schema)

**Worker:** pt-data-schema (W1)
**Date:** 2026-08-18
**Tasks:** 1 (contract) · 2 (schema+migration) · 3 (seed) — ALL DONE

## Deliverables

| # | Deliverable | Path | Verified |
|---|---|---|---|
| 1 | SSOT contract | `development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md` | file exists; CHECKPOINT sent |
| 2 | Prisma schema | `backend/prisma/schema.prisma` — `NominaPeriodo.bonos`, `RegistroActividad`, Usuario/Empleado relations | `npx prisma validate` OK |
| 3 | Migration up | `backend/prisma/migrations/20260818113726_add_nomina_bonos_and_registro_actividades/migration.sql` | `migrate deploy` applied; `migrate status` up to date |
| 4 | Migration down | `…/down.sql` | on disk (manual rollback) |
| 5 | Seed users | `backend/prisma/seed.ts` | upsert evidence: profesor empleadoId=395, auxiliar empleadoId=396 |
| 6 | Progress | `tasks/W1-data-schema/progress-report.md` | after each step |
| 7 | Proposed plan | `tasks/W1-data-schema/proposed-plan.md` | approved via PROCEED |

## Key Decisions (from contract)

- `BONOS_ALLOWED = TERMINO_FIJO | TERMINO_INDEFINIDO`
- FIJO/INDEF: `subtotalCalculado = totalPagado = valorMensual + bonos` (aportes stored, **not** added)
- OPS formula unchanged this cycle; OBRA = `valorMensual` only
- `actividades` matrix: PROFESORES/AUXILIARES `create-only`; GERONTOLOGA/CONTRATOS `read-only`; own-item + today-only are **service rules**
- `CONTRATOS.empresa` stays `false`; GET `/empresa/cargos` is route exception
- Periodos POST/PUT: `requireEmployeeUnlocked('empleadoId')`, not `requireRole('ADMIN')`
- `RegistroActividad` @@unique([empleadoId, fecha]) → @@map `registro_actividades`

## New tables / columns

| Object | Detail |
|---|---|
| `nomina_periodos.bonos` | `DECIMAL(12,2) NULL` |
| `registro_actividades` | PK `registro_actividad_id`; FKs `empleado_id` CASCADE, `registrado_por` RESTRICT; unique `(empleado_id, fecha)` |

## Seed credentials (local)

| Email | Password | rol | tipoEmpleado | empleadoId |
|---|---|---|---|---|
| `profesor@miempresa.com` | `password123` | EMPLEADO | PROFESORES | set |
| `auxiliar@miempresa.com` | `password123` | EMPLEADO | AUXILIARES | set |

## Issues

- Full `npx prisma db seed` not run (would wipe local data). Additive upsert script `backend/scripts/_tmp-seed-profesor-auxiliar.ts` used for verification; `seed.ts` itself contains the durable create path for clean-slate re-seeds.
- Prisma client `$queryRaw` via adapter hit a runtime quirk; verification used `psql` + dedicated upsert script instead. NOT a schema defect.

## Integration Notes (W2 / W3)

**Read this contract — do not invent names from schema.prisma:**

`development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md`

- W2: domain cell `actividades`, cargos GET exception, nomina `bonos` + formulas + periodos auth, new `actividades` routes/service, BE tests. Seed users ready for R6 ACL specs.
- W3: FE testids in contract §6; tabs / nomina dialog / actividades page + nav + `useDomainAccess` mirror. Types for `bonos` + `RegistroActividadDto` from contract §3.6 / §4.4.

## Acceptance criteria map

| AC | Evidence |
|---|---|
| Contract field names / formulas / BONOS_ALLOWED | contract §3 |
| Domain actividades cells + service rules | contract §1 |
| CONTRATOS.empresa false + cargos exception | contract §2 |
| Periodos unlock auth | contract §3.4 |
| RegistroActividad model | schema + migration + psql |
| API / error codes / testids / seed | contract §4–§7 |
| Migration applied locally | `migrate deploy` output in progress-report |
| No `--shadow-database-url` | handwritten SQL only |
