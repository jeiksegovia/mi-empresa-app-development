# qa-session-jul-24 — implemented

High-level: 7 QA items from `context/user-feedback/qa-session-jul-24-cleaned.md` implemented
locally via planify-team (W1 schema → W2 backend ∥ W3 frontend). Staging deploy GATED (not run).

## Items → implementation (grep anchors)
- **R1 medio-pago EFECTIVO + Nequi llave**: `MedioPagoNomina += EFECTIVO`; Nequi regex email|alnum(6-25).
  Files: `employees.routes.ts` (refineMedioPago), `employeeService.ts` (normalizeMedioPagoFields),
  `empleados/nuevo.vue`, `empleados/[id]/editar.vue` (NEQUI_LLAVE_REGEX). testid `medio-pago-nequi-error`.
- **R2 partial payment edit + RBAC**: `employeeService.updateEmployee` merge-state validation;
  ADMIN+CONTRATOS (domainAccess already allowed CONTRATOS on empleados). PUT /employees/:id.
- **R3 remove Cargos block (UI only)**: removed "Cargo en la Empresa" card from Info Laboral in
  `nuevo.vue`/`editar.vue`; backend `Cargo` model + `/employees/:id/cargos` untouched.
- **R4 default cargos**: `DEFAULT_CARGOS` (empresaService.ts) = 10 target [Administrador, Auxiliar de
  Enfermería, Gerontólogo/Gerontóloga, Servicios Generales, Temporal, Terapeuta Ocupacional,
  Fisioterapeuta, Psicólogo, Educador Físico, Artes y Manualidades]. Migration delete+recreate;
  all contratos repointed to fallback `Temporal` (decision D1). Removed: Cocinera, Otro, Auxiliar QA.
- **R5 medio-pago preview**: `empleados/[id]/index.vue` `medioPagoPreview` computed + card (3 branches +
  empty state; bank number masked last-4).
- **R6 asistencia RBAC**: `serverTodayBogota()` (Intl en-CA America/Bogota); CONTRATOS PUT non-today→403
  field=fecha, ADMIN any date. `asistencia.routes.ts`, `asistencia/index.vue` date-lock. `notas` field.
- **R7 contract salary by tipo**: `Contrato.valorMensual Decimal?` added. OPS→valorJornada required,
  OBRA_O_LABOR/TERMINO_FIJO/TERMINO_INDEFINIDO→valorMensual required. `nominaService.resolveCalcFields`
  branches on tipoContrato (non-OPS: totalPagado=valorMensual+aportes, snapshots null). UI toggles field by tipo.

## Migration
`backend/prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual` — enum ADD VALUE,
contratos ADD valor_mensual, cargos_empresa delete+recreate (per-empresa, reassign-to-Temporal, RAISE guard).

## Key decisions / deviations
- D1 cargos = full delete+recreate, reassign ALL contratos to `Temporal` (turning point: local DB was
  QA-fixture with 1 cargo 'Auxiliar QA' + all 24 contratos on it). See decisions/cargos-fk-reassignment.md.
- D2 salary: valorMensual on Contrato only (NominaPeriodo has no column); passed as optional calc override.
- D3 Cargo model: UI removal only, model/endpoints kept.
- D4 env: local implemented; staging deploy gated.
- Benign: DEFAULT_CARGOS edited by W1+W2, converged identical.

## Tests
Backend: 3 new specs (employees-partial-medio-pago, asistencia-rbac, contrato-valormensual) + 7 updated;
67 pass (3 pre-existing port-3001 failures = TEST-ENV, not regressions).
Frontend: `frontend/tests/local-qa/jul24-qa-frontend-{payments,asistencia,contract-monthly}.spec.ts`.

## Staging release (DONE 2026-07-31)
Runbook: `context/implementation-plan/staging-release-qa-jul24-runbook.md` (R0–R5, auto-after-backup).
- CodeDeploy `d-OJON0UVVK` (group miempresa-staging; prod untouched) Succeeded.
- Amplify `d1nsxjyualdzdu` branch staging job 12 Succeeded.
- Backup net: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz` (restore cmd in runbook R1).
- Migration applied on-instance: cargos 7→10, both contratos repointed to Temporal (cargo_id=12), EFECTIVO enum,
  valor_mensual column. `prisma migrate status` = 24/24. Health API+FE 200 (independently confirmed).
- 7-item post-deploy smoke + RBAC ALL PASS; FE 9-page 200; baked config matches SSM.
- Side effects (documented, revert via R1 backup): empleado 1 (JAEKOV) contratos id1/id2 now cargo=Temporal;
  contrato id2 valorMensual=1300000 (smoke); nomina periodo id1 created; asistencia 2026-07-30/31 for JAEKOV.

## Not committed
qa-jul24 code is uncommitted working tree (ships via artifact). Commit only on explicit user instruction.
Prod does not exist; never targeted.
