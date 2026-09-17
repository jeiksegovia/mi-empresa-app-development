# Team Plan: nomina-asistencia-jul-18

## Context

Pre-planning artifacts used:
- `nomina-asistencia-jul-18-plan.md` — feature plan (approved + execute 2026-07-18)
- `01-feature-draft-nomina-asistencia-jul-18.md` — product draft approved
- `01-requirements-nomina-asistencia-jul-18.md` — R1–R25
- `00-intake-nomina-asistencia-jul-18.md` — QA Jul-17 intake

## Objective

Implement medio de pago, valor jornada on contratos, Asistencia module (AM/PM), and nómina liquidación calc (attendance × rate + aportes for FIJO/INDEFINIDO) with tests.

## Implementation Location

- Source code: repo root (`backend/`, `frontend/`)
- Orchestration: `development/nomina-asistencia-jul-18/`
- Helper scripts: none required

## Work Streams

| ID | Stream | Worker | Role | Points | Dependencies |
|----|--------|--------|------|--------|--------------|
| T1 | Schema migration + living contract doc | W1 | backend-eng | 3 | — |
| T2 | Empleado medio pago + pendiente sync | W1 | backend-eng | 2 | T1 |
| T3 | Contrato valorJornada API | W1 | backend-eng | 1 | T1 |
| T4 | Asistencia service + routes | W1 | backend-eng | 3 | T1 |
| T5 | Nómina enrichment + calc fields | W1 | backend-eng | 3 | T1,T4 |
| T6 | Backend smoke API specs | W1 | backend-eng | 2 | T2–T5 |
| T7 | FE types + domain `asistencia` + sidebar | W2 | frontend-eng | 2 | T6 |
| T8 | Empleado medio + contrato valor UI | W2 | frontend-eng | 3 | T7 |
| T9 | `/asistencia` Registrar hoy page | W2 | frontend-eng | 5 | T7 |
| T10 | Nómina dialog enrichment | W2 | frontend-eng | 3 | T7 |
| T11 | FE smoke + RBAC nav update | W2 | frontend-eng | 2 | T8–T10 |
| T12 | QA deep tests vs contract + gap report | W3 | test-quality | 5 | T11 |

## Dependency Graph

```
T1 → T2, T3, T4
T4 → T5
T2,T3,T5 → T6
T6 → T7 → T8, T9, T10 → T11 → T12
```

## Interface Contracts

**Authoritative file** (W1 owns, fills during T1–T5):
`development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`

Downstream workers: **contract is authoritative — do not open schema.prisma / services to invent names.**

### Locked product rules

- Media jornada = 4h; day = AM and/or PM booleans.
- Rate only on Contrato (`valorJornada`); never on asistencia.
- Medio pago optional; pendiente text exact: `Falta medio de pago de nómina`.
- Transfer: bancoNombre + bancoTipoCuenta (AHORRO|CORRIENTE) + bancoNumeroCuenta; Nequi: medioPagoNequi.
- Aportes only TERMINO_FIJO / TERMINO_INDEFINIDO.
- totalPagado editable; dual-write `salario = totalPagado` when total set.
- valorJornada required on **new** contracts (400 if missing).
- Domain key `asistencia` matrix = empleados (CONTRATOS true, GERONTOLOGA false).
- Sidebar: Asistencia immediately after Empleados.

### API sketch (W1 freezes exact shapes in contract)

```
GET  /api/v1/asistencia?fecha=YYYY-MM-DD
PUT  /api/v1/asistencia/dia  { fecha, items:[{empleadoId,jornadaAm,jornadaPm,notas?}] }
GET  /api/v1/asistencia/resumen?periodo=YYYY-MM&empleadoId?

# employees create/update/detail + medio fields
# contratos + valorJornada
# GET /nomina?periodo= enrichment + POST/PUT periodos calc fields
```

### Enums

```
MedioPagoNomina: NEQUI | TRANSFERENCIA_BANCARIA
TipoCuentaBanco: AHORRO | CORRIENTE
```

## Communication Plan

- No direct worker↔worker messaging.
- W1 → orchestrator → W2: contract path + any deviations table.
- W3 tests against contract only; gaps route back to original author.

## File ownership

| Worker | Owns (write) | Must NOT touch |
|---|---|---|
| W1 | `backend/prisma/**`, `backend/src/services/{employee,nomina,asistencia}Service.ts`, `backend/src/routes/{employees,nomina,asistencia,index}.*`, `backend/src/middleware/domainAccess.ts`, `backend/tests/{employees,asistencia,nomina}/**` new specs, contract decision doc | `frontend/**` |
| W2 | `frontend/**` (pages, app.config, useDomainAccess, shared/types, frontend/tests) | `backend/**` except read contract |
| W3 | `backend/tests/**`, `frontend/tests/**` only (new/extend tests); gap report in tasks/W3 | production source (no fix — report only) |

## Wave reuse decisions (pre-committed)

| Wave | Reuse? | Rationale |
|---|---|---|
| W1 | FRESH spawn worker-1 | New domain |
| W2 | FRESH worker-2 after W1 COMPLETE validated | Different layer; needs full FE context |
| W3 | FRESH worker-3 | Verification must not share implementer context |
| Fix-ups | REUSE original author | Same files |

## Known traps (preload)

- Do NOT use `prisma migrate diff --shadow-database-url`.
- Do NOT `pkill` generic node/tsx; prod bun may be on 4142.
- Local backend tests: `TEST_API_URL` / cookie login pattern from `backend/tests/nomina/cuenta-cobro-required.spec.ts`.
- Use far-future periods (`2099-xx`) for nomina unique (empleado, periodo).
- Existing ADMIN `requireRole` on contract/nomina writes — do not remove.
- Prisma client regenerate after migrate.
- Frontend RBAC tests assert sidebar items — must include Asistencia for CONTRATOS.
- `Domain` type union must be updated both BE and FE or TS fails.

## Validation (orchestrator)

On each COMPLETE: read completion-report, `git status` claimed files, re-run 1–2 smoke commands before unblocking next wave.
