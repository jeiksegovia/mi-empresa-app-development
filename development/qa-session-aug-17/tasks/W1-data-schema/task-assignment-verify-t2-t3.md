# task-assignment-verify-t2-t3

## Your Role
You are **pt-data-schema** named **worker-1-2**. You replace defective worker-1.
You VERIFY T2/T3 already on disk. You do **not** invent product work. You do **not** re-migrate.

## planify-team protocol (mandatory — read before any tool)

You are a **planify-team worker**, not a solo agent.

1. **Orchestrator is `team-lead`**. Every status goes `SendMessage(to: "team-lead", message: "<plain string>")`. Never `"main"`. Never JSON `{type: plan_approval_*}`.
2. **You cannot approve plans.** `plan_approval_response` / `plan_approval_request` is LEAD-ONLY. If a SendMessage is rejected with “Only the team lead can approve”, do **not** retry. Write progress-report and WAITING.
3. **Never TaskCreate.** Orchestrator owns the task list.
4. **Never git commit.** Never prod AWS. Never `migrate diff --shadow-database-url`.
5. **Do not improvise scope.** Contract + this assignment only.
6. **Durability:** write `progress-report.md` after EACH step. A silent worker is a failure.
7. **Idle declaration required** before every turn ends: `COMPLETE:` | `BLOCKED:` | `WAITING:` | `TURNING-POINT-BREAKING:` | `TURNING-POINT-STRATEGY:` — all as **plain text** to team-lead.
8. **Cwd:** must be `/Users/jeik/ws/mi-empresa-app-development`. Else `BLOCKED: spawned with cwd=...` and STOP.

## Project Context
Slug: qa-session-aug-17
You verify only. T1–T3 already completed in the ledger.

## Task Type
ANALYSIS / VERIFICATION

## FIRST ACTION
0. `pwd` — must be project root.
1. Append to `development/qa-session-aug-17/tasks/W1-data-schema/progress-report.md` that worker-1-2 started verify.
2. Read contract: `development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md` §3, §4, §7, §8.

## What to verify
1. `schema.prisma`: `NominaPeriodo.bonos` Decimal(12,2) NULL; `RegistroActividad` exact + `@@unique([empleadoId, fecha])` + @@map `registro_actividades`.
2. Migration `backend/prisma/migrations/20260818113726_add_nomina_bonos_and_registro_actividades/migration.sql` matches contract §8. No shadow URL.
3. `cd backend && npx prisma migrate status` → up to date. Record verbatim in verify-report.
4. `seed.ts` has `profesor@miempresa.com` / `auxiliar@miempresa.com` / `password123` with empleadoId. Confirm users in local DB via SELECT (do **not** `prisma db seed` — wipes).
5. Delete leftover `backend/scripts/_tmp-seed-profesor-auxiliar.ts` if present. Do not add new tmp scripts.

## Forbidden
- Rewriting migration / re-deploy migrate if already up to date
- Routes, vue, domainAccess
- plan_approval_* JSON
- SendMessage to anyone except team-lead

## Deliverables
- `development/qa-session-aug-17/tasks/W1-data-schema/verify-report.md`

If MATCH: `SendMessage(to: "team-lead", message: "COMPLETE: worker-1-2 verify T2/T3. Result: MATCH. See tasks/W1-data-schema/verify-report.md")`
If mismatch: STOP + `TURNING-POINT-BREAKING: T2/T3 mismatch. See verify-report.md` — do not fix without PROCEED.
