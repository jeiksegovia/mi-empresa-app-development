# task-assignment-rbac-seed-backend

## Your Role
You are **backend-eng**. Express + Prisma v6 (client at `backend/src/generated`), Zod-at-top-of-routes,
`validate()` middleware, service→route, errors `{success:false,message,field/code}`, Spanish messages.

## Project Context
Task slug: fixes-jul17-2. Working directory: development/fixes-jul17-2/. Worker 9 (fresh).
Local: backend :3101 (tsx watch auto-reload), dev DB localhost:15432 docker (`miempresa_dev`).
The dynamic-fichas feature is complete and on staging; this cycle adds RBAC + QA seeding + crear-from-template.

## Task Type
IMPLEMENTATION — Your task IDs: **#31 → #32 → #33**

## THE CONTRACT (authoritative)
`development/fixes-jul17-2/orchestration-ctx/decisions/contract-fixes-jul17-2.md` — §1 RBAC (matrix,
requireDomain semantics, session field), §2 QA seeding + docs, §3.1 crear-from-template API, §5
clean-DB directive. Base contract for instrument shapes:
`development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`.
Deviations → contract addendum §Deviations W9 (non-breaking) or TURNING-POINT (breaking).

### Task #31 — RBAC backend
1. Prisma: `TipoEmpleado` + `CONTRATOS` (ADDITIVE). Migration via `npx prisma migrate dev --name
   jul17_tipo_empleado_contratos`. Developer authorized a LOCAL dev-DB reset if needed — prefer
   plain migrate dev (additive enum needs no reset); if you do reset, `npx prisma migrate reset`
   on localhost:15432 ONLY. Before the migration: write a short "G-A note" in progress-report.md
   (migration SQL + why additive-safe), then proceed (no stop needed).
2. `backend/src/middleware/domainAccess.ts` per contract §1.2/§1.3 EXACTLY (exported Domain type,
   DOMAIN_ACCESS map, requireDomain). 'create-only' = GET+POST allowed, PUT/PATCH/DELETE 403.
3. Apply `requireDomain` on the route surfaces per the domain mapping (§1.2 table, incl. the
   fichas-subroutes nuance: `/patients/*/fichas*` + vencimientos + `/instruments/records*` are
   domain 'fichas'; `/patients/*/notas*` is 'notas'; base pacientes CRUD is 'pacientes').
   AUDITOR/OPERADOR paths keep EXISTING behavior untouched.
4. Session (§1.4): verify login response + /auth/me include `tipoEmpleado`; add the field where
   missing (additive).
5. Smoke spec `backend/tests/rbac/domain-access.spec.ts`: for a GERONTOLOGA and a CONTRATOS user
   (create them in beforeAll via prisma or the users API): one allowed + one denied route per
   profile + method-level create-only check (POST paciente 201, PUT paciente 403 for CONTRATOS)
   + tipoEmpleado-null EMPLEADO unaffected (spot: GET /nomina 200).

### Task #32 — seed-qa 3 users + SSM + creds + docs (contract §2)
1. `backend/prisma/test-db/seed-qa.ts`: three idempotent upserts (qa-admin ADMIN, qa-gerontologa
   EMPLEADO+GERONTOLOGA, qa-contratos EMPLEADO+CONTRATOS) from env pairs
   `QA_ADMIN_EMAIL/PASSWORD, QA_GERONTOLOGA_*, QA_CONTRATOS_*`; never touches other rows.
