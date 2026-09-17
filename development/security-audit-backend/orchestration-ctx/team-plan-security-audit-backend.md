# Team Plan: security-audit-backend

**Team**: team-security · orchestrator addresses self as `team-lead` · worker prefix `sec-*`
**Coexists with**: team-tenancy (`tnt-*`). Never touch a non-`sec-*` worker or task.

## Objective

Evidence-backed, severity-ranked security audit (backend + Lightsail infra + FE-origin comms +
frontend). Report + remediation plan only. Staging-only live probing; prod via IaC parity.

## Contract (authoritative)

`orchestration-ctx/decisions/00-findings-contract.md` — finding schema + severity rubric + evidence
layout. Workers annotate CANDIDATE findings in this format; the orchestrator assigns final_severity.

## Work streams

| Worker | Name | Role | Tasks | Points |
|---|---|---|---|---|
| W1 | sec-devops-1 | pt-devops-infra | #1 infra+comms evidence (gated), #2 log intrusion triage | 8 |
| W2 | sec-code-1 | pt-research-arch | #3 backend static map, #4 frontend XSS/token/CSP | 8 |
| W3 | sec-consolidate | pt-docs-integration (or reuse sec-code-1) | #5 consolidated report | 3 |

## Dependency graph

```
#1 (gate->infra evidence) ──┐
      └── #2 (log triage) ──┤
#3 (backend map) ───────────┼──> [orchestrator Wave-2 verdicts] ──> #5 (report)
      └── #4 (frontend map)─┘
```

- #2 blockedBy #1 (same approved SSH session).
- #4 blockedBy #3 (same worker, sequential).
- #5 blockedBy #1,#2,#3,#4 AND the orchestrator's Wave-2 decision records.

## Sequencing / waves

1. **Wave 1** (parallel): spawn sec-devops-1 and sec-code-1. sec-devops-1 hits its PLAN-APPROVAL
   gate before any live command; sec-code-1 runs free (static).
2. **Wave 2** (orchestrator, no worker): read shortlists + cited refs, write per-domain verdict
   decision records assigning final_severity + CONFIRMED/PLAUSIBLE. Optional single targeted
   NEW-ASSIGNMENT back to sec-devops-1 for a borderline live check.
3. **Wave 3**: consolidate report + remediation roadmap + context distillation.

## Interface contracts

- Finding record + severity rubric: see the findings contract file.
- Evidence layout: `evidence/{infra,logs,code-map}/` + `evidence/index.md`.
- Workers set candidate_severity + verify_status only; never final_severity.

## Boundaries

- Read-only everywhere. No mutations to any env. No prod probing.
- AWS: profile `disruptive`, region `us-east-1`, state every command, live target staging only.
- Workers write only under `development/security-audit-backend/**`.

## Gates

- **sec-devops-1 PLAN-APPROVAL**: before any live SSH/AWS command. Orchestrator replies with a
  plain-string `APPROVED:`.
- Report + plan only — no code/infra changes this cycle (locked decision).
