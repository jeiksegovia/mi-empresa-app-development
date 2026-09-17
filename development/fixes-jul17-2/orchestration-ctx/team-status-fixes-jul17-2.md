# Team Status: fixes-jul17-2

## Phase: COMPLETE — SHIPPED TO STAGING (2026-07-17)
All 8 tasks done + validated. Release: reset + first seed-qa run + d-8E7JTGNMK + Amplify job 9;
R6 23/23; orchestrator independent probes green (contratos 200/403/200). Handoff: 06-handoff.md.
Summary: context/plan-implemented/fixes-jul17-2-implemented.md. worker-12 SHUTDOWN
(approved 20:41, terminated — roster fully closed, zero live workers across all cycles). Follow-ups: B34/B35 script hardening, B32, certificates 500.

## (prior) Phase: 3 — Wave 1 running (W9 ∥ W10)
Last updated: 2026-07-17 (final)

## Worker Roster
| Worker | Role | State | Current task | Notes |
|---|---|---|---|---|
| worker-9 | pt-backend-eng | SHUTDOWN (approved 19:50, terminated) | — | #31–#33 DONE + VALIDATED (13/13 re-run; matrix verbatim; migration 22 applied; docs in place; ZERO deviations). Pre-existing ficha-transitions failure classified data-drift (stash-baselined) → fold into #37 |
| worker-10 | pt-frontend-eng | SHUTDOWN (approved 19:59, terminated) | — | #34–#36 DONE + VALIDATED (11/11 re-run; mocked-session determinism; live re-runs delegated to W11) |
| worker-11 | pt-test-quality | SHUTDOWN (approved 20:22) | — | #37 DONE + VALIDATED (live-profiles 9/9 + ficha-transitions 2/2 re-run; 20 live tests; parity 16/16; 0 gaps; regression 114/0) |
| worker-12 | pt-devops-infra | SPAWNED | #38 R0 | FRESH; gated release with pre-loaded B27–B33 traps; R3 = first real seed-qa run (fixes staging login) |

## Tasks
#31→#32→#33 (W9) and #34→#35→#36 (W10) → #37 (QA) → #38 (staging release).

## Gates
- G-A: W9 enum migration — additive; G-A note in progress-report suffices (local reset authorized).
- G-B: #38 full checkpoint-gated staging release (clean reset pre-authorized in plan approval;
  per-phase PROCEED via orchestrator; exercises the NEW seed-qa mandatory step for real).

## Watch items
- CONTRATOS create-only: method-level (GET/POST 200, PUT/PATCH/DELETE 403) — QA matrix.
- POST /patients/:id/fichas = 'fichas' domain (blocked for CONTRATOS) despite pacientes create allowed.
- Frontend/backend matrix parity (duplicated constants) — QA cell-by-cell.
- Dry-run zero-write assertion via request interception.
- Template copy: source template rows byte-identical pre/post (checksum).
- W9 must NOT execute seed-qa-staging.sh or SSM puts against staging (implementation only; #38 executes).
- Developer login on staging still broken (qa@ 401) until #38 runs the new seeding — known, accepted.

## Key events
- 2026-07-17: Plan approved ("Approve & Execute" + clean-DB authorization for local AND staging).
  Contract addendum written. Tasks #31–#38 created. W9+W10 spawned.

## Decisions
- `decisions/contract-fixes-jul17-2.md` — matrix, requireDomain semantics, QA users/SSM layout,
  crear-from-template API, audit/dry-run spec, clean-DB directive (§5).
- Prior cycle context: `development/instrumentos-dynamic-fichas/orchestration-ctx/` (contract post-G2-12, jul-17 release records).
