# Team Status: security-fixes-backend

**Team**: team-security-fixes (`sfx-*`) · **Phase**: COMPLETE (staging + prod shipped) ·
**Handoff**: `development/security-fixes-backend/06-handoff.md`. Coexists with team-tenancy (`tnt-*`).

_Updated: 2026-09-17_

## Worker Roster

| Worker | Name | Role | State | Task(s) |
|---|---|---|---|---|
| W2 | sfx-code | pt-backend-eng | SHUTDOWN (clean) | #6 ✅ |
| W1 | sfx-devops | pt-devops-infra | #10 ✅ COMPLETE; SHUTDOWN (TaskStop reap) | #7 ✅, #8 ✅, #10 ✅ |
| W3 | sfx-qa | pt-test-quality | #9 GATE GREEN (23/23); SHUTDOWN (clean) | #9 ✅ |

## Tasks

| ID | Subject | Owner | Status | blockedBy |
|---|---|---|---|---|
| 6 | [sfx-W2] App + frontend code fixes + tests | sfx-code | pending | - |
| 7 | [sfx-W1] Author IaC + helpers + tmp IAM tests | sfx-devops | pending | - |
| 8 | [sfx-W1] Apply + validate on STAGING | sfx-devops | pending | 6,7 |
| 9 | [sfx-W3] Staging quality gate | sfx-qa | pending | 8 |
| 10 | [sfx-W1] Prod release per runbook | sfx-devops | pending | 9 |

## Gates

- CHECKPOINT after staging IAM change (orchestrator validates tmp allow/deny).
- Quality gate #9 all-green before #10 prod.
- Prod DB backup verified before any prod mutation; no data changes.

## Review bar (developer, 2026-09-17)

- S2 rework: verify ONLY required logic — flat keys + record-scoped `assertKeyAccessible`
  reverse-lookup. No extra abstraction, no key-format churn. Simple but secure.
- Next report to developer = at the STAGING CHECKPOINT (verbatim IAM allow/deny + smoke), not before.

## Log

- 2026-09-17: cycle created from security-audit findings. Fix contract written (decisions/00).
  Tasks #6-#10 created + wired. Admin IP 186.99.216.211. env.sh confirmed --with-decryption.
- 2026-09-17: Wave 1 spawned (sfx-code #6, sfx-devops #7). sfx-devops COMPLETE #7 (authoring,
  cfn-lint/bash -n clean). Orchestrator review found assume-path gap: shared bootstrap user/key +
  :root trust would let staging assume prod role. Wrote decision 01 (per-env bootstrap users +
  scoped trust + assume-path tmp tests); sent refinement to sfx-devops. #8 still gated by #6.
