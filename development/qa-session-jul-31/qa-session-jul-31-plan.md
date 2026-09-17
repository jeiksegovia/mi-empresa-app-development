# Feature Plan: qa-session-jul-31

## Objective
Ship R1 (Nequi→Nequi/Bre-B label), R2 (nómina Registrar dialog Valor-Mensual by contract type) and R3 (optional EPS/Fondo de pensiones/ARL on empleado) — continuation of qa-session-jul-24.

## Assumptions & Constraints
- Enum value `NEQUI` unchanged; R1 is display-only.
- `Contrato.valorMensual` + `nominaService.resolveCalcFields` branch already exist (jul-24 R7). R2 is a FE dialog gap + a BE suggestion-payload completeness check (R2b).
- R3 adds 3 nullable text columns to `Empleado`; additive migration, re-runnable on staging.
- No new routes/services; extend existing. No prod. Migrations gitignored.

## Existing Patterns Used
- **Contract-first orchestration**: `development/qa-session-jul-24/.../contract-schema-qa-jul-24.md` → W1 authors `contract-schema-qa-jul-31.md`; W2/W3 implement to contract, don't read schema directly.
- **Schema/migration**: additive nullable columns on `Empleado` (exemplar: jul-24 `valorMensual` on Contrato, and existing `medioPagoNequi`/`bancoNombre` VARCHAR fields at `schema.prisma:99-103`). New: `eps`, `fondoPensiones`, `arl` VARCHAR(100) nullable.
- **Backend service layer**: `employeeService.ts` create/update field passthrough (`schema.prisma:99-103` fields already threaded); `nominaService.resolveCalcFields` (`nominaService.ts:46` APORTES_ALLOWED, branch OPS/others). Zod at `nomina.routes.ts` / `employees.routes.ts`.
- **Frontend**: PrimeVue dialog in `nomina/index.vue` (`aportesAllowed` computed at :117, dialog calc block :592-674); employee wizard `empleados/nuevo.vue` (5 steps), `[id]/index.vue` (details), `[id]/editar.vue`.
- **Tests**: Playwright specs — BE `backend/tests/{employees,nomina}/*.spec.ts`; FE `frontend/tests/local-qa/*.spec.ts`.

## Requirements
R1, R2, R2b, R3 — see `01-requirements-qa-session-jul-31.md`.

## Technical Approach
**R1 (FE only)**: replace the "Nequi" option label / display string with "Nequi/Bre-B" in the 4 pages. Keep `value="NEQUI"`. Grep anchor: `Nequi` in `frontend/app/pages/empleados/*` + `nomina/index.vue`.

**R2 (FE, main)**: in `nomina/index.vue` dialog, introduce `usaValorMensual = computed(editingTipo ∈ {TERMINO_FIJO, TERMINO_INDEFINIDO, OBRA_O_LABOR})`.
- When `usaValorMensual`: hide Medias jornadas + Valor media jornada inputs and the "Valor media jornada (contrato)" info/warning (:549-567, :593-622); show a read-only/base **Valor Mensual** (prefilled from contract) feeding `subtotalCalculado`; `recomputeTotal` uses valorMensual + aportes.
- `aportesAllowed` stays FIJO/INDEFINIDO only (OBRA has no aportes → total = valorMensual).
- OPS path unchanged.

**R2b (BE)**: ensure GET /nomina row suggestion (`sugerencia`/`entrada`) surfaces a valorMensual-derived `subtotalCalculado` (or exposes `contratoActivo.valorMensual`) for non-OPS so FE prefills without jornada. Confirm persisted calc matches `resolveCalcFields`.

**R3 (schema→BE→FE)**: migration adds `eps`, `fondo_pensiones`, `arl` VARCHAR(100) nullable to `empleados`. `employeeService` create/update thread the 3 optional fields; Zod optional-nullable in `employees.routes.ts`. FE adds 3 optional inputs to "Datos personales" step of `nuevo.vue`, mirror in `editar.vue`, display in `[id]/index.vue`.

## Risk & Unknowns
- R2 dialog has existing `v-model` on reactive form — follow the vmodel-const-reactive pitfall (use `:model-value` + explicit handlers where child emits are dropped). Tests must drive inputs.
- R2b: need to confirm where suggestion is built (nominaService vs route) — W2 investigates first.
- Low overall risk; additive, no destructive migration.

## Implementation Scope
- Schema: 1 migration (3 columns). Backend: employeeService + employees.routes (R3), nomina suggestion check (R2b), tests. Frontend: 4 pages (R1), nomina dialog (R2), employee wizard/details/editar (R3), tests.

## New Artifacts Proposed
- **1 migration** `add_empleado_eps_fondo_arl` (3 nullable VARCHAR columns on `empleados`). Extends existing Empleado; no new model/table.
- **1 contract doc** `orchestration-ctx/decisions/contract-schema-qa-jul-31.md` (authored by W1).
- New test spec files (FE/BE) following existing naming.
- No new routes, services, models, or tables.

## Work Streams (proposed workers — 3, contract-first, 2 waves)
- **W1 · pt-data-schema** (Wave 1): author `contract-schema-qa-jul-31.md` (R1 label map, R2/R2b nómina interface matrix by tipoContrato, R3 field names/types); add 3 columns + migration; migrate status clean local. ~5 pts.
- **W2 · pt-backend-eng** (Wave 2, blockedBy W1): R3 persist EPS/Fondo/ARL (service + Zod); R2b nómina suggestion valorMensual for non-OPS; BE Playwright specs. ~6 pts.
- **W3 · pt-frontend-eng** (Wave 2 ∥ W2, blockedBy W1): R1 label rename (4 pages); R2 nómina dialog branch; R3 fields in nuevo/editar/details; FE Playwright specs. ~8 pts.
- QA/convergence: orchestrator validates against contract; fix-ups route to original author.

## Open Items
- Field type EPS/Fondo/ARL = free-text VARCHAR(100) (default; flag if catalog wanted).

## References
- 00-intake / 01-requirements (this dir); cleaned feedback `context/user-feedback/qa-session-jul-31-cleaned.md`; jul-24 contract (template).
