# Improvements jul-9 (Sprint 1+2) — Implemented

**Delivered:** 2026-07-10 · **Plan:** `context/user-feedback/improvements-jul-9-insights.md` · **Handoff:** `development/improvements-jul-9/06-handoff.md`
**Status:** ✅ 17/17 items MET · 40 new test cases all green (32 backend + 8 playwright) · 3 QA gaps found and fixed same-session · not committed

## High-level overview

Implemented the full Sprint 1+2 bundle from the jul-9 QA-session feedback: certificados create-form simplification + comprobante-de-pago on every update (shared `CertificateUpdateForm` component), empresa save-bug fix, paciente notas `fechaIncidente` with server-enforced 2-business-day window, paciente `fechaCumpleanos`/`tipoSangre`/`eps`, empleado educación repeatable + documento identificación + nivelEscritura removal, contrato in its own tab with signed-file upload and per-empresa `CargoEmpresa` catalog (+ empresa cargos manager UI).

4-worker orchestration (planify-team): backend (3 waves, reused), frontend-certificados (2 waves, reused), frontend-pacientes/empleados (fresh), test-quality (fresh). Schema-contract-first: `development/improvements-jul-9/orchestration-ctx/decisions/schema-contract-jul9.md`.

## Key decisions & issues resolved

| # | Decision / issue | Resolution |
|---|---|---|
| D7 deviation | `Contrato.cargo` column NEVER existed — insights doc assumed it (misread of nominas.cargo) | No backfill; `cargoId Int?` nullable FK; NOT NULL deferred; decision record `d7-cargo-migration-approval.md` |
| fechaIncidente backfill | Existing notas rows lacked the new required column | nullable → `UPDATE ... SET fecha_incidente = fecha::date` → SET NOT NULL in one migration |
| TZ trap | UTC-midnight date parsing off-by-one on UTC-5 host | `parseLocalDate` anchors local-noon in notas validation |
| Legacy payload break | Old `cargo: string` on contrato create | Rejected via new `forbidLegacy` pre-validate middleware (Zod strips unknowns, hence middleware) → 400 field=cargoId |
| Empresa save bug (A6) | "guardar cambios" silently did nothing | Frontend root cause: silent return on null empresaId + synchronous role check in setup — fixed in `empresa/editar.vue` |
| GAP-1 (QA, HIGH) | Invalid cargoId FK → 500 (Prisma P2003 bubbled) | Pre-flight findUnique → 400 `{field:'cargoId'}` in POST+PUT contrato |
| GAP-2 (QA) | educación not embedded on GET /employees/:id | Added to ALL_RELATIONS include (asc createdAt) |
| GAP-3 (QA) | DELETE cargos/educación returned 200+body | → 204 No Content per contract |
| sameSite=strict test env | Playwright auth fails when API host (100.85.193.33:3101 per .env) ≠ page host | All jul9 specs use origin-aware helpers; run with matching-host env vars |

## Files (grep-optimized)

**Migrations**: `jul9_additive_fields` `jul9_nota_fecha_incidente` `jul9_educacion_empleado` `jul9_cargo_empresa` (4 new, DB at 22)
**Backend new**: `middleware/forbidLegacy.ts` `services/cargoEmpresaService.ts` `services/educacionEmpleadoService.ts` `utils/businessDays.ts`
**Backend modified**: certificates.routes+certificateService (comprobantePagoUrl), patients.routes+patientService (fechaIncidente L3 hard block), employees.routes+employeeService (educacion CRUD, documentoIdentificacionUrl, educacionEmpleado include), empresa.routes (cargos CRUD 409/204), nomina.routes+nominaService (archivoFirmadoUrl, cargoId pre-flight)
**Frontend new**: `components/certificate/CertificateUpdateForm.vue`
**Frontend modified**: certificados/{crear,[id]}.vue · empresa/editar.vue (save fix + cargos manager) · pacientes/{crear,[id]/index,[id]/editar}.vue · empleados/{nuevo,[id]/editar,[id]/index}.vue (educación repeatable, contrato-laboral tab, documento upload)
**Tests new**: backend `nota-fecha-incidente` `cliente-new-fields` `educacion-crud` `cargos-crud` `contrato-cargo` `update-comprobante` (32 tests) · frontend `jul9-cert-crear-simplified` `jul9-cert-update-comprobante` `jul9-empresa-save` `jul9-pacientes-new-fields` `jul9-nota-fecha-incidente` `jul9-empleado-educacion` `jul9-contrato-cargo` `jul9-cargos-manager` (8 specs)

## Deferred (next planning cycle)
Section C (fichas single-step assign+update, PENDIENTE→VENCIDO cron, EMPLEADO_GERONTOLOGA sub-role, TipoInstrumento enum pending client Excel), E1 auto-uppercase names, D3 dedicated spec, jul4 suite origin migration (22 pre-existing TEST-ENV failures), Colombian holiday table.

## Grep hooks
improvements-jul-9 sprint-1-2 CertificateUpdateForm comprobantePagoUrl fechaIncidente businessDays parseLocalDate TipoSangre fechaCumpleanos eps EducacionEmpleado documentoIdentificacionUrl nivelEscritura CargoEmpresa cargoId forbidLegacy archivoFirmadoUrl contrato-laboral-tab cargos-manager GAP-1 GAP-2 GAP-3 D7-deviation sameSite-strict schema-contract-jul9
