# Team Plan: security-fixes-backend

**Team**: team-security-fixes · orchestrator = `team-lead` · worker prefix `sfx-*`.
Coexists with team-tenancy (`tnt-*`) and prior team-security. Never touch non-`sfx-*` tasks.

## Spec (authoritative)

`orchestration-ctx/decisions/00-fix-contract.md` — per-fix change + acceptance + deploy sequence.

## Workers

| Worker | Name | Role | Tasks | Pts |
|---|---|---|---|---|
| W2 | sfx-code | pt-backend-eng | #6 app+frontend code + tests | 8 |
| W1 | sfx-devops | pt-devops-infra | #7 author IaC/helpers/tmp-tests, #8 staging apply+validate, #10 prod release | 13 |
| W3 | sfx-qa | pt-test-quality | #9 staging quality gate | 5 |

## Dependency graph

```
#6 (code) ─┐
#7 (IaC)  ─┴─> #8 (staging apply+validate) ─> #9 (staging QA gate) ─> #10 (prod release)
```

## Waves

1. **Wave 1** (parallel): sfx-code (#6) + sfx-devops (#7 author). No live AWS in Wave 1.
2. **Wave 2**: sfx-devops #8 applies to staging in contract order; CHECKPOINT to team-lead with tmp
   IAM allow/deny output + smoke → orchestrator confirms IAM pattern (developer-mandated) → continue.
3. **Wave 3**: sfx-qa #9 staging quality gate (all green required).
4. **Wave 4**: sfx-devops #10 prod release (autonomous after gate) — one dated runbook, backup first.

## Internal gates (autonomy preserved, safety kept)

- CHECKPOINT after staging IAM change: orchestrator validates tmp allow/deny before app deploy.
- Quality gate (#9) must be all-green before #10.
- Prod: backup verified before any prod mutation; no data changes.

## Boundaries

- AWS profile `disruptive`, us-east-1, state every mutating command. Staging fully green before prod.
- iam-stack is GLOBAL → additive migration only; never break prod access.
- Secrets: values never printed/committed; evidence stays gitignored.
