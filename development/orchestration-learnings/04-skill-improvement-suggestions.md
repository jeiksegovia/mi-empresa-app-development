# Suggested Improvements — planify-team skill + pt-* agent definitions

> For the skill maintainer. Each item: what to change, where, why (observed evidence), and suggested wording.
> **STATUS: ALL 16 APPLIED (2026-07-10, user-instructed).** See [05-implemented-fixes-report.md](05-implemented-fixes-report.md)
> for exact anchors, verification greps, and replication notes. This file remains as the rationale record.

---

## A. planify-team skill files

### S1 — Phase 0 loads orchestration-learnings ✅ APPLIED
**File:** `SKILL.md` §Phase 0 — Session Re-Anchor.
**Change:** add a step: read `development/orchestration-learnings/00-index.md` if it exists, and load the themed files it recommends.
**Why:** learnings otherwise depend on the human remembering to mention them.

### S2 — Name-collision guard on spawn
**File:** `worker-reuse.md` (§Structured shutdown) + `SKILL.md` Phase 2 step 2.
**Change:** "Before spawning ANY worker, verify no unresolved `shutdown_request` exists for that name (check roster + pending request IDs). If a sweep is in flight, use a fresh generation-unique name."
**Evidence:** jul-10 incident — stale gen-1 sweep raced same-named gen-2 spawns; several minutes of unknowable worker state, PING recovery required.

### S3 — Classify-by-artifacts rule in the monitoring table
**File:** `SKILL.md` Phase 3 §Idle Notification Monitor.
**Change:** add above the classification table: "Worker message summaries can arrive mangled (observed: literal `$1` from template substitution). When a signal is ambiguous, classify from artifacts FIRST (task dir listing, progress-report tail, TaskList state) before any intervention."
**Evidence:** jul-10 — a COMPLETE arrived with summary `$1`; artifact check avoided a wasted intervention.

### S4 — Watch-items section in the status template
**File:** `progress-tracking.md` §Status Template.
**Change:** add a `## Watch items` section: claims from one worker's report that must be verified at another worker's completion, each with the exact verification command.
**Evidence:** jul-10 — "contrato sans cargoId returned 500 mid-flight; contract requires 400" was registered as a watch item and verified (fixed) at the next completion. Without a home in the template this pattern relies on orchestrator memory, which does not survive compaction.

### S5 — Contract-first as a first-class decomposition strategy
**File:** `SKILL.md` §Task Decomposition Strategy.
**Change:** add: "When work spans layers, make wave 1 a single worker producing the shared interface + a contract document in `orchestration-ctx/decisions/`; all downstream assignments cite the contract as authoritative and forbid reading the underlying source. QA tests against the contract."
**Evidence:** three cycles, zero integration name-mismatches; a full UI layer built without the worker ever opening the schema.

### S6 — Implementer-ships-a-spec requirement
**File:** `worker-template.md` §Deliverables.
**Change:** for IMPLEMENTATION tasks add: "Include at least one smoke spec exercising the new behavior, following the project's existing test patterns." Keep the dedicated QA wave — this reduces its load, not replaces it.
**Evidence:** jul-8: three implementers shipped zero tests, QA backfilled 13 specs. jul-10: the frontend worker shipped its own 3-test spec — cheapest regression coverage of the cycle.

### S7 — Known-issues pre-logging handoff
**File:** `worker-template.md` §Completion Report — already has "Issues Encountered"; add explicit instruction: "List issues you observed but did NOT fix (out of scope), with repro. The orchestrator pre-loads these into the QA wave's assignment as 'verify and include, do not fix'."
**Evidence:** jul-9/jul-10 — two backend self-reported issues traveled through QA verification to a routed fix-up without any re-discovery cost.

