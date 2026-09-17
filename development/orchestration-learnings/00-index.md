# Orchestration Learnings — Index

> Distilled from three multi-worker orchestration cycles (fixes-jul-8, improvements-jul-9, next-release-jul-10):
> 26 worker-tasks, 10+ workers across roles, 2 releases, ~100 new tests, 0 rollbacks, 0 cross-worker file conflicts.
> Written generic — applies to any project/workload run under a planify-team-style orchestration.

## How to use (orchestrator, at session start)

Read this index, then load selectively:

| File | Load when |
|------|-----------|
| [01-orchestration-patterns.md](01-orchestration-patterns.md) | ALWAYS — before Phase 1 planning. Core decomposition, sequencing, and validation patterns. |
| [02-worker-briefing-playbook.md](02-worker-briefing-playbook.md) | Before writing ANY task assignment. How to brief workers on a weaker model so they execute without errors. |
| [03-lifecycle-and-incidents.md](03-lifecycle-and-incidents.md) | Before first spawn, and on ANY anomaly (unexpected idle, termination race, mangled message). |
| [04-skill-improvement-suggestions.md](04-skill-improvement-suggestions.md) | NOT runtime reading — rationale record for the 16 skill/agent improvements (ALL APPLIED 2026-07-10). |
| [05-implemented-fixes-report.md](05-implemented-fixes-report.md) | On skill/agent update or doubt — exact anchors + verification greps to confirm the 16 fixes are still present, and replication notes to re-apply them. |

## The five load-bearing principles (if you read nothing else)

1. **Contract-first**: one worker owns the shared interface (schema/API/types) and writes a contract document; every other worker reads the contract, never the underlying source. The contract is the spec QA tests against.
2. **Context is an asset only when the next task touches the same files** — decide reuse-vs-fresh per wave at planning time, not ad-hoc. Reuse when the worker's context IS the spec; go fresh for unrelated domains and for verification roles.
3. **Pre-load the traps**: every known environmental gotcha goes INTO the assignment (exact flags, env vars, prior-incident references, "most-patched file" warnings). Weak-model workers follow a loaded map well; they rediscover traps poorly.
4. **Gate the irreversible**: read-only phases run free; data-touching/deploy phases stop at a checkpoint with real evidence and wait for explicit approval. Workers propose with data; orchestrator decides with a written decision record.
5. **Trust but verify with evidence**: workers report verbatim commands + outputs; the orchestrator independently spot-checks 1–3 claims per completion before unblocking dependents. Every test failure gets classified (BUG / TEST-ENV / FLAKE) — zero unclassified.