2. `seed-qa-staging.sh`: ensure the 3 SSM pairs `/miempresa/staging/qa/{qa-admin,qa-gerontologa,qa-contratos}/{EMAIL,PASSWORD}`
   (SecureString, generated first-run) + keep legacy `/qa/QA_USER_*` as qa-admin alias; export the
   env pairs; run seed-qa.ts through the tunnel. DO NOT RUN it against staging in this task —
   implementation + local validation only (staging execution is task #38). Local validation: run
   seed-qa.ts against the local dev DB with dummy env values; verify 3 users; verbatim output.
3. `get-qa-creds.sh`: prints all three profiles (stage, URL, email, password each) + existing warning.
4. Docs (R6): reset-staging-db.sh final UNMISSABLE reminder block ("REQUIRED NEXT STEP:
   seed-qa-staging.sh — QA users are NOT part of db:seed"); append OP-7 to
   `context/implementation-plan/staging-release-jul17-runbook.md` §Operator notes; create
   `context/implementation-plan/staging-deploy-checklist.md` (short reusable checklist per contract §2.2).

### Task #33 — Crear-from-template backend (contract §3.1)
1. Zod: `createInstrumentSchema` + optional `templateCodigo` (enum of the 6).
2. `instrumentService.createInstrument`: when templateCodigo present → transaction: resolve template
   + active version (404 TEMPLATE_NOT_FOUND / NO_ACTIVE_VERSION), deep-copy definition, rewrite
   codigo/nombre/version=1, create Instrumento + InstrumentoVersion activo:true. Source template
   rows NEVER mutated. Response adds `activeVersion`.
3. Smoke spec `backend/tests/instruments-dynamic/create-from-template.spec.ts`: create from BARTHEL
   → new instrument has active v1 with 10 items + rewritten codigo/nombre; POST a ficha against the
   NEW instrument → scored correctly (total=100 path); source BARTHEL v1 definition byte-identical
   pre/post (checksum); templateCodigo absent → legacy metadata-only creation still works;
   TEMPLATE_NOT_FOUND 404.

## Pre-loaded traps
- NEVER `prisma migrate diff --shadow-database-url`. Never touch port 4142; no blanket pkill.
- Prisma client at `src/generated` — regenerate after migration.
- W10 works `frontend/**` in parallel from the same contract — your response shapes and the
  DOMAIN_ACCESS matrix cells are FROZEN once #31 completes; changes need orchestrator.
- SSM: your script edits perform puts only when EXECUTED; do not execute against staging this cycle.
- Existing tests: RBAC guards may 403 old specs that log in as EMPLEADO? No — seeded dev users have
  tipoEmpleado null → unaffected. If any existing suite fails, classify (BUG/TEST-ENV/FLAKE), fix
  ONLY if your change caused it.

## Worker Self-Check
- Contract addendum exists with §1.2 matrix → else BLOCKED
- `backend/prisma/test-db/seed-qa.ts` exists → else BLOCKED
- TaskList shows #31, #32, #33 assigned to you → else BLOCKED

## Acceptance Criteria
1. Migration applied locally; `TipoEmpleado` has CONTRATOS; existing suites unaffected (evidence run).
2. domain-access.spec.ts green (matrix + method-level + null-regression cases).
3. Local seed-qa run creates/updates 3 users idempotently (run twice, verbatim).
4. get-qa-creds.sh output shows 3 profiles (dry local run acceptable with --stage staging read of SSM? — do NOT create params; if params absent, mock/skip with note).
5. create-from-template.spec.ts green incl. source-immutability checksum.
6. Docs: checklist file exists; runbook OP-7 present; reset script reminder present (grep evidence).

## Deliverables
1. Migration + schema change; `backend/src/middleware/domainAccess.ts`; route applications; session field
2. Updated `seed-qa.ts`, `seed-qa-staging.sh`, `get-qa-creds.sh`, `reset-staging-db.sh` (reminder only)
3. `context/implementation-plan/staging-deploy-checklist.md` + runbook OP-7 append
4. Service/route changes + `backend/tests/rbac/domain-access.spec.ts` + `backend/tests/instruments-dynamic/create-from-template.spec.ts`
5. `development/fixes-jul17-2/tasks/W9-rbac-seed-backend/{progress-report.md, completion-report.md}`

## Boundaries
Write ONLY the deliverable paths + your task dir. NOT `frontend/**` (W10). NOT the base dynamic-fichas
contract. Runbook: append-only (OP-7), do not edit prior sections.

## Reporting Protocol (follow exactly)
1. Start: `TaskUpdate(taskId: "31", status: "in_progress")`; per-task complete → TaskUpdate + proceed in the SAME turn.
2. Errors: MAX 2 distinct fix attempts → `## Strategy Request` + `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: …", summary: "Strategy escalation")` + WAIT.
3. All done: completion-report.md → `SendMessage(to: "main", message: "COMPLETE: W9-rbac-seed-backend done. …", summary: "W9 complete")`.
4. Blocked: `SendMessage(to: "main", message: "BLOCKED: …", summary: "W9 blocked")` + WAIT. If a shell permission prompt hangs a command, BLOCKED immediately with the exact command — never sit silent.
5. Every turn ends with COMPLETE / BLOCKED / WAITING / TURNING-POINT-*. Never TaskCreate. After final COMPLETE, end turns silently.
Team tools (`TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage`) are native tools — call directly; ToolSearch does not exist in your session.
