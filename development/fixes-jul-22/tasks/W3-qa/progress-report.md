# W3 QA Progress Report

## Task 11 — in progress

### Backend verification — 2026-07-22

Command:

```bash
cd backend && npx playwright test tests/patients/patient-estado-rbac.spec.ts tests/instruments-dynamic/fixes-jul-22-templates.spec.ts tests/instruments-dynamic/fixes-jul-22-api.spec.ts tests/instruments-dynamic/scoring-engine.spec.ts tests/instruments-dynamic/seed-definitions.spec.ts --reporter=line
```

Result:

```text
Running 51 tests using 1 worker
51 passed (2.2s)
```

Classification: no failures to classify. This run verifies patient estado RBAC, active definition endpoints, template cloning, TINETTI max scoring, MNA 28-cell persistence, VALORACION informational scoring, scoring validation, and highest-version seed activation.

### Frontend verification — 2026-07-22

Command:

```bash
cd frontend && npx playwright test tests/fixes-jul-22 --reporter=line
```

Result:

```text
Running 10 tests using 1 worker
10 passed (15.3s)
```

Classification: no product failures. The two prior command failures were **TEST-ENV/operator invocation**, not test failures: the persisted shell CWD was already `backend`, so `cd frontend` did not exist; running without switching then selected backend Playwright config and found no frontend tests. Correcting to `cd ../frontend` produced the authoritative passing run above.

### Edge-depth verification — 2026-07-22

Added test-only assertions for two uncovered contract boundaries:

1. A disallowed plain EMPLEADO sending an `estado` equal to the current value still receives the exact `PATIENT_STATE_FORBIDDEN` envelope, and a companion `nombre` update is not persisted.
2. MNA text matrices reject unknown row and unknown column identifiers with `INVALID_ANSWER_PAYLOAD` at `respuestas.frecuencia_grupos`.

Command:

```bash
cd backend && npx playwright test tests/patients/patient-estado-rbac.spec.ts tests/instruments-dynamic/fixes-jul-22-templates.spec.ts --reporter=line
```

Result:

```text
Running 17 tests using 1 worker
17 passed (1.6s)
```

Classification: no failures. A first invocation from the frontend CWD selected the frontend Playwright config and reported no matching tests; classified **TEST-ENV/operator invocation** and corrected by returning to `backend`.

### Final combined verification — 2026-07-22

Command:

```bash
cd backend && npx playwright test tests/patients/patient-estado-rbac.spec.ts tests/instruments-dynamic/fixes-jul-22-templates.spec.ts tests/instruments-dynamic/fixes-jul-22-api.spec.ts tests/instruments-dynamic/scoring-engine.spec.ts tests/instruments-dynamic/seed-definitions.spec.ts --reporter=line && cd ../frontend && npx playwright test tests/fixes-jul-22 --reporter=line
```

Result:

```text
Running 52 tests using 1 worker
52 passed (2.1s)
Running 10 tests using 1 worker
10 passed (15.0s)
```

Final classification: 62 PASS, 0 BUG failures, 0 FLAKE. Coverage percentage NOT-VERIFIED because the Playwright configs do not include a source coverage instrumenter.
