# W7 — Staging Release (jul-17) — Proposed Plan (Phase B gate)

## TL;DR

Deploy the G1-approved **instrumentos-dynamic-fichas** release to staging. The work adds 1 new
Prisma migration (`20260717045038_instrumentos_dynamic_fichas`) that hard-resets file-based
fichas and introduces the `instrumentos_versiones` table; the canonical seed (`npm run db:seed`)
now upserts 6 dynamic instruments with active v1 definitions.

Because the G1 migration's D2 hard reset drops `archivo_completado` from `registros_fichas_completadas`
and re-roots the ficha data model, the staging S3 uploads bucket contains 47 stale object uploads
(certificados from pre-jul-10 testing; orphan file-based fichas). Those are no longer reachable
in the app. They must be wiped in lockstep with the DB reset to avoid leaving orphaned bytes
that will never be referenced again — and so that a fresh smoke run starts from a clean bucket.

## What's been authored (reviewable now)

| Artifact | Path | Status |
|---|---|---|
| S3 wipe utility | `backend/infrastructure/scripts/wipe-staging-s3.sh` | ✅ READY (predecessor-authored; verified — see guard checklist) |
| DB reset extension | `backend/infrastructure/db/scripts/reset-staging-db.sh` | ✅ READY (predecessor-extended; `FORCE_SEED=true npm run db:seed` re-runs canonical seed incl. 6 dynamic instruments; all original guards intact) |
| Jul-17 runbook | `context/implementation-plan/staging-release-jul17-runbook.md` | ✅ READY (R0–R7 phases, rollback plan, decision matrix, grep hooks) |
| Acceptance proofs | this file §"Acceptance criteria proofs (live)" | ✅ DONE (verbatims below) |
| Progress report | `tasks/W7-staging-release/progress-report.md` | ✅ INCREMENTAL from session start |

## What gets destroyed (DESTRUCTIVE — needs developer approval)

1. **Staging DB** (`miempresa_staging`) — DROP SCHEMA + recreate, performed LOCALLY through
   an SSH tunnel (`db-tunnel.sh --stage staging --port 5433`) because migration #21 +
   `prisma/instrument-templates/*.v1.json` are release-commit-local devDeps pruned on the
   instance. The `reset-staging-db.sh` utility includes its own pre-reset dump to
   `s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-<TS>.sql.gz`.
   All current rows are replaced by canonical seed state (4 users + 1 empresa + 3 legacy
   placeholder instruments + 6 dynamic instruments with active v1 versions + 7 cargos).
   **Note: this is the documented D2 hard reset of the file-based ficha model**.

2. **Staging uploads S3 bucket** (`miempresa-uploads-540657241795-staging`) — 47 objects,
   68,824,703 bytes (65.6 MiB). Versioning: Disabled → `aws s3 rm --recursive` will fully
   purge. **Recovery**: a pre-wipe manifest is written to
   `s3://miempresa-backups-540657241795-staging/pre-releases/s3-manifests/miempresa-uploads-540657241795-staging-<TS>.txt`
   so recovery is reproducible (not automatic — requires operator to run `aws s3 cp` for each
   manifest line).

## What gets deployed

1. **DB schema** — replay of all 21 migrations (20 prior + 1 G1) on a fresh `public` schema
   (locally-via-tunnel — not on-instance). Includes the new `instrumentos_versiones` table,
   5 new columns on `registros_fichas_completadas`, 1 dropped column, 2 dropped table columns,
   4 new FKs.
2. **Seed data** — canonical state via the same `npm run db:seed` the local dev DB uses
   (idempotent). Includes the 6 new dynamic instruments + their v1 definitions loaded from
   `backend/prisma/instrument-templates/*.v1.json`.
3. **Backend code** — **FRESH CodeDeploy REQUIRED** (per REVISION-REQUEST). Build from local
   working tree (`npm ci && npm run build && npx prisma generate`); zip WITH `appspec.yml` at
   root / WITHOUT `dist/generated` or `src/generated` (after-install.sh regenerates on-instance
   against the new schema); ship `jul17-<TS>.zip` via `aws deploy create-deployment` against
   `miempresa-app` / `miempresa-staging`. The credential architecture (`refresh-credentials.sh`
   cron + pm2-reload stopgap + P0 `awsCredentials.ts` provider) is left UNTOUCHED and re-verified
   post-deploy.
