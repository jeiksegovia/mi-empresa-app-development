# Team Status: hotfixqa-jul-10

## Overall Status: ✅ ALL CYCLES CLOSED (incident + I1-I3 hardening deployed d-HH2LFJIIK, verified; W12/W13 shutdown sweep sent)

- worker-12 PARKED (#20 ✅ validated: 51/51 tests, live 900/300 verified by orchestrator; NOTE: W12 stopped the local backend post-verify — orchestrator restarted it)
- worker-13 pt-devops-infra ACTIVE (#21): backend-only CodeDeploy + smoke (900s) + runbook append; instructed NOT to run the cron-pause fail-fast test (would break staging ~1h — unit tests carry that proof)
- Spec: `decisions/presign-security-analysis.md`

## (incident close status below)
### ✅ INCIDENT CLOSED (2026-07-11) — converged, shutdown sweep dispatched

Final: staging hardening 7/7 (canary fresh-STS TRUE) · plan-implemented doc + 06-handoff written.
Roster final: W8 SHUTDOWN ✅ (08:40) · W11 SHUTDOWN ✅ (08:40) · W10 plain-text ACK'd, structured response pending — harmless idle-alive if it lingers (loop guard: no re-send).

## (prior status below)

- W8 #12 ✅: CodeDeploy d-VGKFFBAIK + Amplify Job 6. **R3b isolation PASS**: stopgap temporarily disabled → P0 provider alone re-synced the SDK with the rotated file within ~5 min, PID unchanged → stopgap restored. useFileUpload fix verified IN the built bundle. 19/19 staging QA. S7 curl re-test PASS. Runbook section appended.
- Staging independently verified by orchestrator (health 200, SPA 200, runbook section present).
- W10 dispatched: staging run of the hardening suite (canary, persistence, silent-failure hard-assert, coverage additions).
- Then: convergence (plan-implemented doc + handoff) → shutdown sweep → incident closed.

## Worker Roster (session-scoped, live)
| Name | Role | State | Task | Notes |
|------|------|-------|------|-------|
| worker-8 | pt-devops-infra | PARKED (#1 ✅ + stopgap-B ✅ verified 03:46 UTC) | Staging S3 durably healthy: each cron rotation now reloads pm2 (PID-poll guarded); backup .bak-w8 on instance | Repo-sync of the script block → added to W11 wave A (addendum sent) |
| worker-11 | pt-fullstack-impl | PARKED (#9+#10 ✅ validated) | P0 awsCredentials.ts (mtime-expiration provider, env-aware — W8's fromTemporaryCredentials import was invalid, permitted alternative used) + S7 fix + repo script sync + 5 UI items; 14+9+9 tests green | held for deploy-wave fix-ups |
| worker-10 | pt-test-quality | PARKED (#2 ✅, #13 ✅ — 5 hardening specs + assertUploadPersisted helper, staging-ready) | Found NEW bug: useFileUpload PUT status unchecked → dispatched to W11 as urgent pre-R4 fix | staging run of its specs after deploy |

## Deploy coordination (live)
- W11 PUT-status fix ✅ landed + orchestrator-validated (silent-failure spec 4/4 incl. forced-403; PUT-site sweep clean — others are apiFetch). W11 idle-without-COMPLETE handled via direct deliverable verification (protocol path).
- W8: R0/R2/R3 ✅ done, R3b (rotation-boundary) in progress, **R4 CLEAR sent** → frontend deploy will include the fix
- Remaining: R4 → R5 → staging run of W10's hardening suite → convergence
| worker-6 | pt-fullstack-impl | PARKED (prior session) | → #3 fix wave | REUSE planned (G1 ✓, staging-curl context); scope set by W8's classification table |
| worker-7 | pt-devops-infra | SHUTDOWN-REQ sent | — | hotfix deploy done + verified |

## Task graph
#1 W8 forensics → blocks → #3 W6 fix wave (C1-C7, scoped by classification)
#2 W10 forensics (independent) → its hardening implementation = later NEW-ASSIGNMENT
Deploy of code fixes = user gate (established pattern)

## Root cause — CONFIRMED (W8 Phase 1, evidence E1-E8 + SDK source)
**AWS SDK v3 memoizes file-based creds with no `expiration` field → never re-reads the file.** Cron IS refreshing correctly (:45 cadence, fresh mtime, valid creds); the long-lived PM2 process signs with the creds it cached at startup. Kill shot: live presign used access key `ASIA_REDACTED` while the file held `ASIA_REDACTED` → ExpiredToken.
- Immediate repair (pre-authorized, in flight): pm2 restart → fresh window ~60 min
- **OPERATIONAL WARNING**: staging S3 re-breaks ~1h after ANY pm2 restart until a durable fix ships → durable fix = TOP item of the W6 fix wave (options: credential provider with TTL/re-read, cron-driven pm2 reload, or IMDS/instance-profile)
- Phase 3 symptom re-test is time-boxed inside the fresh window

## Key artifacts
- `context/user-feedback/qa-session-jul-10-hotfixqa-reinterpreted.md` — 12 symptoms, C1-C7 code items, 4 QA-forensics questions
- `orchestration-ctx/team-plan-hotfixqa-jul-10.md`

## Last Updated: 2026-07-11 (wave 1 spawned)
