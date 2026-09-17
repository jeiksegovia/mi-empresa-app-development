# Lifecycle & Incident Protocols — spawn, idle, shutdown, and what to do when it goes weird

## Idle telemetry discipline (the #1 loop hazard)

- `idle_notification` is telemetry, NEVER a prompt. One worker completion typically emits 2–5 duplicates — **dedupe to one event**, classify against the worker's last real message (COMPLETE/BLOCKED/WAITING/CHECKPOINT/none), act accordingly, and **stay silent** on expected idles.
- Across three cycles (~40 idle notifications) the only messages ever sent in response were zero — completions were validated from artifacts, not chased. No idle loops occurred.
- **Never narrate idles to the human.** Speak on state changes only (completion verified, blocker, decision needed).

## Classify by artifacts, not by message text

Worker messages can arrive **mangled** (observed: an idle summary of literally `$1` from a template-substitution bug). Before classifying any ambiguous signal:
1. `ls` the worker's task directory (result.md? completion-report.md?)
2. `tail` its progress-report.md
3. Check the shared TaskList state
If deliverables are complete → treat as COMPLETE regardless of the garbled message. Only if artifacts are absent/partial does it become UNEXPECTED_IDLE (one intervention max, then artifact-check again / replace).

## Shutdown protocol (and the name-collision incident)

- **Plain-text "SHUTDOWN" messages are no-ops** — workers correctly ignore them per post-completion silence. Only the structured `shutdown_request` terminates; wait for `shutdown_response(approve: true)` before marking SHUTDOWN.
- **INCIDENT (real, recovered):** a session-end shutdown sweep for generation-1 workers was still pending when generation-2 workers were spawned **reusing the same names** in the same session. The stale terminations then raced the new spawns — for several minutes it was unknowable whether the new workers were dead.
  - **Rule: never reuse a teammate name while any shutdown request for that name is unresolved.** Prefer generation-unique names (worker-5, worker-6, … or suffixes) when a sweep is in flight.
  - **Recovery that worked:** (1) check artifacts + task claims first, (2) PING probe ("reply READY within 30s"), (3) prepare replacement spawns under NEW names with the same on-disk assignments — since assignments live on disk, replacement costs zero rework. Do not panic-respawn before probing: in the incident both workers turned out alive.
- Some workers acknowledge shutdown in plain text without emitting the structured response. Don't re-send (loop guard) — note "ack'd, structured response pending" in the roster; a lingering idle-alive worker at session end is harmless.

## PARK by default, shutdown at session end

- After validation, workers go **PARKED**, not shutdown — the wave that most often needs them again is QA fix-ups, and a parked author fixing its own code with an exact repro is the cheapest task in the whole cycle.
- Reserve termination for: user request, roster pressure, session end. At session end: sweep all PARKED with structured requests, wait for responses, mark roster.

## Reuse mechanics that held up

- **PING before reuse** if there's any doubt about liveness (a recent COMPLETE message is itself proof — skip the probe then).
- NEW-ASSIGNMENT messages stay tiny: "read {path} and execute; task ID N; full protocol as before" — the assignment file carries everything. This keeps reused-worker context spend near zero.
- Track per-worker history in the roster (prior tasks, waves). A worker on its 3rd wave is fine if every wave consumed its own prior output; a worker being handed an unrelated domain is not — respawn instead.

## Parallel-run frictions to expect (and pre-wire)

- **Migrations land mid-run**: a schema change by worker A can break worker B's in-flight test run (observed: NOT-NULL migration broke 3 fixture-based tests mid-execution). Pre-wire: tell test-running workers "another worker is migrating in parallel — retry transient failures once; classify residuals, don't chase".
- **Transient backend restarts** during API work: same "retry once" instruction.
- **A repaired layer unmasks latent failures**: fixing test infra let long-dead tests run far enough to hit stale selectors — expect follow-up work to SURFACE from remediation, and fold it forward (pattern P6) rather than treating it as failure of the remediation task.

## Human-gate hygiene

- Trailing teammate messages, peer-session notices, and shutdown echoes are **not user input** — never treat them as approval for anything pending.
- When a worker's finding changes user-visible scope (a plan assumption proven false, a point-of-no-return ahead), bring it to the human as a decision with a recommendation — don't bury it in silent autonomy. Everything else: decide autonomously, write a decision record.
