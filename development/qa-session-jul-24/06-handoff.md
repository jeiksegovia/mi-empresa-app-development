# Handoff: qa-session-jul-24

**Status:** All 7 QA-Jul-24 items implemented locally, tested, integration-validated. Staging deploy = GATED (not done).
**Source of truth:** `context/user-feedback/qa-session-jul-24-cleaned.md` · contract: `orchestration-ctx/decisions/contract-schema-qa-jul-24.md`

## What each worker delivered
### W1 — pt-data-schema (task 1)
- `MedioPagoNomina` += `EFECTIVO`; `Contrato.valorMensual Decimal?` added.
- Migration `20260731203612_qa_jul24_cargos_efectivo_valormensual` applied clean on local :15432.
- `cargos_empresa` → 10 target cargos; all 24 contratos repointed to `Temporal` (fallback, decision D1).
- `DEFAULT_CARGOS` updated (lockstep). Published the authoritative contract doc.

### W2 — pt-backend-eng (tasks 2,3,4) — `backend/**`
- **Item 1/2:** `employees.routes.ts` + `employeeService.ts` — EFECTIVO enum, Nequi llave regex (email OR alphanum 6–25), partial payment-field update (merge-state validation), ADMIN+CONTRATOS allowed (domainAccess already granted CONTRATOS on empleados).
- **Item 6:** `asistencia.routes.ts` — `serverTodayBogota()`; CONTRATOS→403 on non-today, ADMIN any date; `notas` round-trip verified.
- **Item 7:** `nomina.routes.ts` + `nominaService.ts` — contract create/edit branches required field on `tipoContrato` (OPS=valorJornada, others=valorMensual); nómina calc branches; legacy null `valorMensual` → treated as 0.
- Tests: 3 new specs (12 tests) + 7 legacy specs updated. Full local run: 67 pass.

### W3 — pt-frontend-eng (tasks 5,6) — `frontend/**`
- **Item 1:** `empleados/nuevo.vue` + `[id]/editar.vue` — Efectivo option, "Llave" relabel + regex validation (byte-identical to contract).
- **Item 3:** Cargos block removed from Información Laboral (UI only; backend `Cargo` model/endpoint untouched).
- **Item 5:** `empleados/[id]/index.vue` — medio-de-pago preview (3 branches + empty state, bank number masked).
- **Item 6/7:** `asistencia/index.vue` date-lock for CONTRATOS (Bogota today) + notas; contract form toggles valorJornada/valorMensual by tipo.
- Tests: 3 new specs (14 tests).

## Integration notes
- Shared `empresaService.ts DEFAULT_CARGOS` edited by both W1 and W2 → converged on identical correct 10-item list (benign; final content verified).
- Frontend Nequi regex + Bogota TZ helper are byte-identical to backend (contract §3, §5.1) — no drift.
- `NominaPeriodo` has no `valorMensual` column; monthly value lives on `Contrato`, passed as optional calc override (contract §4 / D2).

## Run / test instructions
- Local backend :3101, frontend :3100, db :15432. Migration already applied locally.
- Backend specs: run the project's backend test command (see `backend/package.json`).
- Frontend specs: `frontend/tests/local-qa/jul24-qa-frontend-*.spec.ts` (Playwright, mocked endpoints).

## Known issues / NOT regressions
- 3 pre-existing backend tests fail (hard-code port 3001; no service there) — classified TEST-ENV, unrelated to these changes.
- W2 used a local-only `seed-contratos-tmp.ts` to reset the CONTRATOS test password to `<redacted>` for local login (staging reads `QA_CONTRATOS_PASSWORD` from SSM). Local dev fixture only; no stray file left in tree.

## Deferred (gated)
- **Staging deploy + migration run** — requires explicit go-ahead. Deploy-gate checklist in
  `orchestration-ctx/decisions/cargos-fk-reassignment.md`: verify staging contract→cargo distribution
  BEFORE running (all staging contracts collapse onto `Temporal` — developer accepted). Never touch prod without approval.
