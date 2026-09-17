# task-assignment-qa (W4 — test + quality wave)

## Plan File
`development/improvements-jul-9/orchestration-ctx/team-plan-improvements-jul-9.md`
**API contract**: `orchestration-ctx/decisions/schema-contract-jul9.md` (authoritative spec — test against IT, not against the implementation)
**What was built**: `tasks/W1-backend/result.md` + `result-wave2.md`, `tasks/W2-frontend-a/result.md` + `result-wave2.md`, `tasks/W3-frontend-b/result.md`

## Task Type
IMPLEMENTATION (tests are code)

## Task IDs (in order)
- `21` — T13 backend spec suite
- `22` — T14 playwright specs
- `23` — T15 full regression + QA report

## Known issues to VERIFY and INCLUDE in report (pre-logged, do not fix source)
1. Invalid `cargoId` FK on contrato create → 500 instead of 400 (W1 known issue)
2. `EducacionEmpleado` not embedded on `GET /employees/:id` — separate fetch required (design note, verify documented behavior)

## CRITICAL test-env note (from W2's wave-2 finding)
Backend session cookie is `sameSite=strict`; `frontend/.env` points `NUXT_PUBLIC_API_BASE` at `http://100.85.193.33:3101`. Playwright MUST use matching hosts:
```
TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1 npx playwright test ...
```
The origin-aware helper `frontend/tests/helpers/auth.ts` handles this — read it first.

## T13 (#21) — Backend specs (`backend/tests/`, follow existing per-area patterns)
1. `patients/nota-fecha-incidente.spec.ts` — valid today/yesterday-weekday → 201; >2 business days → 400 field=fechaIncidente; future → 400; missing → 400. Use DETERMINISTIC date math (compute dates relative to run-day weekday, document the logic).
2. `patients/cliente-new-fields.spec.ts` — POST/PUT with fechaCumpleanos + tipoSangre + eps round-trip; invalid tipoSangre value → 400.
3. `employees/educacion-crud.spec.ts` — full CRUD; cleanup after.
4. `empresa/cargos-crud.spec.ts` — list (seeded), create, duplicate → 409 with field=nombre, archive via PATCH activo=false, archived excluded from ?activo=true.
5. `employees/contrato-cargo.spec.ts` — create contrato with cargoId + archivoFirmadoUrl → 201; legacy `cargo: string` → 400 field=cargoId; **invalid cargoId FK → document actual status (expected: currently 500 — assert current behavior + mark TODO)**.
6. `certificates/update-comprobante.spec.ts` — comprobantePagoUrl round-trip on POST/GET /updates.

## T14 (#22) — Playwright specs (`frontend/tests/local-qa/jul9-*.spec.ts`, follow jul8-* pattern + auth helper)
1. `jul9-cert-crear-simplified.spec.ts` — create form shows ONLY 4 metadata fields (assert absence of removed date/file inputs) + first-update card with 2 dropzones (archivo + comprobante).
2. `jul9-cert-update-comprobante.spec.ts` — Agregar dialog: upload comprobante, submit, historial shows comprobante download button.
3. `jul9-empresa-save.spec.ts` — regression for A6: edit empresa field, save, reload, assert persisted.
4. `jul9-pacientes-new-fields.spec.ts` — create paciente with cumpleaños/sangre/eps → detail displays all 3.
5. `jul9-nota-fecha-incidente.spec.ts` — note with old date → inline error visible; valid date → note appears in list with fecha column.
6. `jul9-empleado-educacion.spec.ts` — add educación row with diploma; assert row renders.
7. `jul9-contrato-cargo.spec.ts` — Contrato laboral tab exists; cargo Select populated; "agregar otro" flow creates + selects.
8. `jul9-cargos-manager.spec.ts` — empresa config: list, add, duplicate error, archive.

## T15 (#23) — Regression + report
1. Run backend suites (jul9 new + existing areas touched: certificates, patients, employees, empresa, nomina)
2. Run frontend `local-qa` (jul4 + jul8 + jul9) with the env vars above
3. Write `development/improvements-jul-9/tasks/W4-test-quality/qa-report.md`:
   - Pass/fail/skip matrix per spec
   - Requirements coverage vs `context/user-feedback/improvements-jul-9-insights.md` Sprint 1+2 items (MET/PARTIAL/MISSING per item A1-A6, B1-B6, D1-D8)
   - Gap list with severity (include the 2 pre-logged known issues + anything new)
   - Code-pattern conformance notes

## Constraints
- **Do NOT modify source code** to make tests pass — a failing test caused by a real bug goes in the gap report
- Do NOT restart backend/frontend (running on :3101/:3100)
- Clean up all test data your specs create (throwaway entities, delete in finally blocks)
- Do NOT git-commit
- If a spec is blocked by environment (not by a bug), mark it skip with a documented reason — jul-8 precedent

## Deliverables
1. Backend spec files (6) + playwright spec files (8)
2. `qa-report.md` (path above)
3. `result.md` + `completion-report.md` in your task folder

## Acceptance Criteria
1. ≥ 11 of the 14 specs written AND passing (env-blocked skips documented)
2. QA report covers all 17 sprint items with evidence (file:line or spec name)
3. Every failure classified: BUG (source) / TEST-ENV / FLAKE
4. Existing jul4/jul8 suites show no NEW regressions (pre-existing skips OK)

## Reporting Protocol
1. On start: `TaskUpdate(taskId: "21", status: "in_progress")`
2. Per task done: TaskUpdate + claim next
3. Errors: MAX 2 self-repair → TURNING-POINT-STRATEGY + WAIT. Blocked → BLOCKED + WAIT.
4. All done: `SendMessage(to: "main", "COMPLETE: QA wave done. {pass/fail/skip counts}. Gaps: {N critical, M high}. See tasks/W4-test-quality/qa-report.md", summary: "QA complete")`

## Tools
Read, Edit, Write, Bash (playwright, curl). `TaskUpdate`/`SendMessage` native.
