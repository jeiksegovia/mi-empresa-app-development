# Team Plan: fixes-jul17-2

Feature plan: `development/fixes-jul17-2/fixes-jul17-2-plan.md` (approved "Approve & Execute" +
clean-DB authorization). Contract addendum (authoritative for workers):
`orchestration-ctx/decisions/contract-fixes-jul17-2.md`. Base contract: dynamic-fichas post-G2-12.

## Waves (all FRESH workers per user directive; ≤2 concurrent)
| Wave | Worker | Role | Tasks | Pts |
|---|---|---|---|---|
| 1 | worker-9 | pt-backend-eng | #31 RBAC → #32 seed-qa/docs → #33 crear-from-template | 11 |
| 1∥ | worker-10 | pt-frontend-eng | #34 gating → #35 crear selector → #36 audit+dry-run | 13 |
| 2 | worker-11 | pt-test-quality | #37 QA (fresh mandatory) | 6 |
| 3 | worker-12 | pt-devops-infra | #38 staging clean reset + deploy (gated, jul-17 runbook pattern) | 8 |

## Dependency graph
#31→#32→#33 ─┐            #34→#35→#36 ─┐
             └─→ #37 (QA) ←────────────┘ → #38 (staging release, gated)

## File ownership (strict)
- W9: `backend/**` (src, prisma, tests smoke, test-db scripts), `context/implementation-plan/staging-deploy-checklist.md` + runbook OP-7 append. NOT frontend.
- W10: `frontend/**`. NOT backend. Consumes contract addendum ONLY (never backend source).
- W11: tests + gap report only; source frozen.
- W12: infra/release only, checkpoint-gated.
- Orchestrator: orchestration-ctx + contract addendum.

## Gates
- G-A: W9 enum migration = plan-approval-light — local dev DB reset authorized by developer;
  worker states the migration diff + local reset evidence in a CHECKPOINT-style note in
  progress-report before proceeding (no full stop needed — additive + dev-only).
- G-B (task #38): full checkpoint-gated staging release; developer already pre-authorized the
  clean staging reset in the plan approval; per-phase PROCEED via orchestrator anyway.

## Watch items
- CONTRATOS 'create-only' on pacientes: PUT/PATCH/DELETE must 403 while GET/POST 200 — QA matrix must cover method-level.
- POST /patients/:id/fichas is domain 'fichas' (blocked for CONTRATOS) even though pacientes create is allowed.
- Frontend/backend matrix parity (duplicated constant) — QA validates cell-by-cell.
- Dry-run: zero POST/PATCH network calls (QA asserts via request interception).
- Template copy never mutates source template rows (W11 verifies source checksum pre/post).
- SSM writes: only /miempresa/staging/qa/* (W9's seed-qa-staging.sh edits; script itself performs
  SSM puts when RUN — running it against staging happens in #38, not during W9 implementation).
- Local DB reset (W9) must not hit port 4142 or prod anything; only localhost:15432 dev DB.

## Reuse decisions
All FRESH (user directive). Fix-ups after QA: fresh worker with exact repro.
