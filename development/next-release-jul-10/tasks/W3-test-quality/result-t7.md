# W3 T7 — Result (Wave 4 QA — jul10 release)

**Date:** 2026-07-10
**Worker:** W3 (pt-test-quality, REUSED from T4)
**Status:** COMPLETE — all 4 acceptance criteria MET

---

## TL;DR

Full jul-10 release validated against `schema-contract-jul10.md` + `team-plan-next-release-jul-10.md`. 7/7 new backend spec areas green (27 tests). T4 follow-up list closed: 24/24 jul4 specs green (up from 2/24 at T4 start). Uppercase fixture reconciliation completed across 7 backend specs + 1 frontend spec. Zero source-code modifications. Every regression failure classified.

| Suite / area | Result |
|---|---|
| Backend T7 NEW specs (C1, C4, C6 gating matrix, C6 users, C7, E1 uppercase, contrato-cargo extension) | **27/27 green** |
| Backend full regression | **232 passing / 2 skipped / 5 failing (all classified pre-existing)** |
| Frontend `local-qa/` regression | **59 passing / 8 failing (all classified legacy-spec origin-drift)** |
| Frontend `e2e/paciente-fichas` (T7 harness fix) | **5 passing / 2 skipped (pre-existing env-blocked skips)** |
| T4 closure: jul4 UI selectors (10) + cargoId (3) + B1 (4) + e2e harness (1) | **All closed** |
| NEW specs authored | 7 backend spec files (incl. 1 extension) |

---

## New spec files (T7)

| File | Tests | Coverage |
|---|---:|---|
| `backend/tests/patients/ficha-single-step.spec.ts` | 2 | C1 atomic COMPLETADO + legacy PENDIENTE round-trip |
| `backend/tests/patients/ficha-vencido-flip.spec.ts` | 1 | C4 lazy flip PENDIENTE→VENCIDO on read |
| `backend/tests/patients/fichas-vencimientos.spec.ts` | 5 | C7 shape + bounds + default + ordering |
| `backend/tests/instruments/gating.spec.ts` | 5 | C6 matrix (ADMIN/GERONTOLOGA/plain EMPLEADO/AUDITOR) |
| `backend/tests/users/tipo-empleado.spec.ts` | 4 | C6 pairing rule + PATCH clears on rol change |
| `backend/tests/uppercase-transform.spec.ts` | 5 | E1 transform on 5 entity models + descripcion preserved |
| `backend/tests/employees/contrato-cargo.spec.ts` (extension) | +1 | D7 tighten: POST without cargoId → 400 |

## Modified spec files (uppercase reconciliation + T4 closure)

- `backend/tests/patients/patient-notes.spec.ts` — fechaIncidente fixture on 3 payloads (B1)
- `backend/tests/employees/employees.spec.ts` — 2 uppercase assertions (create + update)
- `backend/tests/patients/patients.spec.ts` — 2 uppercase assertions (create + update)
- `backend/tests/instruments/instruments.spec.ts` — 3 uppercase assertions (create + GET + update)
- `frontend/tests/local-qa/jul4-p1-cert-recurrente.spec.ts` — uppercase cert name in alert assertion
- `frontend/tests/local-qa/jul4-p6-nomina.spec.ts` — cargoId fixture + Info. Laboral→Contrato laboral tab switch + "Sin cargo" sentinel skip
- `frontend/tests/e2e/paciente-fichas.spec.ts` — goToPacientes harness: click → direct goto (collapsed-sidebar viewport fix)

## T4 follow-up closures verified

- **jul4 selectors** (P1-2 uppercase, P2-2/3/4/5, P3-2, P4-3, P5-3, P6-5, P6-7): all fixed → **24/24 green**
- **cargoId fixtures** (P6-1, P6-3, P6-4): all fixed → green
- **patient-notes B1** (4 tests): fixed → **4/4 green**
- **e2e/paciente-fichas harness** (`goToPacientes`): fixed → **5 passing, 2 skipped (env-blocked pre-existing)**

## Regression details

See `qa-report.md` §4 for the full failure-classification matrix.

- Backend: 5 failures, all classified pre-existing per `qa-report-jul-9.md` §3.1 or env-blocked (staging smoke).
- Frontend `local-qa/`: 8 failures, all pre-existing legacy specs that hardcode `localhost:3101` (same origin-drift issue T4 resolved for jul4 only). Documented as GAP-1.

## Zero source-code diff (verified)

```
git diff --stat backend/src frontend/app backend/prisma  → shows ONLY pre-existing W1+W2 WIP (not from T7)
git status --porcelain | grep -E "tests/" → all files modified are test files + 3 task docs
```

## Standing status

IDLE. Task #31 complete.
