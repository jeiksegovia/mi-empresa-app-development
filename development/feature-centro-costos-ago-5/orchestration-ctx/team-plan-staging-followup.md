# Team Plan addendum — roster cap + staging follow-up

**Date**: 2026-08-18  
**Rule**: max **3** live workers. Parked workers after COMPLETE are shut down unless a same-role reuse is imminent (<15 min, same files).

---

## Roster after cleanup

| Keep | Why |
|---|---|
| **worker-6** `pt-test-quality` | ACTIVE — T12/T13 QA |

Shutdown requested: worker-5, 7, 8, 9 (work gated complete). Already dead: 1, 2, 4.

When QA files gaps → spawn **at most 2** fixers (BE + FE) + keep W6 = 3.  
When QA is green → shutdown W6, spawn **1** devops (deploy) then **1** QA for staging smoke (sequential, so still ≤2).

---

## New tasks (this namespace)

| ID | Plan | blockedBy | Spawn when |
|---|---|---|---|
| 8 | Staging deploy R0–R5 | 4, 5 (+ any QA-fix tasks added later) | QA green **and** developer names AWS profile + “proceed R0” |
| 9 | Staging smoke QA | 8 | Deploy CHECKPOINT R5 complete |

Runbook (already written, **not executed**):  
`context/implementation-plan/staging-release-centro-costos-aug17-runbook.md`

Hard rules for task 8:
- Profile asked, never guessed. One profile only.
- Group `miempresa-staging` only. Never `miempresa-prod`.
- R0 must run L1/L2 (RB-1 `updated_at`, O1 finance table counts) **before** migrate deploy.
- Confirm `20260819025302` is in the zip and seed rename ran after pm2 restart.
- No AWS command until the developer says the profile and proceed.

Task 9 uses staging URLs + qa-admin / qa-contratos / qa-gerontologa. Results go **into the runbook**, not only a chat message.
