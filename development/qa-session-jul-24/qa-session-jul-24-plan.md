# Feature Plan: qa-session-jul-24

## Objective
Ship the 7 QA-Jul-24 items (see `context/user-feedback/qa-session-jul-24-cleaned.md`)
locally with schema migrations, backend logic, frontend UI, and tests. Staging deploy gated.

## Assumptions & Constraints
- Single-empresa system; `cargos_empresa` per-empresa catalog.
- Local only this session; deploy is a separate gated step.
- Prisma migrations generated (never `migrate diff --shadow-database-url`).

## Existing Patterns Used
- **Enums** in `backend/prisma/schema.prisma` (`MedioPagoNomina`, `TipoContrato`); Prisma
  migration folder per change (`backend/prisma/migrations/<ts>_<slug>/migration.sql`).
- **Routes → service** split: `backend/src/routes/*.routes.ts` call `backend/src/services/*Service.ts`;
  Zod `validate()` middleware; error objects `Object.assign(new Error(msg), { status, field })`.
- **RBAC**: `requireRole('ADMIN')` + `backend/src/middleware/domainAccess.ts` DOMAIN_ACCESS matrix.
- **Default seed**: `DEFAULT_CARGOS` in `empresaService.ts` kept in lockstep with the seed migration.
- **Tests**: `backend/tests/{set}/*.spec.ts` (Playwright/bash); frontend `frontend/tests/{set}/*.spec.ts`.
- **Frontend**: Nuxt pages `frontend/app/pages/empleados|asistencia|nomina/**`; v-model reactive
  pitfall — use `:model-value` + `Object.assign` for child form emits (see MEMORY vmodel note).

## Requirements → Items
R1 Nequi llave (alphanumeric/email) + Efectivo option (Item 1)
R2 Fix partial-edit of payment fields + editable by ADMIN & CONTRATOS (Item 2)
R3 Remove Cargos block from Información Laboral tab — UI only (Item 3)
R4 Default cargos catalog delete+recreate to target list (Item 4)
R5 Payment-method preview in employee profile (Item 5)
R6 Asistencia RBAC: CONTRATOS today-only, ADMIN any date + note field (Item 6)
R7 Contract salary by type: add valorMensual, nómina branch (Item 7)

## Technical Approach
- **Schema (wave 1, contract-first):** add `EFECTIVO` to `MedioPagoNomina`; add
  `Contrato.valorMensual Decimal?`; update `DEFAULT_CARGOS` + write cargos delete+recreate
  migration (guarded: raise clear error if a Contrato references a to-be-removed cargo).
  Publish `orchestration-ctx/decisions/contract-schema-qa-jul-24.md` = the shared interface
  (field names, enum values, validation rules per contract type, RBAC rules for asistencia/pago,
  target cargo list). W2/W3 read the contract, not each other's source.
- **Backend (wave 2):** partial employee update (fix payment-field-only edit) + allow CONTRATOS;
  Nequi validation alphanumeric/email; contract create/edit requires valorJornada(OPS) |
  valorMensual(others); `nominaService` branches on tipoContrato; asistencia PUT enforces
  CONTRATOS→today-only, ADMIN→any date; note field persistence.
- **Frontend (wave 2):** payment-method section (Efectivo option, Nequi "llave" relabel +
  alphanumeric/email validation) in nuevo/editar; remove Cargos block from Info Laboral tab;
  medio-de-pago preview in profile; contract form monthly-value field by type; asistencia UI
  locks date picker for CONTRATOS to today + justification note input.

## Risk & Unknowns
- Cargo delete+recreate can violate `Contrato` Restrict FK on staging → migration guards + deploy gate.
- `valorMensual` back-fill for existing non-OPS contracts (nullable; nómina treats null gracefully).
- Asistencia "today" = server-local date (America/Bogota) — define in contract to avoid TZ drift.

## Implementation Scope
Layer-split across 3 workers, contract-first.

| Wave | Worker | Role | Scope | Pts |
|------|--------|------|-------|-----|
| 1 | W1 | pt-data-schema | Schema enums/fields + cargos migration + DEFAULT_CARGOS + contract doc | 6 |
| 2 | W2 | pt-backend-eng | Employee update+RBAC, Nequi validation, asistencia RBAC+note, contract+nómina logic, backend tests | 12 |
| 2 | W3 | pt-frontend-eng | Payment UI (efectivo/llave), remove cargos block, pago preview, contract monthly field, asistencia UI+note, frontend tests | 12 |

W2 & W3 run in parallel (different dirs: backend/** vs frontend/**), both blockedBy W1.

## New Artifacts Proposed
- `Contrato.valorMensual` column + migration (approved via decision 2).
- `EFECTIVO` enum value + migration (implied by Item 1).
- Cargos reconcile migration (approved via decision 1, delete+recreate).
- Contract doc `orchestration-ctx/decisions/contract-schema-qa-jul-24.md` (orchestration-internal).
No new services/abstractions — extends existing route→service pattern.

## Open Items
- Staging deploy + migration run: deferred to gated step after local green.

## References
- context/user-feedback/qa-session-jul-24-cleaned.md
- 00-intake-qa-session-jul-24.md
