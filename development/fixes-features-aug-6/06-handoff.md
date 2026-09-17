# Handoff: fixes-features-aug-6

**Date**: 2026-08-06 · **Status**: implementation COMPLETE + verified. Deploy = task #14 (staging, gated).

## Delivered (4 items)
| Item | Summary | Verified |
|---|---|---|
| S1 roles | TipoEmpleado +PROFESORES +AUXILIARES (additive migration); identical DOMAIN_ACCESS (pacientes=read-only, fichas/notas=create-only, rest false); new `read-only` matrix value + `isReadOnly()`; FE mirror parity | BE 29/29, FE 8/8 |
| S2 instruments | SIGNOS_VITALES (header + repeatable vitals group) + BOLETIN_ANUAL (header + 6 narrative components), informational; rolesPermitidos=ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES; via instruments:upgrade | seed/upgrade verified |
| S3 certificados | GERONTOLOGA certificados false→true (BE+FE + tests) | verified (GET /certificates 200) |
| S4 bug | rolesPermitidos hardening (explicit ADMIN bypass, new-role tokens, create-default includes creator) + crear.vue defaults picker to creator role + **requires codigo when template selected** (closes null-codigo "no llenable" hole) | crear-template 4/4 |

## Root cause of the gerontologa bug (revised from contract §3.1)
Contract's hypothesis did NOT reproduce (caller CSV `EMPLEADO,GERONTOLOGA` intersects seed `ADMIN,EMPLEADO` on EMPLEADO). Two real causes fixed on the FE: (a) create form's `rolesPermitidos` picker now defaults to include the creator's role (so a geronto-created instrument includes GERONTOLOGA → fillable); (b) `codigo` now required when a template is selected (else null codigo → detail view shows "Sin definición — no llenable" since it fetches the definition by codigo). Backend §3.2 hardening shipped as defense-in-depth.

## Test evidence (orchestrator-run)
- BE `rbac/aug6-features` (25) + `rbac/matrix-parity` (4) = **29/29 pass**.
- FE `rbac/roles-aug-6` **8/8**; `instruments-dynamic/crear-template` **4/4** (incl. codigo-required).
- Pre-existing/TEST-ENV (NOT this wave): patient-notes TZ (4), instruments-dynamic Tailscale-IP + TINETTI v5 drift (5).

## Files
BE: `middleware/domainAccess.ts`, `services/{instrumentService,patientService}.ts`, `routes/{instruments,patients}.routes.ts`, `scripts/instruments-upgrade.ts`, migration `20260806035159_add_tipoempleado_profesores_auxiliares`, templates `SIGNOS_VITALES.v1.json`/`BOLETIN_ANUAL.v1.json`, tests `rbac/{aug6-features,matrix-parity,domain-access}.spec.ts`.
FE: `composables/useDomainAccess.ts`, `shared/types/api.ts`, `pages/instrumentos/crear.vue` (+ detail/fill, pacientes notes), tests `rbac/roles-aug-6.spec.ts`, `instruments-dynamic/crear-template.spec.ts`.

## Deploy (task #14)
Staging release, R0–R5 pattern. Additive: enum migration #27 + 2 instruments via instruments:upgrade + BE/FE code. Low risk (no destructive ops). Gate R4 (point of no return) for developer approval.
