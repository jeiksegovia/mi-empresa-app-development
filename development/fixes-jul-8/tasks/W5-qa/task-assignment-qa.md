# task-assignment-qa — deep audit + write missing tests

## Plan File
`development/fixes-jul-8/orchestration-ctx/team-plan-fixes-jul-8.md`

## Task Type
IMPLEMENTATION (tests are code)

## Your Task
1. **Audit** every requirement in `context/plans/initial-prompt-fixes-jul-8.md` against the code delivered by W2/W3/W4. Report gaps.
2. **Write missing Playwright specs** for the new functionality — per project CLAUDE.md: *"NEVER skip writing tests after each task completion or implementation"*. W2/W3/W4 skipped this.
3. **Verify code-pattern conformance** — check that new code follows existing conventions (service→route pattern, Zod-at-top-of-route-file, PrimeVue components + auto-import, useApi/useFileUpload composables, page structure).

## Task ID
Your task ID is `5`. Call `TaskUpdate(taskId: "5", status: "in_progress")` on start.

## Implementation Location
- New backend test specs: `/Users/jeik/ws/mi-empresa-app-development/backend/tests/{certificates|instruments|patients|nomina}/*.spec.ts` (follow existing pattern in these subdirs)
- New frontend test specs: `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/local-qa/jul8-*.spec.ts` (follow existing `jul4-*.spec.ts` naming pattern)
- QA report: `development/fixes-jul-8/tasks/W5-qa/qa-report.md`

## Source Files to Read (verification)
Requirements source:
- `context/plans/initial-prompt-fixes-jul-8.md` — original requirements
- `development/fixes-jul-8/02-research-fixes-jul-8.md` — W1 baseline
- `development/fixes-jul-8/orchestration-ctx/decisions/scope-decisions.md` — D1–D7
- `development/fixes-jul-8/orchestration-ctx/decisions/schema-contract.md` — API contract
- `development/fixes-jul-8/06-handoff.md` — final handoff

Delivered code to audit:
- backend/prisma/schema.prisma (CertificadoUpdate model)
- backend/src/services/certificateService.ts
- backend/src/routes/certificates.routes.ts
- backend/src/routes/instruments.routes.ts
- backend/src/routes/patients.routes.ts
- backend/src/services/nominaService.ts
- backend/src/routes/nomina.routes.ts
- frontend/app/composables/useApi.ts
- frontend/app/plugins/session-expired.client.ts
- frontend/app/pages/pacientes/[id]/index.vue
- frontend/app/pages/nomina/index.vue
- frontend/app/pages/certificados/[id].vue
- frontend/app/pages/certificados/crear.vue
- frontend/app/pages/instrumentos/crear.vue
- frontend/app/pages/instrumentos/[id]/editar.vue (new)
- frontend/app/pages/instrumentos/[id]/index.vue

Existing test patterns to follow:
- `backend/tests/certificates/` — bash or ts specs
- `frontend/tests/local-qa/jul4-*.spec.ts` — playwright pattern used throughout the jul-4 fixes
- `frontend/tests/README.md` — testing conventions

## Worker Self-Check
- Task Type is IMPLEMENTATION and Source Files (test files) list is non-empty ✓
- Plan File exists ✓
- NOT asked to "create a plan" ✓

## Recommended Approach

