# Frontend Infrastructure — Nuxt Static + AWS Amplify Manual Deploy (No Git)

**Date**: July 3, 2026
**Status**: 📋 Planned — code phase (F0) first, AWS resources only after developer confirmation
**Scope**: **staging only** · profile `disruptive` · account 540657241795 · us-east-1
**Backend counterpart**: [backend-lightsail-infrastructure-cloudformation-v2.md](backend-lightsail-infrastructure-cloudformation-v2.md) · Execution log: [backend-lightsail-deployment-runbook.md](backend-lightsail-deployment-runbook.md)

---

## 1. Research Findings (verified July 3, 2026)

**Amplify manual deploys** ([AWS doc](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html)):
- Publish without a Git provider via: drag-and-drop zip, **S3 zip** (chosen — developer requirement), or public URL. Max 5 GB.
- ❗ **SSR apps are NOT supported** for manual deploys — static output only. Matches `nuxt generate`.
- ❗ The zip must contain the **contents** of the build output (`.output/public/*`), not the folder itself — otherwise "Access Denied" at the site root.
- ❗ S3-sourced deploys require the bucket to have **ACLs enabled** (`ObjectOwnership: ObjectWriter`). Modern buckets default to `BucketOwnerEnforced` (ACLs disabled) and fail with `AccessControlList` errors — the backend artifacts bucket can NOT be reused; the frontend gets its own ACL-enabled bucket.
- CloudFormation covers `AWS::Amplify::App` (no repository = manual-deploy app), `AWS::Amplify::Branch`, `AWS::Amplify::Domain`. The deploy itself is CLI (`aws amplify start-deployment`) — same "CFN for resources, scripts for actions" pattern as the backend.
- Custom domain: `disruptiveexp.com` lives in Route 53 in this account → Amplify auto-creates the verification + alias records; no manual DNS.

**Nuxt build verification** (ran locally):
- `NUXT_PUBLIC_API_BASE=https://miempresa-api-stg.disruptiveexp.com/api/v1 npx nuxt generate` ✅ succeeds — 15 routes, 5.1 MB, `200.html`/`404.html` present, and the API URL is **baked into the static bundle** (verified via grep in `.output/public`). Env-var-per-stage at build time is the config mechanism.

## 2. Decisions (confirmed by developer, July 3)

| Decision | Choice |
|---|---|
| Render mode | **`ssr: false`** (pure SPA) — auth-gated dashboard; all routes serve the shell, no prerendered empty authed pages |
| Backend CORS | Update live staging `CORS_ORIGIN` → `https://miempresa-stg.disruptiveexp.com,http://localhost:3100` via `set-env.sh --restart` |
| Topology | **One Amplify app per stage** (`miempresa-frontend-staging`, later `-prod`) — mirrors backend stack-per-stage |
| Domains | staging `miempresa-stg.disruptiveexp.com` · prod `miempresa.disruptiveexp.com` (deployed later) |

## 3. Architecture

```
Developer laptop / future CI                      AWS (profile disruptive)
─────────────────────────────                     ────────────────────────────────────────
deploy-frontend.sh --stage staging
  1. read API_BASE from SSM ────────────────────▶ SSM /miempresa/staging/frontend/API_BASE
  2. NUXT_PUBLIC_API_BASE=… nuxt generate           (value: https://miempresa-api-stg.…/api/v1)
  3. zip CONTENTS of .output/public
  4. aws s3 cp bundle.zip ──────────────────────▶ S3 miempresa-frontend-artifacts-…-staging
  5. aws amplify start-deployment ──────────────▶ Amplify app miempresa-frontend-staging
  6. poll get-job until SUCCEED                       └─ branch "staging" (manual deploys)
                                                      └─ Domain assoc → Route53 (auto):
                                                         https://miempresa-stg.disruptiveexp.com
Browser ──HTTPS──▶ Amplify CDN (static SPA)
   └── XHR ──HTTPS──▶ miempresa-api-stg.disruptiveexp.com  (existing backend; CORS updated)
                        └── PostgreSQL on same Lightsail instance (unchanged)
```

Tier separation stays clean: Amplify serves the frontend, Lightsail serves API+DB. Swapping any tier later = replace its stack + update the SSM URL params.

## 4. Deliverables

```
frontend/
├── nuxt.config.ts                      ✎ add ssr: false
└── infrastructure/
    ├── cloudformation/
    │   └── amplify-stack.yml           ★ per-stage stack:
    │       ├── ArtifactsBucket         (ACLs ENABLED — ObjectWriter, 90-day lifecycle, SSE)
    │       ├── AmplifyApp              (no repo, SPA rewrite rule → /index.html 200)
    │       ├── AmplifyBranch           (name = stage)
    │       ├── AmplifyDomain           (miempresa-stg.… / miempresa.… via IsProd condition)
    │       └── SSM /miempresa/<stage>/frontend/{API_BASE, APP_URL}
    └── scripts/
        ├── deploy-infrastructure.sh    ★ CFN stack deploy (--stage, --profile)
        └── deploy-frontend.sh          ★ SSM → generate → zip contents → S3 → start-deployment → poll job
```

Env var flow: SSM is the per-stage source of truth (`/miempresa/staging/frontend/API_BASE`), consumed at **build time** by `deploy-frontend.sh` — staging builds always point at the staging backend; prod at prod. Local dev keeps the `localhost:3101` default in `nuxt.config.ts`.

## 5. Execution Phases (staging)

- **F0 — Code** (no AWS): implement everything in §4 + `bash -n`, `validate-template`, re-verify `nuxt generate` with `ssr: false`. ✋ confirm diagram before F1.
- **F1 — Stack**: `deploy-infrastructure.sh --stage staging --profile disruptive` → app, branch, domain association (cert issuance a few min), bucket, SSM params. Cost: Amplify hosting ~$0 idle (pay per GB served/stored, pennies at this scale) + S3 pennies.
- **F2 — First deploy**: `deploy-frontend.sh --stage staging --profile disruptive` → job `SUCCEED`, site live on the default `amplifyapp.com` domain.
- **F3 — Integration**: verify `https://miempresa-stg.disruptiveexp.com` serves the SPA; update backend CORS (`set-env.sh --stage staging CORS_ORIGIN "https://miempresa-stg.disruptiveexp.com,http://localhost:3100" --restart`); browser-level smoke test: login page loads, API call from the deployed origin succeeds (no CORS error).

All commands, turning points, and learnings appended to the shared runbook under a **Frontend** section.

## 6. Out of Scope

Prod stage (template supports it; deploy later with approval) · CI/CD (blocked on repo hosting, same as backend Phase 5) · backend/DB changes beyond the one CORS parameter.
