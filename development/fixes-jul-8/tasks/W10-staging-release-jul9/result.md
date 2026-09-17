# Result — Staging release jul-9

**Released to staging on 2026-07-09** · All phases R0–R5 ✅ · No rollback required · No prod touched.

## What shipped

| Layer | Identifier | Notes |
|---|---|---|
| **Backend artifact** | `s3://miempresa-artifacts-540657241795-staging/deployments/jul9-20260709-011123.zip` (235,550 bytes) | appspec at root, no `dist/generated` (after-install.sh creates it on-instance) |
| **CodeDeploy deployment** | `d-M8XBER0HK` (group `miempresa-staging`) | Succeeded in 1m 8s, 0 failed events |
| **Database migration** | `20260709025844_add_certificado_update` | Created `certificados_empresa_updates` + dropped DEFAULT on `certificados_empleado.updated_at` |
| **Frontend artifact** | `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260709-011350.zip` (2.0 MiB) | Built with API_BASE `https://miempresa-api-stg.disruptiveexp.com/api/v1` |
| **Amplify deployment** | Job ID 3 (branch `staging`, app `d1nsxjyualdzdu`) | Succeeded on first attempt |
| **Pre-release DB backup** | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz` (14.3 KiB) | SHA256 `ba4f8abd71062172b8d5c6c78525dea501c5e6766122efedf33d069a5cadf649` · SSE-AES256 |

## Verification snapshot

| Check | Result |
|---|---|
| Baseline HEAD | `48029efc0b46306d396f4763e0f4bef7644e4363` |
| `prisma migrate status` on staging | 14 migrations applied, schema up to date |
| Migration row: `20260709025844_add_certificado_update` | applied (finished_at NOT NULL) |
| Table `certificados_empresa_updates` exists on staging | ✓ (0 rows) |
| `pm2 jlist` for `miempresa-api` | online, restarts 0 |
| `https://miempresa-api-stg.disruptiveexp.com/api/v1/health` | 200 `{"status":"ok",…}` |
| `https://miempresa-stg.disruptiveexp.com/` | 200, apiBase points at staging API |
| Full 3-tier staging QA suite | **33/33** (DB 18, API 9, FE 6) |
| jul-8 endpoint authed smoke | all jul-8 surfaces 200 (8 endpoints) |
| `miempresa-s3-staging` CFN stack | UPDATE_COMPLETE, no drift |
| `miempresa-edge-staging` CFN stack | CREATE_COMPLETE (already deployed — no new stack) |
| Prod resources touched | **NONE** |

## Issues encountered & resolved (no new bugs opened)

| # | Phase | Issue | Resolution |
|---|---|---|---|
| 1 | R0 | Task said CodeDeploy app is `miempresa-api-staging`; reality is `miempresa-app` (matches jul-5) | Used `miempresa-app` for R3 create-deployment |
| 2 | R0 | Task said SSM path is `/miempresa/staging/api/DATABASE_URL`; actual is `/miempresa/staging/db/DATABASE_URL` | Used the correct path; no functional impact |
| 3 | R5 | Smoke loop hit `GET /fichas` → 404 | Expected — fichas are nested at `/patients/:id/fichas`, not a top-level resource |
| 4 | R5 | Smoke loop hit `GET /patients/1/fichas` → 404 | Expected — no GET list route; `POST/PATCH/DELETE` exist, plus `GET /patients/:id` returns `registrosFichas` inline |

Learnings logged L19–L21 in the runbook.

## Rollback readiness (not used)

- Frontend: re-deploy prior Amplify job OR `aws amplify start-deployment` referencing `releases/20260705-223123.zip`.
- Backend: re-deploy `s3://miempresa-artifacts-540657241795-staging/releases/manual-jul5.zip` via the same `create-deployment` parameters — safe because `certificados_empresa_updates` is additive and old code never reads it.
- Database: restore from R2 backup (14.3 KiB) if both above need rollback AND new migration must be reverted. **LAST RESORT** — data written post-2026-07-09 06:05 UTC is lost.

## Handoff artifacts

- `context/implementation-plan/staging-release-jul9-runbook.md` — complete runbook with verbatim commands + outputs for R0–R5 + rollback + learnings
- `development/fixes-jul-8/tasks/W10-staging-release-jul9/progress-report.md` — per-phase execution log
- `development/fixes-jul-8/tasks/W10-staging-release-jul9/completion-report.md` — phase summary + status
- `development/fixes-jul-8/tasks/W10-staging-release-jul9/result.md` — this file