### S8 — Fix-up routing rule
**File:** `SKILL.md` Phase 4 (or troubleshooting.md).
**Change:** "QA gaps route to the ORIGINAL author as a NEW-ASSIGNMENT carrying the QA report's exact repro/snippets. The fixer also tightens any provisional test assertions QA wrote against current-behavior."
**Evidence:** jul-9 GAP-1..3 and jul-10 fix-ups — same-author fix-ups with exact repros were the fastest tasks of every cycle.

### S9 — TaskList-before-marking guard
**File:** `SKILL.md` Phase 3 step 6 (task-lag mitigation).
**Change:** add the inverse case: "Workers may complete tasks themselves; run TaskList before marking on their behalf — marking an already-closed task returns 'Task not found'."
**Evidence:** observed twice (jul-9 #19/#21-23, jul-10 #31).

### S10 — Release-runbook checkpoint template
**File:** new satellite `release-protocol.md`, referenced from worker-catalog's devops role.
**Change:** codify the R0–R5 checkpoint-gated release pattern: R0 read-only sanity+risk (ungated) → gated mutating phases with verbatim-output CHECKPOINTs → highlight point-of-no-return to the human → pre-staged rollback, never auto-executed.
**Evidence:** two staging releases (jul-5, jul-9), zero rollbacks; the human chose gate granularity per release (per-phase vs autonomous-after-backup) — the protocol supports both.

### S11 — Parallel-migration advisory in assignments
**File:** `worker-template.md` §Constraints.
**Change:** when schema and test/QA workers run concurrently, both assignments carry: "another worker is migrating in parallel — retry transient failures once; classify residuals rather than chasing them."
**Evidence:** jul-10 — a NOT-NULL migration landing mid-run broke 3 fixture tests in a parallel worker's run; classification (not chasing) kept both workers on-plan.

---

## B. pt-* agent definitions (worker side)

### W1 — Structured shutdown_response compliance
**Files:** all `pt-*.md`.
**Change:** "On `shutdown_request`: reply ONLY with the structured `shutdown_response` (echo request_id, approve) — do not send a plain-text acknowledgment instead of it."
**Evidence:** jul-10 — one worker replied 'Powering down' in plain text and never emitted the structured response, leaving it idle-alive and its termination state ambiguous.

### W2 — Summary-field hygiene
**Files:** all `pt-*.md` (§SendMessage usage).
**Change:** "The `summary` field must be literal prose. Never pass shell/regex placeholders ($1, backrefs) — compose the string before the call."
**Evidence:** the `$1` mangled summary incident.

### W3 — Evidence-first completion reports
**Files:** all `pt-*.md` (§On completion).
**Change:** "Every acceptance criterion in your completion report is proven by a verbatim command + output, or marked NOT-VERIFIED with a reason. Prose claims without evidence will be spot-checked and bounced."
**Evidence:** evidence-rich reports enabled 30-second orchestrator validation; the one criterion reported without evidence (jul-10 T4 ≥20/24) needed a re-read cycle to accept.

### W4 — Deviation-with-evidence duty
**Files:** all implementation roles (`pt-backend-eng`, `pt-frontend-eng`, `pt-data-schema`, `pt-fullstack-impl`).
**Change:** "If reality contradicts your assignment (missing column, absent file, different shape): STOP on that item; document `assignment said X / found Y / propose Z` with evidence; breaking → PLAN-APPROVAL and wait; non-breaking → deviations table + proceed."
**Evidence:** the D7 'column never existed' catch — the single highest-value worker behavior of all three cycles.

### W5 — Test-integrity rules for pt-test-quality
**File:** `pt-test-quality.md`.
**Change:** make explicit: "(1) never modify source to make a test pass; (2) never loosen an assertion to case-insensitive/status-range unless the assertion's purpose is unrelated; (3) fix fixtures, not expectations; (4) classify every failure BUG/TEST-ENV/FLAKE — zero unclassified; (5) deterministic inputs (date math relative to run-day, documented)."
**Evidence:** these five rules, given per-assignment in jul-9/jul-10, produced two exemplary QA reports; they belong in the role, not re-typed per assignment.