### Phase 1 — Audit (do first, before writing tests)
1. Read the original requirements plan
2. For each of the 5 domains, verify the delivered code matches. Specifically:
   - **Certificados**:
     - Does `certificados/[id].vue` show update history? (verify UI + fetch call)
     - Does "Agregar" dialog exist and POST to `/updates`?
     - **Ambiguity flag**: user's plan says *"edit button could edit the actual certificado description and date"* — but W4's editForm has no `fechaEmision`/`fechaVencimiento` (per D2 dates are history-managed). Note this in gap report — do NOT auto-fix; escalate to orchestrator.
     - Does `crear.vue` support optional first update in one flow?
   - **Instrumentos**:
     - Is roles a MultiSelect in crear.vue (not free-text)?
     - Is `plantillaArchivo` upload wired in crear + editar?
     - Does backend Zod truly reject unknown roles? Test with a bogus role like `"SUPERHEROE"`.
     - Does `[id]/editar.vue` exist and correctly PUT?
   - **Paciente fichas** (D + Considerations):
     - Bug 1: does the historial table render `instrumentoNombre`? Test with a real patient.
     - Bug 2: does `handleFichaSubmit` send `notasObservaciones` + `fechaVencimiento` to backend? Test PATCH payload.
     - Bug 3: is pencil enabled when data.estado === 'VENCIDO'? Test VENCIDO → COMPLETADO flow.
     - Session persistence: does `sessionStorage.getItem('ficha-form-draft-<patientId>-<fichaId>')` restore fichaForm after dialog re-open? Test via page.evaluate and dialog reopen.
   - **Nomina**:
     - Is the default filter "only-with-contract" (matches user's requirement)?
     - Does the filter UI include contract-type + "sin contrato" option?
     - Does OPS empleado without cuenta-de-cobro get a CLEAR inline error (not just a toast)?
   - **Considerations**:
     - SPA reload: only fichas got sessionStorage persistence. Nomina, cert crear/edit, instrumento crear/edit have file uploads too — is that a gap? Flag but don't fix.

### Phase 2 — Write missing tests
Write these specs (bash for backend infra where suitable, playwright for browser flows):

**Backend (`backend/tests/`)** — use existing patterns:
1. `certificates/updates.spec.ts` — POST + GET /certificates/:id/updates: happy path, empty-body 400, non-existent id 404
2. `instruments/roles-refinement.spec.ts` — POST /instruments with invalid role → 400 with `errors.rolesPermitidos`
3. `patients/ficha-transitions.spec.ts` — PATCH with `VENCIDO → COMPLETADO` succeeds; missing `archivoCompletado` when going to COMPLETADO → 400
4. `nomina/cuenta-cobro-required.spec.ts` — POST /nomina/periodos for OPS empleado without cuenta_cobro → 400 with `field: 'archivos.CUENTA_COBRO'`
5. `nomina/tipo-contrato-filter.spec.ts` — GET /nomina?tipoContrato=OPS returns only OPS; `NONE` returns contract-less

**Frontend (`frontend/tests/local-qa/`)** — follow `jul4-*.spec.ts` pattern (login → real browser flow → assertions):
6. `jul8-cert-updates.spec.ts` — open cert detail, click Agregar, upload+notas, submit; assert S3 PUT + POST /updates 201; verify history list refreshes
7. `jul8-cert-crear-with-update.spec.ts` — create cert with first-update fields; verify both POST calls fire and route lands on /certificados/{newId}
8. `jul8-instrumentos-multiselect.spec.ts` — crear.vue: MultiSelect picks 2 roles, submit; verify wire body is `"ADMIN,EMPLEADO"`
9. `jul8-instrumentos-editar.spec.ts` — navigate to /instrumentos/{id}/editar, change roles, replace plantilla, submit; verify PUT with joined string
10. `jul8-fichas-vencido-to-completado.spec.ts` — find a VENCIDO ficha (or create one), pencil is enabled, open modal, upload file, set COMPLETADO, save; assert PATCH 200
11. `jul8-fichas-persistence.spec.ts` — open ficha dialog, type notas, close dialog without saving, reopen — notas restored from sessionStorage
12. `jul8-nomina-filter.spec.ts` — MultiSelect includes SIN_CONTRATO option; changing filter triggers GET /nomina with correct tipoContrato param
13. `jul8-nomina-cuenta-cobro-error.spec.ts` — register nomina for OPS empleado without cuenta_cobro, assert inline `<Message>` appears

Use QA credentials from SSM (same pattern as `staging-login.spec.ts` but for local) or `admin@miempresa.com` / `<redacted>` on local (DEV_USERS_ENABLED).

### Phase 3 — Run and iterate
Run each spec, fix flaky selectors, but do NOT modify source code to make tests pass. If a spec fails because of a real bug in the delivered code, ADD to gap report.

## Deliverables
1. **QA report**: `development/fixes-jul-8/tasks/W5-qa/qa-report.md`
   - One section per requirement domain
   - For each requirement: "MET" / "PARTIAL" / "MISSING" + evidence (file:line or test name)
   - Explicit list of gaps requiring re-plan
   - Explicit list of code-pattern concerns (be strict but fair — cite the existing pattern being violated)
2. **All new spec files** written to disk (paths listed above)
3. `development/fixes-jul-8/tasks/W5-qa/result.md` — summary + pass/fail count
4. `development/fixes-jul-8/tasks/W5-qa/completion-report.md` — handoff

## Progress Reporting
`development/fixes-jul-8/tasks/W5-qa/progress-report.md`

## Acceptance Criteria
1. QA report covers all 5 requirement domains with evidence
2. At least 8 of the 13 specs above are written and pass locally (remaining can be documented if a real bug blocks them — flag as gap)
3. Code-pattern conformance section identifies any real deviations from existing convention (or explicit "no deviations found")
4. Gaps are prioritized (CRITICAL / HIGH / MED / LOW)

## Constraints
- Do NOT modify source code to make tests pass — write tests that document actual behavior; log bugs in gap report
- Local backend running :3101 (do not restart)
- Local frontend running :3100 (do not restart)
- Follow existing test patterns exactly — do NOT introduce a new framework
- Do NOT git-commit
- Backend tests should use existing auth pattern (curl-based login → cookie); frontend playwright uses admin creds

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "5", status: "in_progress")`
2. **During work**: append sections to `progress-report.md` (Phase 1 audit / Phase 2 tests / Phase 3 iteration)
3. **On error**: MAX 2 self-repair attempts, then `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: ...", summary: "Strategy escalation")`
4. **If blocked** (e.g., missing test credentials): `SendMessage(to: "main", message: "BLOCKED: ...", summary: "Blocked")` then WAIT
5. **On completion**:
   - Write qa-report.md + result.md + completion-report.md
   - `TaskUpdate(taskId: "5", status: "completed")`
   - `SendMessage(to: "main", message: "COMPLETE: QA audit + tests done. See tasks/W5-qa/qa-report.md — gap count: N critical, M high", summary: "QA complete")`

## Tools Available
Read, Edit, Write, Bash (playwright/npm/curl). `TaskUpdate` and `SendMessage` are native.
