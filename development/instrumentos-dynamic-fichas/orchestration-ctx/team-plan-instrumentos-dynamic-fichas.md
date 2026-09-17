# Team Plan: instrumentos-dynamic-fichas

Feature plan (authoritative background): `development/instrumentos-dynamic-fichas/instrumentos-dynamic-fichas-plan.md`
Requirements: `01-requirements-instrumentos-dynamic-fichas.md` (R1–R12)
Locked decisions: `orchestration-ctx/decisions/intake-decisions-2026-07-16.md` (D1–D4) — never re-litigate.

## Strategy
Contract-first (P1). Max 2 concurrent workers. 5 worker identities across 3 waves; reuse decided per wave (P2).

## Waves & Workers

| Wave | Worker | Role (subagent_type) | Tasks | Pts | Reuse decision |
|------|--------|----------------------|-------|-----|----------------|
| 1 | W1 | pt-research-arch | T1 extract/depurate, T2 item-type matrix, T3 contract + base template JSONs | 12 | FRESH (start). Its context = the extraction; sequential tasks consume own output |
| 2a | W2 | pt-data-schema | T4 Prisma redesign + gated hard-reset migration, T5 seed + upgrade script | 8 | FRESH — schema work needs full budget |
| 2a∥ | W3 | pt-frontend-eng | T6 renderer, T7 schema↔render tests, T8 fill flow + results view + UI cleanup | 13 | FRESH; builds ONLY from contract + template fixtures (never reads backend source) |
| 2b | W4 | pt-backend-eng | T9 scoring engine, T10 API endpoints + backend file-flow removal + smoke specs | 10 | FRESH — W2 parks first (13-pt cap prevents combining) |
| 3 | W5 | pt-test-quality | T11 E2E + contract validation + gap report | 5 | FRESH mandatory (verification role, P5) |

Fix-up wave (if QA finds gaps): route to ORIGINAL parked author with exact repro (P6).

## Dependency graph
```
T1 → T2 → T3(contract) ──┬─→ T4 → T5 → T9 → T10 ──┐
                          └─→ T6 → T7 ─────────────┼─→ T11 (QA)
                                └─→ T8 ────────────┘
```

## Interface contract (single source of truth)
`orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md` — produced by W1 (T3),
extended (deviations table only) by W2/W4 as living document sections W1 pre-creates as placeholders.
Contains: definition JSON format (sections/items/types/scores/skipIf/resultEvaluation), exact Prisma
model + column names, API endpoint paths + request/response shapes, error shapes, seed codes,
patient-field exclusion list. Downstream workers treat it as authoritative — FORBIDDEN from reading
schema.prisma / services to answer contract questions; deviations go through orchestrator.

## File ownership (P10 — strict)
- W1: `context/instrumentos-depurated/**`, contract doc, `development/.../tasks/W1-*/**`, draft templates under its task dir
- W2: `backend/prisma/**` (schema, migrations, seed, instrument-templates/), NOT src/services
- W3: `frontend/app/**`, `frontend/tests/**`, NOT backend anything
- W4: `backend/src/**`, `backend/tests/**`, NOT prisma/migrations (may add template fixes via deviation note)
- W5: `backend/tests/instruments-dynamic/**`, `frontend/tests/instruments-dynamic/**`, gap report; FORBIDDEN from modifying source
- Orchestrator only: `orchestration-ctx/**` (except contract deviations sections), team-status

## Gates
- G1 (P3): W2 migration is data-destructive (D2 hard reset) → plan-approval gate: row counts + proposed SQL in proposed-plan.md, PLAN-APPROVAL, WAIT.
- G2: W1's depurated specs get orchestrator spot-check vs raw sources before T3 unblocks downstream (scores/max totals verified for at least Barthel + Yesavage).
- NEVER `migrate diff --shadow-database-url` (global rule — pre-loaded into W2 assignment).

## Watch items
- Tinetti balance max 16 + marcha 12 = 28; MMSE max 30; Yesavage GDS-15 max 15; Barthel max 100; MNA screening 14 + assessment 16 = 30 — W5 verifies engine totals against these canonical maxima.
- MNA docx tables unreadable via textutil — W1 must use pandoc/python-docx (pre-loaded).
- v-model const-reactive pitfall in renderer tree (pre-loaded into W3).
- Migration must not hardcode empresa/instrument IDs (jul10 lesson).

## Communication
All via orchestrator. Planned relays: T3 contract → W2/W3/W4 assignments; W2 seed-ready → W4; W4 API-ready → W3 (integration check within T8 if timing allows, else folded into T11).
