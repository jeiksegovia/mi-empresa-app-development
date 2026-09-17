# Worker Briefing Playbook — mindset + assignment craft for weaker-model workers

> The single biggest lever on worker quality is the assignment document. Workers on a weaker model execute
> excellently when the assignment removes discovery, ambiguity, and judgment calls they're not equipped to make —
> and they fail in exactly the places where the assignment made them guess.

## The core mindset to transfer

Write every assignment as if the worker will do **exactly what it says and nothing it doesn't**. The orchestrator does the thinking that requires cross-context judgment; the worker does the executing that requires focus. Concretely:

1. **Give the spec, not the search space.** Point at the contract document, not at the codebase ("the contract is authoritative — never open schema.prisma"). Every fact the worker would otherwise hunt for (field names, enum values, error shapes, creds, ports) is either in the assignment or in ONE named file.
2. **Give the why, briefly.** One line of origin per requirement (a user-transcript quote, a gap-report line ref). When the worker hits an ambiguity, intent resolves it better than guessing. This is cheap and measurably reduced wrong-direction work.
3. **Lock what's decided.** List locked decisions by ID and state "do not re-litigate". Weak models otherwise reopen settled questions mid-task.
4. **Empower structured deviation.** "If reality contradicts this assignment: document evidence, send PLAN-APPROVAL if breaking / deviations-table if not." This channels initiative safely instead of suppressing it.

## Assignment anatomy that worked (checklist)

- **Task Type + literal task IDs** ("Your task ID is `26`") — no discovery
- **Ordered scope** with the SIMPLEST item first — the worker builds momentum and flushes env problems on a cheap task before the hard one
- **Source Files to Modify** — concrete list; empty list on an IMPLEMENTATION task = the worker must send BLOCKED before starting (self-check gate)
- **Worker Self-Check block** — 2-3 mechanical pre-flight assertions the worker runs before any work
- **Key Files to Read First** — ordered, with why; include line ranges for big files ("focus on lines 105-370")
- **Pre-loaded traps** — every known gotcha as an instruction, not a discovery: exact CLI flags, env vars for test runs, links to prior incident writeups, "this file is the most-patched in the repo — read it FULLY, these behaviors must survive: …"
- **Verbatim snippets when the fix is known** — if research already produced the exact code (a fix-proposal, a QA repro), paste it; don't make the worker re-derive it
- **Explicit non-goals** — "do NOT touch X / Y / Z" with owner names; equal prominence to goals
- **Numbered acceptance criteria** phrased as verifiable checks (a curl that returns 400, a testid that exists) — these become the validation script for BOTH sides
- **Deterministic verification recipes** — exact commands with exact env vars; for date-sensitive logic, demand deterministic date math documented in the test
- **Deliverable paths, exact** — result.md / completion-report.md / progress-report.md at named locations; intermediate findings go in progress-report SECTIONS, never as extra files
- **Reporting protocol restated** — even though the agent definition has it: start/complete TaskUpdate, MAX-2 self-repair then TURNING-POINT-STRATEGY, BLOCKED template, and the post-COMPLETE silence rule
- **Size cap** — keep the assignment ≤ ~250 lines; reference the plan for background instead of pasting it

## Evidence discipline (demand it, then use it)

- Completion reports must contain **verbatim commands + outputs** for every acceptance criterion — not prose claims. "Curl-verify each fix" produces reports the orchestrator can spot-check in seconds.
- Ask for **before/after counts** on anything remedial (test suites: "2/24 → 24/24").
- Ask for **classification of every failure** the worker observed: BUG (source) / TEST-ENV / FLAKE — zero unclassified. Forbid "fixing" a test to make it pass: *fix fixtures, never loosen assertions; real bugs go in the gap report.*
- Ask workers to **self-report known issues** they chose not to fix (out of scope) — pre-log these into the next wave's assignment as "verify and include, do NOT fix".

## Error-handling budget (calibrated for weaker models)

- **MAX 2 distinct self-repair attempts** per error, then STOP and escalate with a structured Strategy Request (exact error, attempts+results, hypotheses ruled out). Weak models loop convincingly — the budget converts loops into escalations.
- **BLOCKED template**: exact problem / what was attempted / what would unblock. Then WAIT — "do not spin or fabricate".
- Replies to escalations (`NEW-APPROACH:` / `UNBLOCKED:`) must include *"validate this against your local files, then retry"* — never let the worker apply orchestrator guesses blindly.
- Timebox investigations explicitly ("MAX 2 attempts then BLOCKED with findings") for unknown-cause bugs.

## What NOT to put on the worker

- Cross-worker knowledge (route everything through the orchestrator; workers never message each other)
- Architecture decisions (they escalate TURNING-POINT-BREAKING; the orchestrator decides and records)
- Scope judgment ("should I also fix this nearby thing?" — the non-goals list answers it: no)
- Plan writing when a plan exists (assignment verb is implement/build/fix, never "create a plan for")
