# fixes-jul17-2 — implemented + shipped to staging (2026-07-17)

grep hooks: fixes-jul17-2 rbac domain-access CONTRATOS GERONTOLOGA requireDomain DOMAIN_FORBIDDEN
useDomainAccess seed-qa qa-admin qa-gerontologa qa-contratos get-qa-creds crear-from-template
templateCodigo InstrumentAuditView probar-sin-guardar dry-run staging-deploy-checklist
d-8E7JTGNMK amplify-job-9 B34 B35 20260717120000_jul17_tipo_empleado_contratos

## High-level overview
Follow-up cycle to instrumentos-dynamic-fichas. (1) **RBAC**: additive `TipoEmpleado.CONTRATOS`;
single-source access matrix (`backend/src/middleware/domainAccess.ts` `DOMAIN_ACCESS` +
`requireDomain`, mirrored in `frontend/app/composables/useDomainAccess.ts`) gating 8 domains
(pacientes create-only for CONTRATOS at METHOD level; fichas/instrumentos/notas for gerontóloga;
empleados/nómina/certificados for contratos; empresa ADMIN-only among profiles). ADMIN bypass;
`tipoEmpleado=null` EMPLEADO = zero regression; unknown future sub-roles allow-fallback. 403
`DOMAIN_FORBIDDEN` + frontend toast/redirect + sidebar/tab gating; `tipoEmpleado` added to
login//me payloads. (2) **QA seeding**: `seed-qa.ts`/`seed-qa-staging.sh` provision 3 profile
users with per-profile SSM SecureStrings (`/miempresa/staging/qa/{qa-admin,qa-gerontologa,qa-contratos}/…`
+ legacy alias); `get-qa-creds.sh` prints all three; MANDATORY manual post-deploy/reset step
documented (`context/implementation-plan/staging-deploy-checklist.md`, runbook OP-7, unmissable
reset-script reminder). (3) **Instrumentos UX**: crear-from-template (`POST /instruments` optional
`templateCodigo` → transactional deep-copy of the template's active definition as the new
instrument's own v1, source byte-immutable; "Sin definición — no llenable" states + assign-picker
exclusion), `InstrumentAuditView` (all option scores, subtotal maxima, ranges, skip rules,
print-friendly) and "Probar sin guardar" dry-run (live client scoring, ZERO network writes).

## Verification
Local: W9 13/13 (RBAC matrix + method-level + null-regression + create-from-template incl.
source checksum); W10 11/11 (gating/crear/audit-dryrun, mocked determinism); W11 QA 20 live tests
(matrix parity 16/16 backend↔frontend, live 3-profile e2e 9/9, crear live 4/4, audit/dry-run live
3/3 with zero-write interception), regression 114/0, ficha-transitions fixture modernized, 0 gaps.
Staging (gated release, runbook `staging-release-jul17-2-runbook.md`): clean reset (22/22
migrations incl. additive CONTRATOS enum; dump `pre-releases/pre-jul17-2.sql.gz` SHA256 2cf7cea2…),
FIRST real `seed-qa-staging.sh` run (3 users ids 5/6/7 + SSM pairs; fixes the broken staging QA
login), backend `d-8E7JTGNMK` Succeeded, Amplify job 9 SUCCEED, R6 QA 23/23 incl. live-403 matrix
probes and on-staging crear-from-template scored 75/"Dependencia moderada".

## Key decisions / issues
- Matrix duplicated backend/frontend by design; parity enforced by a programmatic QA spec.
- Root-cause context: jul-17 release broke the developer's staging login because the QA user is
  SSM-provisioned (not part of db:seed) and the reset dropped it — this cycle institutionalizes
  the re-provisioning step and role-aware QA users.
- **B34** seed-qa-staging.sh `declare -A` breaks macOS system bash 3.2 (mitigated via brew bash;
  future: portable syntax). **B35** `put_param` lacks `--overwrite` → non-idempotent SSM writes,
  aborts on stale legacy alias (mitigated at wrapper layer; future: add --overwrite). Both queued
  for a fix-up wave; scripts were frozen deliverables during the release.
- Prior follow-ups still open: B32 TTY-guard on reset-staging-db.sh; certificates filter 500 (pre-existing).

## References
Handoff: `development/fixes-jul17-2/06-handoff.md` · contract addendum:
`development/fixes-jul17-2/orchestration-ctx/decisions/contract-fixes-jul17-2.md` · runbooks:
`staging-release-jul17-2-runbook.md`, `staging-deploy-checklist.md`
