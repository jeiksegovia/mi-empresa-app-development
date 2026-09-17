# Team Plan: hotfixqa-jul-10

**Input**: `context/user-feedback/qa-session-jul-10-hotfixqa-reinterpreted.md` (12 symptoms, root-cause hypothesis, 7 code items C1–C7, 4 QA-forensics questions)
**Prime directive**: infra first — most symptoms plausibly cascade from expired STS creds breaking every S3 presign on staging. Fix/confirm that, THEN re-test all symptoms; only what still fails is a code bug. Do not patch 7 UI surfaces for what might be one dead cron.

## Orchestrator mindset
1. **One root cause probably explains 70% of the log.** The forensics wave gates the fix wave — no frontend patching until W8 reports which symptoms survive a healthy-S3 re-test.
2. **The QA process itself is a bug** (S12): green release QA + red next-morning QA means our verification has a time-dependence blind spot. That gets fixed with the same rigor as the code.
3. **Persistence-after-reload is the assertion standard from now on** (HIGH-1 lesson, now fully applied).

## Workers & Waves (≤3 concurrent)

| Wave | Worker | Role | Mode | Scope |
|------|--------|------|------|-------|
| 1 | W8 | pt-devops-infra | FRESH | **Staging S3/STS forensics + repair**: on-instance cred state (`aws sts get-caller-identity` as ec2-user, creds file mtime vs cron schedule, cron logs, bootstrap profile validity), presign live test, root-cause fix (cron/creds repair authorized — non-destructive), then re-test ALL 12 symptoms via curl and classify: INFRA-FIXED vs STILL-BROKEN (=code bug) |
| 1 ∥ | W10 | pt-test-quality | FRESH | **QA forensics (read-only)**: answer S12 — why 33/33 passed then prod-like QA failed; audit staging suite + regression assertions for the 4 gaps (time-dependence, reload-persistence, silent-failure, coverage); deliver hardening proposal + the S3-canary design |
| 2 | W6 | pt-fullstack-impl | **REUSE** (PARKED, G1 ✓, staging-curl context ✓) | **Code fixes** — scoped by W8's classification: C1 notas silent fail, C2 empleado-certificados persistence + download affordance, C3 cert page refresh, C4 descargar-firmado, C5 pausa tooltip, C6 contrato tab on detail view, C7 fichas error surfacing. Plus regression specs per fix |
| 3 | W10 | pt-test-quality | REUSE | Implement hardening: reload-persistence assertions, staging canary spec, notas/fichas/empleado-cert staging coverage; final regression + report |
| 4 | W8 or W6 | — | REUSE | Hotfix deploy of the code fixes to staging (jul-10 runbook pattern) — user gate before deploy |

## Gates
- W8 sends CHECKPOINT after forensics diagnosis, BEFORE any staging repair beyond cron/cred refresh (cred repair pre-authorized: reversible, restores designed state)
- W8's symptom re-test classification unblocks W6's scope (assignment updated accordingly)
- Deploy of code fixes = user decision (established pattern)

## Constraints (standing)
- `--region us-east-1 --profile disruptive`; nothing containing 'prod'; no `migrate diff --shadow-database-url`; no git commits; local services untouched; direct ssh (not ssh-to-instance.sh) for remote commands.
