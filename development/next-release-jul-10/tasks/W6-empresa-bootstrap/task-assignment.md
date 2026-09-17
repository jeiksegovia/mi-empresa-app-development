# task-assignment — empresa bootstrap from empty DB (W6)

## Task Type
IMPLEMENTATION (backend + frontend + tests + staging verification)

## Task ID
`33`. `TaskUpdate(taskId: "33", status: "in_progress")` on start.

## Bug report (developer QA on staging, jul-10 post-release)
"There is still issues updating the empresa information — when information is loading there is still an error." Requirement (verbatim intent): **from an empty DB with a single admin user, the admin must be able to create and save the base empresa data-structure.**

## Orchestrator's confirmed diagnosis (verify, then build on it)
1. `backend/src/routes/empresa.routes.ts` exposes only `GET /` (line ~103) and `PUT /:id` (line ~118) — **no create path**. On an empty DB the empresa row can never exist.
2. `frontend/app/pages/empresa/editar.vue:127` reads `empresaId` from `authStore.empresa.id`; with 0 empresas this is null → the jul-9 defensive fix surfaces an error (better than silence) but there is **no create mode**.
3. Staging has **0 empresas** (R0 risk gate, `staging-release-jul10-runbook.md`) — this is exactly the developer's environment. Additionally the `jul9_cargo_empresa` seed was a no-op there (CROSS JOIN × 0 empresas), so `cargos_empresa` is empty: **empresa creation must also seed the default cargos** or the contrato flow stays broken after the fix.
4. Also check `frontend/app/stores/auth.ts` `fetchEmpresa()` — what happens when GET /empresa finds no row (404? data:null? throw?). The load-time error the developer sees may originate here or in `empresa/index.vue`. Diagnose precisely with step-by-step evidence in progress-report.md BEFORE fixing.

## Scope

### 1. Backend — create path
- Add `POST /api/v1/empresa` (ADMIN): creates the empresa when none exists; if one already exists → 409 `{ success:false, message:'La empresa ya existe', field:'empresa' }` (single-empresa system — enforce).
- Zod: reuse/extend `updateEmpresaSchema` field set with required minimum (nombre at least; check the Prisma `Empresa` model for required columns — nit, etc.). E1 uppercase transform on nombre (consistent with jul-10).
- **On create, seed the default cargos** for the new empresa: same 8 values as the `jul9_cargo_empresa` migration (`Fisioterapeuta, Terapeuta Ocupacional, Educador Físico, Manualidades, Auxiliar de Enfermería, Auxiliar de Servicios Generales, Otro` — VERIFY the exact list from the migration SQL, it is the source of truth) with `ON CONFLICT DO NOTHING` semantics (createMany skipDuplicates).
- `GET /empresa` with no row: return `200 { success:true, data:null }` (explicit, frontend-friendly) — verify current behavior first and normalize if it throws/404s.

### 2. Frontend — create mode
- `empresa/editar.vue` (and `empresa/index.vue` if it errors on load): when no empresa exists (`authStore.empresa == null` after fetch, or `GET /empresa → data:null`), render the SAME form in "Crear empresa" mode → submit via POST → on success refresh auth store + navigate per existing pattern.
- Loading must not error on empty state — show the create form, not a toast-error.
- `auth.ts fetchEmpresa()`: tolerate the empty case without throwing (align with the normalized GET contract).

### 3. Tests (regression — the user's explicit ask)
- Backend spec `backend/tests/empresa/empresa-bootstrap.spec.ts`: simulate empty setup — if a row exists locally, the spec must NOT delete real data; instead test the guard paths that are testable non-destructively: (a) POST when empresa exists → 409; (b) GET contract shape; (c) IF the dev DB allows, full create-from-empty via a transaction-safe approach — otherwise document why and cover create via the staging run (§4). Be explicit about what is covered where.
- Playwright `frontend/tests/local-qa/jul10-empresa-bootstrap.spec.ts`: empty-state UI renders create mode without console errors (mock/route-intercept `GET /empresa → data:null` via `page.route` if the local DB has an empresa — interception is the clean way to simulate empty on a non-empty DB).

### 4. Staging verification (follow the staging QA pattern)
- Read `context/implementation-plan/staging-release-jul10-runbook.md` §R5 + `frontend/tests/staging/*.spec.ts` + `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md` (ssh/SSM command reference).
- Staging is the REAL empty-empresa environment. After local fix is verified:
  a. Deploy is NOT yours to run — STOP after local work and report. The orchestrator decides whether this ships as a hotfix deploy (likely CodeDeploy backend + Amplify frontend re-run per runbook R3/R4 pattern) — include in your completion report the exact artifacts/commands the deploy would need.
  b. What you CAN do against staging read-only: curl the current broken behavior to capture BEFORE evidence (GET /empresa as staging admin → document exact response; SSM QA creds per staging pattern).

## Constraints
- Local backend :3101 / frontend :3100 — do NOT restart; dev DB has 1 empresa (id 6) — do NOT delete it
- NO staging mutation (read-only staging curls allowed for evidence)
- Follow patterns: service→route, Zod-at-top, structured errors with field, PrimeVue, auth helpers in tests
- Do NOT git-commit
- Step-by-step diagnosis FIRST (documented in progress-report.md §Diagnosis with evidence per step), then fix

## Deliverables
1. Backend + frontend source changes
2. 2 new spec files (green locally)
3. BEFORE evidence from staging (read-only)
4. `tasks/W6-empresa-bootstrap/{result.md,completion-report.md,progress-report.md}` — completion report must include the exact deploy steps for the orchestrator's hotfix decision

## Acceptance Criteria
1. Diagnosis section proves the exact failing call chain (evidence, not hypothesis)
2. Local: with `page.route`-simulated empty state, admin sees create form, saves, no console errors
3. Local curl: POST /empresa on existing → 409; GET normalized contract
4. Cargo seed on create verified (createMany result or count)
5. Both specs green; existing suites not regressed (spot-run empresa + jul9-empresa-save specs)
6. Staging BEFORE evidence captured

## Reporting
Standard protocol. On done: `SendMessage(to: "main", "COMPLETE: Empresa bootstrap fixed + tested locally. Staging BEFORE evidence captured. Hotfix deploy steps in completion-report. See tasks/W6-empresa-bootstrap/result.md", summary: "W6 complete")`.
