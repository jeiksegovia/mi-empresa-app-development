# Prod releases

**Account**: `540657241795` · **Profile**: `disruptive` · **Region**: `us-east-1`
**Plan SSOT**: `context/implementation-plan/prod-deployment-plan.md`
**Re-anchor (read first in a new chat)**: `summary-2026-09-16-resume.md`

## How to log a release

- **Initial environment** (this folder, 2026-09-10): phase files `p0`–`p6` plus `2026-09-10-initial-deploy.md`.
- **Every later prod app deploy**: **one** dated file only, `YYYY-MM-DD-<slug>.md`, with commands run, actuals, learnings, stack state. Do not add a new `pN-*.md` per drop.

## Hard rules

- `--deployment-group-name miempresa-prod` only. Tag filter is **Environment=prod** (not Application).
- Never zip `src/generated/` or `prisma/prod-db/`.
- `appspec.yml` at zip root.
- Custom domain for login: `https://miempresa.disruptiveexp.com`.

## Live endpoints

| | Prod | Staging (must stay up) |
|---|---|---|
| FE | https://miempresa.disruptiveexp.com | https://miempresa-stg.disruptiveexp.com |
| API | https://miempresa-api.disruptiveexp.com | https://miempresa-api-stg.disruptiveexp.com |
| Origin | miempresa-api-origin.disruptiveexp.com → 44.195.227.44 | 54.144.25.72 |

## Releases

| Date | File | Notes |
|---|---|---|
| 2026-09-10 | `2026-09-10-initial-deploy.md` | First infra + app + seeds. CD tag-filter incident; staging restored. |
| 2026-09-11 | `2026-09-11-cert-paciente.md` | GERONTOLOGA POST `/updates` (drop ADMIN) + CONTRATOS patient email coerce. CD `d-6TMYLEHNL` / Amplify job 2. |
| 2026-09-17 | `2026-09-17-security-fixes.md` | Security fixes: per-env scoped IAM (legacy wildcard retired) + KMS scope + SecureString secrets + SSH admin-IP + upload authz/limits + hardening. CD `d-K57B8N7RL`. Prod SSM-delete incident recovered (params restored, DB untouched). |

Client passwords: `backend/prisma/prod-db/accounts-prod.md` (gitignored).