4. **Frontend** — `nuxt generate` + Amplify `start-deployment` (job N+1, where N was 6 in
   the prior hotfix). Bakes the staging API base. ~20s.
5. **No IaC mutation** — R1 is a documented no-op (`miempresa-s3-staging` already at
   `UPDATE_COMPLETE`).

## Acceptance criteria proofs (live, captured 2026-07-17)

Proven by Phase A — see `progress-report.md` §B for verbatim transcripts. TL;DR:

| # | AC | Result |
|---|---|---|
| 1 | Utility refuses: non-staging bucket | ✅ `REFUSED: bucket 'some-arbitrary-bucket' does not match ^miempresa-[a-z0-9-]+-staging$` (exit 1) |
| 1 | Utility refuses: `prod` substring | ✅ `REFUSED: bucket 'miempresa-uploads-prod' contains 'prod'` (exit 1) |
| 1 | Utility refuses: no TTY | ✅ Pipelined stdin with correct bucket + phrase still refused: `REFUSED: --execute requires an interactive TTY (stdin is not a terminal)` (exit 1, no mutation) |
| 1 | Utility refuses: missing typed phrase | ⚠ Covered by inspection at script lines 176-188; will be re-tested with a TTY in R4 |
| 2 | Dry-run produces manifest + count without deleting | ✅ Staging bucket = 47 objects / 68824703 bytes / Versioning=None, sample 20 objects listed, exit 0, no delete |

## Phase B exit criteria — APPROVED 2026-07-17 with TWO amendments (A-1 + A-2)

### A-1 (already folded) — backend CodeDeploy from LOCAL working tree

The team-lead's REVISION-REQUEST validated: G1 migration + instrument-templates + dynamic-
instruments source = uncommitted working-tree changes; last staging deploy (`d-HH2LFJIIK` =
I1-I3 hotfix `i123-20260711-084102.zip`) has an old Prisma client that selects
`archivo_completado` / `plantilla_archivo` (all dropped by G1). After R2 the old code would
500 on every ficha/instrument query.

Full **R5 BACKEND DEPLOY** phase added to the runbook:
- `npm ci && npm run build && npx prisma generate` (LOCAL working-tree build)
- Zip WITH `appspec.yml` at root / WITHOUT `dist/generated` or `src/generated`
- Upload `jul17-<TS>.zip` → `miempresa-artifacts-540657241795-staging/deployments/`
- `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging`
  (NEVER `miempresa-prod`)
- Wait for Succeeded → verify pm2 + `/api/v1/health`
- Re-verify credential architecture (refresh-credentials cron + pm2-reload stopgap + P0
  `awsCredentials.ts` provider) post-deploy

### A-2 (newly added) — S3 byte-level backup BEFORE wipe (Phase R3b)

A new **R3b** phase between R3 (manifest dry-run) and R4 (wipe) backs up the ACTUAL OBJECT
BYTES (not just the manifest). Recovery is then reproducible from the backups prefix alone.

```bash
$ aws s3 sync s3://miempresa-uploads-540657241795-staging \
    s3://miempresa-backups-540657241795-staging/pre-releases/s3-objects/uploads-staging-jul17/ \
    --profile disruptive --region us-east-1
# → (s3 sync output)
```

CHECKPOINT acceptance: `synced_objects == 47` AND `synced_bytes == 68824703` AND both
match the dry-run manifest count and size.

### Bucket-name clarification (validate before use)

The dev's approval note mentioned `miempresa-backups-540657241795` (unsuffixed) as the sync
target. **That bucket 404s** (`aws s3api head-bucket --bucket miempresa-backups-540657241795
--region us-east-1 --profile disruptive` → `An error occurred (404) when calling the
HeadBucket operation: Not Found`). The real staging backups bucket is the suffixed
`miempresa-backups-540657241795-staging` (which matches the `wipe-staging-s3.sh` default
and the jul-10 runbook). R3b uses the suffixed name.

Side note (does NOT change this runbook): `reset-staging-db.sh`'s default `BACKUP_BUCKET`
is the unsuffixed name (a long-standing bug). R2 invokes it with the env override
`BACKUP_BUCKET=miempresa-backups-540657241795-staging`.

