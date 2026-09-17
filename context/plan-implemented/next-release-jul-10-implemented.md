# Next-Release jul-10 (Fichas + Hardening + Uppercase) — Implemented

**Delivered:** 2026-07-10 · **Handoff:** `development/next-release-jul-10/06-handoff.md`
**Origin:** deferred groups from `context/plan-implemented/improvements-jul-9-implemented.md` §Deferred (transcript-traced) · **Status:** ✅ 11/11 items MET · 30 new tests green · jul4 suite resurrected 2/24 → 24/24 · **Shipped to staging 2026-07-10** (runbook: `context/implementation-plan/staging-release-jul10-runbook.md`) · not committed

## Shipped to staging (2026-07-10)
- **Backend**: CodeDeploy `d-9CDIOTWHK` (1m 9s, first attempt) → 6 migrations applied 14→20; backfills verified (fecha_incidente 1/1, cargo_id vacuous on 0 contratos; cargos seed no-op — staging has 0 empresas, L23)
- **Frontend**: Amplify Job 4, apiBase baked correctly
- **QA**: 3-tier staging suite 33/33; new-endpoint smoke all green; D7/C6/E1/C1 feature+negative tests verified live
- **Backup**: `pre-releases/pre-jul10.sql.gz` (16,862 B, AES256); tag `staging-jul10-snapshot`
- **Carry-overs (L24-L27)**: jul10_contrato_cargo_not_null migration hardcodes empresa_id=6 (dev-tuned — re-tune if staging gets multi-empresa contratos); /users soft-disable only; contrato routes nested under /nomina; ficha create requires versionRegistro

## High-level overview

Shipped the fichas single-step workflow (the gerontóloga's core daily flow, transcript lines 210–286): selecting an instrumento immediately opens one dialog that assigns + uploads + completes atomically (`POST /patients/:id/fichas` branches on `archivoCompletado` presence; legacy PENDIENTE flow preserved for renewals). Estados are now truthful via lazy PENDIENTE→VENCIDO flip (no cron), feeding the new weekly vencimientos endpoint. Instrument writes gated behind ADMIN or EMPLEADO+GERONTOLOGA via new `TipoEmpleado` enum + `/users` CRUD. Hardening pack resurrected the jul4 regression suite and tightened `Contrato.cargoId` to NOT NULL. E1 auto-uppercase live on both layers for entity nombre fields (descriptions preserved).

3-worker orchestration, 2 reused across waves (backend: migrations→API; test-quality: infra-repair→QA), 1 fresh (frontend). C5 (TipoInstrumento enum) excluded — still blocked on client Excel samples.

## Key decisions & issues resolved

| # | Decision / issue | Resolution |
|---|---|---|
| D-C4 | Cron vs lazy flip for VENCIDO | Lazy on-read (`updateMany` before reads in getPatient + vencimientos) — no infra, truthful at view time |
| D-C1 | Endpoint shape for single-step | Same `POST /patients/:id/fichas`, branch on archivoCompletado presence; `singleStepCompleted` flag in response |
| D7 tighten | cargoId NOT NULL | 17 junk NULL rows discovered + backfilled to Otro; Zod REQUIRED (missing → 400 errors.cargoId) |
| tipoEmpleado UI | No user-management surface exists in app | Kept API-only; spec documented in W2 result.md for future surface |
| Old 2-step assign button | Superseded by single-step | Removed by design; obsolete e2e test rewritten |
| E1 scope | Which fields uppercase | nombre/nombreInstrumento/apellido on 5 models; NOT descripcion/notas; NOT CargoEmpresa catalog; historical rows untouched; spec fixtures updated to UPPERCASE (never case-insensitive-loosened) |
| Name-collision incident | Stale jul-9 shutdown sweep raced new same-named spawns | Only old workers terminated; PING-probe protocol confirmed liveness. **Lesson: never reuse teammate names while shutdowns pending** |
| e2e harness | goToPacientes() sidebar click timed out headless | Replaced with direct page.goto('/pacientes') |

## Files (grep-optimized)

**Migrations**: `jul10_contrato_cargo_not_null` (backfill 17 → Otro) · `jul10_tipo_empleado` (enum TipoEmpleado + usuarios.tipo_empleado)
**Backend new**: `routes/users.routes.ts` (ADMIN-only CRUD, tipoEmpleado pairing rule) · `requireInstrumentWriter` in `middleware/auth.ts`
**Backend modified**: `patientService.ts` (createFichaAtomic, flipExpiredFichas, listFichasVencimientos) · `patients.routes.ts` (C1-aware POST, vencimientos endpoint) · `instruments.routes.ts` (write gating) · `nomina.routes.ts`+`nominaService.ts` (cargoId required) · E1 Zod transforms in certificates/instruments/patients/employees/empresa routes
**Frontend modified**: `pacientes/[id]/index.vue` (single-step dialog, descargar plantilla renamed, testids ficha-single-step-dialog/ficha-descargar-plantilla) · `instrumentos/crear.vue` (return-URL) · uppercase-as-you-type on 8 forms
**Tests new**: backend `ficha-single-step` `ficha-vencido-flip` `fichas-vencimientos` `instruments/gating` `users/tipo-empleado` `uppercase-transform` `documento-identificacion` (28 tests) · frontend `jul10-ficha-single-step.spec.ts` (3)
**Tests repaired**: all 6 jul4 files (origin+selectors+cargoId+uppercase) · patient-notes (B1 fixture) · dashboard/auth port-3001 · e2e/paciente-fichas harness · 7 fixture files reconciled to UPPERCASE

## Deferred
GAP-1: 5 legacy local-qa files still hardcode localhost:3101 (8 tests, ~30 min sweep) · employees-full-create certificadoAlturas pre-existing BUG · user-management UI · C5 enum (client data) · holiday table.

## Grep hooks
next-release-jul-10 fichas-single-step createFichaAtomic singleStepCompleted flipExpiredFichas vencimientos diasHastaVencimiento TipoEmpleado GERONTOLOGA requireInstrumentWriter users.routes tipoEmpleado-pairing descargar-plantilla plantilla-rename cargo_not_null cargoId-required uppercase-transform E1 jul4-resurrected goToPacientes-fix name-collision-lesson GAP-1-origin-sweep
