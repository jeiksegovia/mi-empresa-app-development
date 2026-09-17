# Feature Plan: fixes-features-aug-6

## Objective
4 items: (1) new roles PROFESORES+AUXILIARES with limited access, (2) 2 new instrumentos (Signos Vitales, Boletín Anual), (3) certificados access for GERONTOLOGA, (4) fix gerontologa-can't-create-fillable-instrument bug.

## Locked decisions (developer-approved 2026-08-06)
- **D1**: PROFESORES + AUXILIARES = 2 new `TipoEmpleado` enum values, **identical** DOMAIN_ACCESS.
- **D2**: Instrument fill-gating uses the **existing `Instrumento.rolesPermitidos`** CSV — **no new column**. Fix its ADMIN-bypass + token matching so role-based fill works per the paciente instrument tab.
- **D3**: Notes privacy for these roles = **RBAC filter by `autor`** (list shows only own) + block PUT/DELETE; **ADMIN + GERONTOLOGA see all**. No schema change (no new visibility value).
- **D4**: Both new instruments = **informational (non-scored)**; applied via `instruments:upgrade` (versioned templates), not migration.

## Existing patterns used
- RBAC matrix mirrored: `backend/src/middleware/domainAccess.ts` `DOMAIN_ACCESS` + FE `frontend/app/composables/useDomainAccess.ts` (cell-by-cell parity; QA validates).
- `requireInstrumentWriter()` (auth.ts) gates instrument create/edit; `rolesPermitidos` CSV intersection in `instrumentService.getInstrumentDefinition` gates fill.
- Instruments as versioned JSON templates in `backend/prisma/instrument-templates/*.v{n}.json` + `instruments:upgrade` (non-destructive; guards deployed-stage DBs → FORCE_UPGRADE).
- Notes under `patients.routes.ts` (`POST /:id/notes`, `requireDomain('notas')`); `NotaCliente.autor` + `visiblePara`.
- Tests: Playwright BE `backend/tests/{rbac,instruments-dynamic,patients}/` + FE `frontend/tests/rbac/`.

## Requirements
| ID | Requirement | Acceptance |
|----|-------------|-----------|
| R1 | Add TipoEmpleado PROFESORES + AUXILIARES (additive enum migration) | enum has 4 values; existing rows unaffected |
| R2 | DOMAIN_ACCESS rows for both (identical): empleados/nomina/certificados=false; pacientes=**read-only**; fichas=create-only (fill); instrumentos=false (can't manage catalog); notas=create-only; empresa/asistencia=false. Mirror FE+BE. | matrix parity FE/BE; QA cell tests |
| R3 | New matrix value **`read-only`** (GET allowed; POST/PUT/PATCH/DELETE→403) — needed for "view paciente basic info, no create/edit" | domainAccess honors it; FE `can`/`canCreateOnly` mirror |
| R4 | Fix `rolesPermitidos` gating: explicit ADMIN bypass; correct token match; created/seeded instruments include intended roles | gerontologa can create + fill; ROLE_NOT_ALLOWED only when truly not permitted |
| R5 | Bug fix: gerontologa creates instrument w/ template → definition present + fillable (root-cause = R4 token/bypass) | repro passes: create from TINETTI → fillable, no "no puede ser llenado" |
| R6 | GERONTOLOGA certificados: false→**true** (read+write) in both mirrors + RBAC tests | geronto GET+POST+PUT certificados 200 |
| R7 | New instrument **SIGNOS_VITALES** template (header + repeatable vitals group), rolesPermitidos incl. PROFESORES,AUXILIARES,GERONTOLOGA,ADMIN | template validates; upgrade activates; fillable by allowed roles |
| R8 | New instrument **BOLETIN_ANUAL** template (header + 6 free-text components), rolesPermitidos incl. PROFESORES,AUXILIARES,GERONTOLOGA,ADMIN | as R7 |
| R9 | Notes: profesores/auxiliares POST allowed; LIST filtered to autor=self; PUT/DELETE→403; admin+geronto see all | BE test matrix |
| R10 | Unit tests updated/added across all above (BE + FE) | green |

## Technical approach
- **Enum + templates only** — no new tables/columns (R1 enum value add is the only migration; reuse rolesPermitidos, NotaCliente.autor).
- **`read-only` matrix value**: extend `DomainAccessValue = boolean | 'create-only' | 'read-only'`; in `requireDomain`, `read-only` → GET allowed else 403; FE `can()` true, `canCreateOnly()` false, add `isReadOnly()`.
- **rolesPermitidos fix**: in `getInstrumentDefinition` (and any fill/record path), add explicit `if (callerRol === 'ADMIN') allow`; ensure caller CSV + allowed CSV compared on trimmed upper/exact tokens; set sane default rolesPermitidos on create (include creator's role) — investigate exact repro first.
- **Notes**: in the notes LIST handler, if caller is EMPLEADO+PROFESORES/AUXILIARES → `where.autor = userId`; block PUT/DELETE notes for them (route guard). Admin/geronto unfiltered.

## Risk & unknowns
- Exact gerontologa-create repro must be confirmed by W-backend before the R4 fix (could be create-default rolesPermitidos OR template seed tokens OR both).
- `read-only` matrix value touches the frozen matrix contract — must update QA parity tests in lockstep.
- Token casing: `rolesPermitidos` uses free-form cargo/role names + ADMIN; caller CSV = `rol,tipoEmpleado` (e.g. EMPLEADO,GERONTOLOGA). Matching must be exact — verify tokens.

## New artifacts proposed (approval required)
1. `read-only` DOMAIN_ACCESS value (matrix vocabulary extension, FE+BE + QA tests).
2. 2 instrument templates: `SIGNOS_VITALES.v1.json`, `BOLETIN_ANUAL.v1.json`.
3. Enum migration `add_tipoempleado_profesores_auxiliares` (additive).
4. New test specs (RBAC roles, rolesPermitidos fix, notes privacy, 2 instruments).
No new tables/columns beyond the enum values.

## Open items
- Pacientes access = `read-only` (view basic info; no create/edit). Confirm at gate.
- Worker count (2 vs 3).

## References
00-intake · PDFs `context/instrumentos-raw/` · `domainAccess.ts` · `instrumentService.ts` · `useDomainAccess.ts`.