## Run order with all amendments (FINAL)

R0 (read-only sanity) → R1 (no-op) → R2 (DB hard reset, destructive, locally-via-tunnel,
`BACKUP_BUCKET` env override) → R3 (S3 dry-run) → **R3b (S3 sync backup — A-2)** → R4 (S3 wipe,
destructive, typed confirmation) → R5 (BACKEND DEPLOY, destructive, working-tree build —
A-1) → R6 (frontend Amplify) → R7 (3-tier QA + dynamic-instruments smoke).

Once the developer approves:
- Phase C executes R2 → R7 in order (backup → S3 wipe → DB hard reset → frontend deploy → QA).
- Each phase ends with a `CHECKPOINT:` message carrying verbatim key output, then WAITs for
  `PROCEED PHASE R{N+1}:` from main before continuing.
- Rollback is staged in the runbook (DB restore + S3 manifest replay + Amplify re-deploy
  of prior job) — never auto-executed.

## NOT in scope (prod hard-refuse)

- No `*-prod-*` resource name in any command.
- No `prisma migrate diff --shadow-database-url` against any live DB.
- No `git commit` after release (per CLAUDE.md rules).
- No local-process kills.
- No enumeration against `miempresa-prod` CodeDeploy deployment group.
- No `disable` / `enable` / `delete` / `put-parameter --overwrite` actions.

## Run order (SCHEMA FIRST, CODE SECOND — corrected per REVISION-REQUEST)

R2 (DB hard reset, locally-via-tunnel) → R3 (S3 dry-run) → R4 (S3 wipe via typed-phrase
confirmation) → R5 (FRESH BACKEND CODE DEPLOY from local working tree) → R6 (frontend
Amplify) → R7 (canonical 3-tier QA + dynamic-instruments API smoke).

This ordering keeps each destructive step's blast radius minimal:

- If R2 fails: staging DB unchanged; only `pre-resets/pre-reset-staging-<TS>.sql.gz` in S3.
- If R4 fails: bucket unchanged (destructive branch aborted).
- **500-window between R2 and R5.6**: staging serves broken API for ~1-2 minutes while the
  new artifact lands + after-install.sh regenerates the Prisma client on-instance against
  the new schema. after-install.sh kills the OLD pm2 process and starts the NEW one in the
  same lifecycle hook — no orphan window. Mitigated by limiting smoke traffic during R5 to
  a single `/api/v1/health` call.
- R6 (frontend) and R7 (QA) are the last steps and have no destructive scope.

## Files referenced

- Runbook: `context/implementation-plan/staging-release-jul17-runbook.md`
- Progress report: `development/instrumentos-dynamic-fichas/tasks/W7-staging-release/progress-report.md`
- S3 wipe utility: `backend/infrastructure/scripts/wipe-staging-s3.sh`
- DB reset utility: `backend/infrastructure/db/scripts/reset-staging-db.sh`
- DB tunnel helper: `backend/infrastructure/db/utilities/db-tunnel.sh` (R2 SSH tunnel)
- Seed-qa pattern reference: `backend/prisma/test-db/seed-qa-staging.sh` (R2 env exposure)
- New migration: `backend/prisma/migrations/20260717045038_instrumentos_dynamic_fichas/migration.sql`
- Seed contract: `backend/prisma/seed.ts` (4 users + 1 empresa + 3 legacy + 6 dynamic + 6 v1 active versions)

## REVISION-REQUEST compliance — git evidence cited at the gate

I checked HEAD against the team-lead's claim BEFORE complying:

- `git ls-files --error-unmatch backend/prisma/migrations/20260717045038_instrumentos_dynamic_fichas/migration.sql`
  → "did not match any file(s) known to git" (file is uncommitted)
- `git ls-files backend/prisma/instrument-templates/` → empty (templates dir is uncommitted)
- `git rev-parse HEAD` = `a169460b5d468d7b973a82f6ed8b5fc76ac38392` (NOT `48029ef`)
- Last staging deploy = `d-HH2LFJIIK` = I1-I3 hotfix `i123-20260711-084102.zip`

The team-lead's premise was TRUE. Added full R5 backend-deploy phase.

---

**Send `PLAN-APPROVAL` to `main`. WAIT for developer approval before any mutating R-phase.**
