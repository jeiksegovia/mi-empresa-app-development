# Orchestration Patterns — what worked and why

> Generic patterns proven across three cycles. Each maps to a planify-team phase so the current flow benefits directly.

---

## P1 — Contract-first sequencing ("the spine")
**Phase 1 (plan creation) + Phase 2 (assignments).**
When work spans layers (schema → API → UI → tests), ONE worker owns the shared interface and produces a **contract document** (`orchestration-ctx/decisions/schema-contract-{slug}.md`) as its final wave-1 deliverable: exact field names, request/response shapes, enum values, seed data, error shapes, and a deviations table.

Rules that made it work:
- Downstream workers are told: *"the contract is authoritative — never open the underlying source (schema/service) to answer a question."* This removes the largest weak-model failure mode: guessing names from partial reads.
- QA tests **against the contract, not the implementation** — otherwise tests mirror bugs.
- The contract has **placeholder sections** for later waves, filled by the same worker as it implements (living document, one owner).
- Evidence: an entire UI layer was built by a worker that never opened the schema; integration had zero name mismatches.

## P2 — Waves with pre-committed reuse decisions
**Phase 1.**
Decide reuse-vs-fresh **per wave at planning time** and write the rationale into the team plan. Improvised reuse decisions under time pressure are where protocol violations happen.

The decision heuristic that held up:
- **REUSE** when the next task consumes what the worker just produced (its context IS the spec — e.g., schema-author → API-author → fixer-of-its-own-QA-gaps). Same files = max value.
- **FRESH** when: different domain (context would anchor wrongly), large scope needing the full context budget, or **verification roles** (a QA worker with implementer context writes tests that mirror the implementation).
- Role choice can be made FOR reuse: pick the role in wave 1 that the wave-2 task also needs (e.g., backend-eng owns migrations instead of data-schema, so the API wave passes the role gate).

## P3 — Plan-approval gates on data-touching steps
**Phase 2 (assignment) + Phase 3 (monitoring).**
Any migration/operation that touches existing data gets a **gate**: the worker must first gather REAL data (row counts, DISTINCT values), write `proposed-plan.md`, send `PLAN-APPROVAL:` and WAIT.

Why it earns its cost: the gate is where **plans meet reality**. One gate revealed that a column the plan assumed existed never did — the worker's evidence corrected the plan before any SQL ran. Approval always produces a **decision record** (`orchestration-ctx/decisions/…`) so the correction outlives context compaction.

## P4 — Deviation-with-evidence protocol
**All phases.**
Locked decisions stay locked (workers never re-litigate), BUT workers are explicitly empowered to deviate **when data contradicts the plan** — with obligations:
1. State the deviation as `assignment said X / reality is Y / therefore Z`
2. Attach the evidence (query output, file listing)
3. Breaking → PLAN-APPROVAL and wait; non-breaking → document in the contract's deviations table
This converts "weaker model silently improvises" (dangerous) into "worker surfaces a structured decision" (valuable).

## P5 — Dedicated QA wave + implementer-ships-a-spec
**Phase 1.**
Implementers skipping tests is the default failure (one cycle shipped 3 workers' features with ZERO tests; a QA worker had to backfill 13 specs). Two-part fix:
- A **dedicated test-quality wave** at the end, fresh context, testing against the contract, with authority to file gaps but **forbidden from modifying source** ("a failing test caused by a real bug goes in the gap report").
- Additionally require implementers to ship **at least one smoke spec with the feature** — the best cycle had the frontend worker deliver its own 3-test spec, which shrank the QA wave and caught regressions at authoring time.

## P6 — Follow-up folding and fix-up routing
**Phase 3/4.**
- When an early wave surfaces residual work (e.g., infra repair unmasks latent failures), **fold it into a later planned task's description** (update the task, don't create ad-hoc orphans). The later worker gets one coherent list.
- QA gaps route back to the **original author as a fix-up NEW-ASSIGNMENT** with the QA report's exact repro + snippets — fixing your own code with a precise repro is the cheapest possible task. Have the fixer also **tighten the provisional test assertions** QA wrote against current-behavior.

## P7 — Watch items (cross-worker signal routing)
**Phase 3.**
When worker A's report contains a claim that worker B's later work must confirm or contradict (e.g., "endpoint returned 500 mid-flight, spec requires 400"), register it as a **watch item in the team status file** with the exact verification to run at B's completion. The orchestrator is the only channel between workers — this is how signals survive.

## P8 — Trust-but-verify validation
**Phase 3 step 4.**
On every `COMPLETE:`:
1. Read completion-report
2. Confirm claimed files exist on disk (`git status`, `ls`)
3. **Independently re-run 1–3 of the worker's verification commands** (a curl, a grep) — cheap, and it caught mid-flight states more than once
4. Only then mark completed and unblock dependents.
Never validate from the message alone; never skip because the report "looks thorough".

## P9 — Checkpoint-gated release protocol
**For any deploy/release task.**
Phases: R0 read-only sanity + risk gate (runs free) → each mutating phase (IaC, backup, deploy, frontend, QA) ends with a CHECKPOINT carrying **verbatim key output** and waits for explicit `PROCEED PHASE R{N+1}:`. Highlight the **point of no easy return** (usually the migration) to the human and get their choice on gating granularity. Pre-stage the rollback plan; never auto-rollback — report and wait.

## P10 — Strict file-ownership boundaries
**Phase 1/2.**
Every assignment lists **explicit non-goals** ("do NOT touch X — worker N owns it") with the same prominence as goals. Parallel workers own disjoint directory subtrees; shared files go to one worker or sequential waves. Result across three cycles: zero conflicting edits. The "do NOT touch" list is cheap insurance and weak models respect it well.

## P11 — Task graph mirrors the plan, IDs are handed out
**Phase 1 step 5.**
- One task per deliverable-sized unit; `blockedBy` chains encode the sequence (never prose-only).
- Assignments embed the **literal task ID** ("Your task ID is `26`") — workers on weaker models mis-discover IDs.
- Workers may self-complete tasks; before marking on their behalf, `TaskList` first (avoid "Task not found" on already-closed items).

## P12 — Status file is the single source of truth
**All phases.**
`team-status-{slug}.md` updated silently on every state change: roster with states, key events, watch items, incident log. Re-read on EVERY wake — in-memory state does not survive compaction. Decisions never live only in context: `orchestration-ctx/decisions/` or they didn't happen.
