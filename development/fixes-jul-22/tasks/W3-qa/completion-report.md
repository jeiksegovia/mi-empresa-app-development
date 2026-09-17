# W3 QA Completion Report — fixes-jul-22

## Summary

- Authoritative final result: **62 passing, 0 failing**.
- Backend: **52 passing** in 2.1s.
- Frontend: **10 passing** in 15.0s.
- Coverage percentage: **NOT-VERIFIED** — Playwright is not configured with a source coverage instrumenter. Contract-level behavioral coverage is evidenced below.
- Production source edits by W3: **none**. W3 changed tests and QA reports only.

## Acceptance evidence

### Backend matrix

Command:

```bash
cd backend && npx playwright test tests/patients/patient-estado-rbac.spec.ts tests/instruments-dynamic/fixes-jul-22-templates.spec.ts tests/instruments-dynamic/fixes-jul-22-api.spec.ts tests/instruments-dynamic/scoring-engine.spec.ts tests/instruments-dynamic/seed-definitions.spec.ts --reporter=line
```

Verbatim result:

```text
Running 52 tests using 1 worker
52 passed (2.1s)
```

Proves:

- CONTRATOS create forces ACTIVO and PUT is domain-forbidden.
- Plain EMPLEADO exact `PATIENT_STATE_FORBIDDEN`, including same-value estado and no partial write.
- GERONTOLOGA and ADMIN estado updates.
- TINETTI v2 inventory, merged option scoring, and maximum 27 path.
- MNA v2 exact 28-cell acceptance/persistence and malformed-coordinate rejection.
- VALORACION_INTEGRAL definition load, template copy, required payload completion, and null scoring.
- Highest-version seed activation plus related scoring regressions.

### Frontend matrix

Command:

```bash
cd frontend && npx playwright test tests/fixes-jul-22 --reporter=line
```

Verbatim result:

```text
Running 10 tests using 1 worker
10 passed (15.0s)
```

Proves:

- Create estado visibility for all tested roles and hiding for CONTRATOS.
- Edit estado visible only for ADMIN/GERONTOLOGA and hidden for CONTRATOS/AUDITOR/OPERADOR.
- MNA text matrix renders 28 inputs and preserves per-cell values.
- Unsaved guard behavior for pristine, dirty implicit navigation, confirmation, and mark-clean bypass.

## Test changes

- `backend/tests/patients/patient-estado-rbac.spec.ts`: strengthened forbidden update to exact contract envelope, same-value boundary, and atomic no-write assertion.
- `backend/tests/instruments-dynamic/fixes-jul-22-templates.spec.ts`: added unknown row/column coordinate rejection coverage.

## Failure classification

All encountered failures are classified:

| Class | Count | Detail |
|---|---:|---|
| BUG | 0 | No product test failures. |
| TEST-ENV | 3 | Incorrect persisted CWD/config selection during command invocation; corrected commands passed. |
| FLAKE | 0 | No observed intermittent failures. |

## Gap report

See `development/fixes-jul-22/tasks/W3-qa/gap-report.md`.