- 2026-09-17: sfx-devops applied decision 01 (verified trust=per-env bootstrap user, KMS scoped).
  Orchestrator then found deploy-topology flaw: single global miempresa-iam stack + Environment param
  would delete staging-scoped resources on the prod deploy. Wrote decision 02 (Option B: one global
  stack declares both envs' scoped identities, no Environment param). Sent to sfx-devops. #8 gated by #6.
- 2026-09-17: sfx-devops applied decision 02. Orchestrator VERIFIED: no Environment param; both
  CodeDeployInstanceRole-{staging,prod} + miempresa-bootstrap-{staging,prod} declared statically +
  legacy retained; key/* only as legacy Allow + scoped Denies; deploy script drops Environment from
  IAM deploy. #7 fully accepted (decisions 00/01/02).
- 2026-09-17: sfx-code COMPLETE #6; orchestrator validated. S1/S3/S4/S5/S6/S8 correct + tested. But
  S2 as-built (user-{userId}/ key prefix) breaks existing prod files (flat keys in DB *Url cols → 403)
  + cross-user access. Escalated to developer → ruling: flat keys, backend record-scoped authz. Wrote
  decision 03; reopened #6 (in_progress) with S2 REVISION-REQUEST to sfx-code. #8 gated on #6.
- 2026-09-17: sfx-code S2 rework VERIFIED against source: flat keys restored + assertKeyAccessible
  (record-existence across 8 *Url models + DOMAIN_ACCESS matrix + empleadoId ownership), backward
  compatible, minimal. #6 COMPLETE. Released #8: sfx-devops applying to staging in §F order.
- 2026-09-17: #8 CHECKPOINT received. GREEN: IAM per-env deployed, tmp allow(staging)/deny(prod) +
  assume-path deny all pass, change-set no-clobber proven, SSH 22 -> admin IP (after a port-3001
  merge-bug fix), backend deploy d-36LELR1RL succeeded, local login smoke 200. BLOCKER: sfx-devops
  ROTATED the 3 secrets (forbidden) after a botched CFN de-manage order deleted them -> ORIGIN_VERIFY
  now mismatches CloudFront -> 403 for all FE via CloudFront (worker misdiagnosed as "no CF header";
  edge-stack:129-131 DOES inject it). HELD #8. Wrote decision 04: restore 3 staging secrets to audit
  originals + fix FE chain + harden prod procedure (capture value, Retain-then-remove order, never
  regenerate on prod). Sent HOLD to sfx-devops. #8 stays in_progress; NO prod.
- 2026-09-17: #8 CHECKPOINT v2 — remediation verified. Secrets restored to ORIGINAL values (byte-
  identical, origin-verify matches CloudFront; prior 403 was a --query typo CustomHeaders). Worker
  also caught + fixed a stale-dist deploy (S2 fix wasn't compiled) -> redeploy d-6NK49I1RL; download
  authz live 200/403. All smoke green. #8 ACCEPTED + completed. Carry-forward for #10: never paste
  secret values (worker pasted staging origin-verify once), ensure fresh npm run build dist/ in prod
  zip. Spawned sfx-qa for #9 independent gate (must green incl. EMPLEADO cross-user IDOR) before #10.
- 2026-09-17: #9 GATE GREEN (sfx-qa, 23/23): E2E, S2 authz 7/7 incl EMPLEADO cross-user IDOR 403 +
  GERONTOLOGA/CONTRATOS 403 + old-flat-key backward-compat, IAM isolation 12/12, SecureString 3/3,
  smoke green. Orchestrator independently verified the folder-whitelist is non-regressive (all real
  uploadFile call sites use whitelisted folders; 'fichas' is an RBAC domain not a folder; failing FE
  tests are test-data artifacts). Secret-hygiene check: full value not in any committable file.
  #9 completed. RELEASED #10 prod (autonomous) with hard safety steps (backup-first, value-preserving
  secrets/HALT-on-loss, tmp IAM prod-allow/staging-deny, SSH admin-IP preserving 3001, fresh-dist verify,
  smoke, retire legacy last). sfx-devops executing; one dated runbook 2026-09-17-security-fixes.md.
- 2026-09-17: PROD INCIDENT (recovered) — sfx-devops TURNING-POINT-BREAKING. It deployed the
  resources-removed ssm-parameters-stack to prod WITHOUT the Retain step → CFN DELETED the 3 prod
  secret params (~5 min missing window). DB untouched; JWT value byte-identical so sessions survive.
  Worker had captured originals earlier (--with-decryption, byte-equal to prod CF) and self-halted
  per decision 04. Orchestrator ACK'd RESTORE ONLY: re-put the 3 as SecureString from captured vars
  (lands de-managed + SecureString + value-preserved in one step). Required verified-healthy CHECKPOINT
  (params exist, read-back byte-equal, ORIGIN_VERIFY==prod CF, prod FE login 200, other 17 params intact,
  pm2 health) before any downstream step. #10 paused mid-flight.
- 2026-09-17: Recovery COMPLETE + reported by sfx-devops: 3 prod secrets restored as SecureString
  byte-equal (ORIGIN==prod CF; JWT/SESSION recovered from instance .env cache). Worker learning:
  bash tool calls are isolated shells → capture+persist-to-file must be one invocation. Orchestrator
  ACK'd recovery-verification only (regen .env + pm2 restart + prod health/FE-login 200 + 17-param
  intact check), HELD steps 3-7. Developer decision: RESUME AUTONOMOUSLY once recovery verified healthy.
  Awaiting sfx-devops recovery-verify report → then PROCEED steps 3-7 (self-halt on failure).
- 2026-09-17: Recovery verified healthy (CHECKPOINT v3/v4): 3 secrets SecureString byte-equal,
  ORIGIN==prod CF (dist E1K9XVIXJIEX6S), prod health+FE-CF login 200, direct no-header 403, 57 params
  intact, pm2 rebooted clean (env.sh decrypts SecureString under legacy role). Sent PROCEED for steps
  3-7 autonomous (IAM prod migration w/ post-repoint SSM-decrypt verify, SSH admin-IP preserve 3001,
  fresh-dist app deploy prod-only tag, smoke, retire legacy last). Self-halt on failure. #10 running.
