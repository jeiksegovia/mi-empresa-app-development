# Decision: findings contract (authoritative)

> Contract-first artifact. Both evidence workers annotate candidate findings in THIS format.
> The orchestrator adjudicates severity and writes the final verdicts. The consolidation worker
> assembles the report from this schema. QA/verification is against this contract, not raw prose.

## Finding record (every finding uses these fields)

```
### F-{NN} {short title}
- id: F-{NN}
- domain: handlers | middleware | authz | injection | file-upload | xss | secrets | cors-headers | error-leak | db-exposure | ssh-firewall | iam-least-priv | s3-ssm | transport | logs-intrusion | deps
- candidate_severity: CRITICAL | HIGH | MEDIUM | LOW | INFO   (worker sets; orchestrator overrides)
- final_severity: (orchestrator only)
- location: <file:line>  OR  <aws-resource / log path + line>
- summary: one sentence — the defect
- exploit_scenario: concrete inputs/state -> impact (who can do what)
- evidence: relative path under development/security-audit-backend/evidence/<file> (+ line)
- verify_status: CONFIRMED (reproduced) | PLAUSIBLE (from code/config only)
- remediation: specific fix, not "add security"
- prod_parity: does prod share this? (yes, staging==prod copy | no, staging-only | unknown)
```

## Severity rubric (orchestrator applies)

| Severity | Meaning |
|---|---|
| CRITICAL | Remote unauthenticated compromise, data exfil, or RCE reachable from the internet |
| HIGH | Authenticated privilege escalation / RBAC bypass, injection with real impact, secret exposure |
| MEDIUM | Requires chaining or non-default conditions; info leak; weak-but-not-open control |
| LOW | Defense-in-depth gap, hardening opportunity |
| INFO | Observation, no direct exploit |

## Worker rules

1. Workers set `candidate_severity` and `verify_status` only. Never `final_severity`.
2. Every candidate finding MUST have a real `evidence` path (a stored command output or a
   code excerpt with file:line). No evidence -> it is a QUESTION for the orchestrator, not a finding.
3. Prefer CONFIRMED. If a defect is only inferred from code/config without a live repro, mark
   PLAUSIBLE and say what a repro would need.
4. No mutating actions to reach a repro. Read-only proof only.

## Evidence layout

```
development/security-audit-backend/evidence/
├── infra/        # aws describe output, firewall, iam, ssm, s3 (W1)
├── logs/         # pulled staging logs + intrusion-triage notes (W1)
├── code-map/     # route/middleware/injection/xss inventories with file:line (W2)
└── index.md      # one line per evidence file: what it proves
```
