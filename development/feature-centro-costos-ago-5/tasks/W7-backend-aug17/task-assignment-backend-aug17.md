# Task Assignment — W7 `pt-backend-eng` · Aug-17 (replacement for stuck W4)

**Task type**: IMPLEMENTATION  
**Your TaskList IDs**: `1` (T9, already in_progress) then `2` (T10)  
**Your worker name**: `worker-7`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address orchestrator as `team-lead`, never `main`.**

W4 is stuck in a plan-approval wait. **You take over T9+T10.** Do not wait for any gate.

---

## FIRST ACTION

```bash
pwd   # must be repo root
docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c \
  "SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3;"
```

If `20260819025302_centro_costos_aug17_qa` is **absent** (current truth as of spawn): **apply it now**.  
If it is **present**: skip deploy, continue seed + contract.

`TaskUpdate` task `1` stays `in_progress` (already is). Owner is you conceptually; do not fight the owner field.

---

## G4 is CLOSED — do not send PLAN-APPROVAL

Decision: `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/g4-aug17-additive-migration-approval.md`  
SQL already on disk: `backend/prisma/migrations/20260819025302_centro_costos_aug17_qa/migration.sql`  
Schema already edited. Proposed plan already written.

**Apply:**

```bash
cd backend && npx prisma migrate deploy
```

Local `miempresa_dev` only. No AWS. No `--shadow-database-url`. No edit of `20260805000000_centro_costos_ago5`.

Then follow the original assignment **from step 6 onward**:

`development/feature-centro-costos-ago-5/tasks/W4-backend-aug17/task-assignment-backend-aug17.md`

Specs: `decisions/aug17-qa-feedback-decisions.md` + `01-requirements-aug17-feedback.md`.

---

## T9 remaining (after deploy)

1. Rename `Transporte` → `Transporte completo` **before** inserting `Transporte completo`.
2. Insert Mensualidad por 4 días, Mensualidad por 3 días, Transporte por 3 días; resequence INGRESOS 1–8, EGRESOS 9–14. Idempotent; second run no-op.
3. Update `DEFAULT_CENTROS_COSTOS` in `empresaService.ts`.
4. Update contract **in place** (same filename).
5. Verify AC: `\d` new columns; 8 INGRESOS names; item count unchanged (10); no exact `Transporte`.
6. `TaskUpdate` `1` → `completed`. Then T10 (task `2`) autonomously.

Write progress to `tasks/W7-backend-aug17/progress-report.md` and final `completion-report.md` (verbatim commands).

---

## T10 — same as W4 assignment T10

fecha derive periodo; INGRESOS copy precio + require pagador/beneficiario; CONTRATOS 403s; GET `/items/:itemId` before `/:id`; smoke green; `tsc --noEmit` clean.

---

## Reporting

To `team-lead` only: `COMPLETE:` per task, `BLOCKED:`, `TURNING-POINT-*`.  
**Do not send PLAN-APPROVAL or WAITING.** Gate is done.  
MAX 2 self-repairs then STRATEGY.
