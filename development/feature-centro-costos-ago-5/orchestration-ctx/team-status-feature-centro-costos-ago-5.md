# Team Status — feature-centro-costos-ago-5

**Updated**: 2026-08-19 · RELEASE COMPLETE staging `d-IUQUHA58L` / Amplify 17 / 30 mig  
**Plans**: team-plan-feature-centro-costos-ago-5.md · team-plan-aug17-feedback.md · team-plan-staging-followup.md

---

## Worker Roster (live only — max 3)

| Worker | Role | State | Current task | Notes |
|---|---|---|---|---|
| worker-10 | `pt-test-quality` | SHUTDOWN | T13 addendum done | Gate PASS 44/44. |
| worker-11 | `pt-devops-infra` | ACTIVE | Task 8 R1 | R0 gated LOW. Developer PROCEED R1 then stop. No CodeDeploy. |

### Shutdown / gone (do not reuse names this session)

| Worker | State |
|---|---|
| worker-1, 2 | SHUTDOWN (ago-5, user-stopped) |
| worker-4 | SHUTDOWN (stuck on G4 plaintext) |
| worker-5, 7, 8, 9 | SHUTDOWN (`teammate_terminated` 2026-08-18, roster cap) |

---

## Tasks

| ID | Subject | Owner | Status | blockedBy |
|---|---|---|---|---|
| 1 | Schema+seed | worker-7 | completed | — |
| 2 | Backend API | worker-7 | completed | 1 |
| 3 | Frontend + recibo | worker-5 | completed | 1 |
| 4 | QA backend | worker-6 | in_progress | 2 |
| 5 | QA FE + regression | worker-6 | pending | 4 |
| 6 | D14 GET month guard | worker-8 | completed | — |
| 7 | FE CONTRATOS CRUD + Bogotá | worker-9 | completed | — |
| **8** | **Staging deploy** | — | pending | **4, 5** |
| **9** | **Staging smoke QA** | — | pending | **8** |

If QA opens fix tasks, add them to task 8’s `blockedBy` before spawn.

---

## Gates

| Gate | Status |
|---|---|
| G1 ago-5 drop | ✅ local |
| G4 aug-17 additive | ✅ applied locally (`20260819025302`) |
| T9–T11 quality gates | ✅ (D14 GET + CONTRATOS ítem CRUD + Bogotá dates) |
| G3 QA no source edits | ⏳ W6 in progress |
| Staging R0 | ⏳ after 4+5; needs AWS profile from developer |

---

## Release blockers (staging R0)

| ID | Blocker |
|---|---|
| **RB-1** | ago-5 `updated_at` NOT NULL no default — only if that migration is **unapplied** and `centros_costos` has rows |
| **O1** | Staging finance table counts never taken |

Runbook: `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md`
