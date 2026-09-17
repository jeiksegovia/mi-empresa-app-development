# Task Assignment — W6 `pt-test-quality` · Aug-17 centro-costos QA

**Task type**: QA (tests + gap report). **FORBIDDEN from modifying product source** (`backend/src/**`, `frontend/app/**`, prisma schema). You MAY add test files under `backend/tests/centro-costos/` and `frontend/tests/centro-costos/` and write the gap report.

**Your TaskList IDs**: `4` (T12 backend QA) then `5` (T13 FE + regression)  
**Your worker name**: `worker-6`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address orchestrator as `team-lead`, never `main`.**

---

## FIRST ACTION

```bash
pwd   # MUST be repo root. Else BLOCKED: spawned with cwd=<path> and STOP.
```
`TaskUpdate` task `4` → `in_progress`.

Then read **only**:
1. `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` — **SSOT (LIVE Wave 4 + D14 GET month guard)**
2. `development/feature-centro-costos-ago-5/01-requirements-aug17-feedback.md` — R18–R31
3. Existing specs (to extend, not weaken):  
   `backend/tests/centro-costos/centro-costos-smoke.spec.ts`  
   `frontend/tests/centro-costos/centro-costos-smoke.spec.ts`

**Do NOT open** services/routes/schema to decide expected behavior. If the contract is silent, write the gap as “contract missing X” — do not invent.

---

## Locked decisions you test against

- D10 `fecha` required; `periodo = first-of-month(fecha)` string math  
- D11 INGRESOS: pagador + beneficiarioClienteId required; `valorUnitario` copied from `centro.precioUnitario`; EGRESOS typed price  
- D12 seed: 8 INGRESOS names (no exact `Transporte`); EGRESOS orden 9–14  
- D13 `habilitarRecibo` + GET `/items/:itemId` recibo payload  
- D14 CONTRATOS: current Bogotá month ítems only; no balance; no centro mutations; GET `/items/:id` also month-locked  
- GERONTOLOGA: domain 403  
- ADMIN: full  
- AUDITOR/OPERADOR: inherited full (do not add restrictions)

---

## T12 — Backend suite (task 4)

Extend `backend/tests/centro-costos/` (new file ok, e.g. `centro-costos-aug17.spec.ts`). Cover at least:

| ID | Case |
|---|---|
| R18 | GET `/` INGRESOS = 8 D12 names, no `Transporte` |
| R21 | CONTRATOS POST/PUT/DELETE centro → 403 |
| R22 | CONTRATOS GET `/balance` → 403; GET `/items?periodo=` non-current → 403 `field=periodo` |
| R24 | POST `{fecha:"2026-08-17"}` → fecha kept, periodo `2026-08-01` |
| R25 | INGRESOS missing pagador / beneficiario → 400 with that `field` (use a **priced** centro; else you get `precioUnitario` first) |
| R26 | INGRESOS `valorUnitario:1` on priced centro → stored centro price |
| R27 | EGRESOS still accepts typed `valorUnitario`; pagador null |
| R28 | `medioPago` EFECTIVO\|TRANSFERENCIA round-trip |
| R31 | GET `/items/:id` 200 + `centro` + `beneficiario` |
| D14 GET | CONTRATOS GET historical item → 403 `field=fecha` (W8 already has this — keep it) |
| Matrix | GERONTOLOGA any route 403 `DOMAIN_FORBIDDEN`; FE/BE `useDomainAccess` vs `domainAccess.ts` cell-by-cell for `centro-costos` |

Run: `cd backend && TEST_API_URL=http://localhost:3101 npx playwright test tests/centro-costos --reporter=list`  
API is :3101. Restart only via `lsof -i :3101` PID — never `pkill`.

`TaskUpdate` 4 → completed when suite is green **or** you have a gap report with failing tests that prove a **source** bug (do not loosen assertions).

---

## T13 — Frontend + regression (task 5)

FE: `cd frontend && npx playwright test tests/centro-costos --reporter=list`  
Must stay 17+ green. Add cases only if a contract AC is untested (e.g. CONTRATOS can **submit** an ítem, not just see the button — if missing, add it **or** file as gap if the page cannot).

Regression (classify every failure BUG / TEST-ENV / FLAKE — zero unclassified):

```bash
cd backend && TEST_API_URL=http://localhost:3101 npx playwright test \
  tests/employees tests/nomina tests/asistencia tests/instruments-dynamic --reporter=list
# FE prior cycles if they exist:
cd frontend && npx playwright test tests/local-qa --reporter=list
```

`npx tsc --noEmit` in backend. Frontend: `npx vue-tsc --noEmit` — only fail the gate on **centro-costos** errors; pre-existing `DynamicSection.vue` is known.

---

## Gap report (required)

`development/feature-centro-costos-ago-5/tasks/W6-qa/gap-report.md`

For each gap: Expected (cite contract §) / Found / Repro (verbatim curl or spec name) / Severity.  
Empty file with “none” if truly clean.

Also `tasks/W6-qa/completion-report.md` with verbatim suite totals.

---

## Reporting

To `team-lead`: `COMPLETE:` per task, `BLOCKED:`, `TURNING-POINT-*`.  
MAX 2 self-repairs then STRATEGY.  
Do not “fix” product code. Do not weaken a failing assertion to go green.
