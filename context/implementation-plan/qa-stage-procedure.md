# QA Per Stage — Procedure & Current State

**Created**: July 3, 2026 · **Status**: ✅ Operational on staging (32/32 green)

## Manual login on a stage

Per-stage policy flag: **SSM `/miempresa/<stage>/qa/DEV_USERS_ENABLED`**.

- **staging** (`true`, developer-approved July 4, 2026): the well-known dev users work — `admin@miempresa.com` (ADMIN) and `empleado@miempresa.com` (EMPLEADO), password `<redacted>`. Provisioned by `backend/prisma/test-db/create-users-staging.sh` (idempotent; re-run it if passwords drift).
- **any stage without the flag** (e.g., prod): dev creds MUST fail — the QA suite's security canary asserts 401 for them. Use the dedicated QA user instead:

```bash
backend/prisma/test-db/get-qa-creds.sh --stage <stage>   # prints QA email/password + login URL from SSM
```

⚠ `<redacted>` on a public API is a deliberate, staging-only convenience tradeoff. Do NOT run `create-users-staging.sh --stage prod` without an explicit decision.
**Scope**: three-tier QA (DB, backend API, frontend browser) against a DEPLOYED stage
**Execution history**: [backend-lightsail-deployment-runbook.md](backend-lightsail-deployment-runbook.md) § QA PHASE

---

## 1. One-Command Entry Point

```bash
./scripts/qa-staging.sh --stage staging --profile disruptive
# exit code = number of failed tiers; per-tier detail printed inline
```

Runs, in order: **DB checks → backend API smoke → frontend browser e2e**. Works for any stage that has the standard SSM parameter tree (`--stage prod` once prod exists).

One-time prerequisite per stage (idempotent):

```bash
backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive
# creates SSM /miempresa/<stage>/qa/{QA_USER_EMAIL, QA_USER_PASSWORD} (generated SecureString)
# and upserts the QA admin user through an SSH tunnel (DB port 5432 is never public)
```

## 2. Design Decisions (developer-confirmed)

1. **Minimal QA seed** — one dedicated `qa@miempresa.com` ADMIN user, idempotent upsert, **no sample data, no wipes**. Full dev seed (`prisma/seed.ts`) is dev-only and now has a guard that refuses `miempresa_staging|prod` database names (`FORCE_SEED=true` to override) because it `deleteMany()`s everything first.
2. **Smoke + integration subset on live stages** — read-mostly; only the QA user's session is created. Full CRUD Playwright suites (`backend/tests/*`, `frontend/tests/e2e/*`) stay local-only so stages don't accumulate test records.
3. **Credentials/config from SSM only** — runners fetch `frontend/APP_URL`, `frontend/API_BASE`, `qa/*` from `/miempresa/<stage>/...`; nothing secret on disk or in git.

## 3. What Exists Per Tier

| Tier | Files | Checks |
|---|---|---|
| **DB** | `backend/prisma/test-db/db-staging-qa.sh` (runs on-instance via SSH), `seed-qa.ts`, `seed-qa-staging.sh`, `get-qa-creds.sh` | prisma migrate status clean; no stuck `_prisma_migrations`; ≥25 tables incl. `usuarios/empleados/clientes/sesiones/instrumentos/empresas`; `usuarios` login-contract columns + unique email index; QA user exists & active; **SSM password verifies against the DB bcrypt hash** (catches SSM↔DB credential drift) — **18 checks** |
| **Backend** | `backend/tests/staging/staging-smoke.spec.ts` + `run-staging-qa.sh` (Playwright API, `TEST_API_URL` pattern from `playwright.config.ts`) | health 200; origin-hardening not blocking via CloudFront; CORS preflight from the frontend origin with credentials; login 200 + HttpOnly/Secure cookie; wrong password 401; **dev-seed creds must be 401 on stages** (security + config-error canary); `/auth/me` authed + 401 unauthed; logout invalidates — **9 tests** |
| **Frontend** | `frontend/tests/staging/staging-login.spec.ts` + `run-staging-qa.sh` (Playwright browser, `TEST_FRONTEND_URL` pattern) | login page shell; SPA-fallback deep link → login redirect; **full login flow asserting the XHR hits the stage API with 200**; invalid-creds error; logout via real UI path (header toggle → sidebar button) — **5 tests** |

Related but separate: `backend/infrastructure/db/utilities/validate-instance.sh` covers the *infrastructure* layer (services, IAM, cron, PG tuning — 30 checks); the QA suite covers the *application* layer.

## 4. Stage-Specific Gotchas (bake into any new tests)

- Always target the **custom domains** (`miempresa-stg.disruptiveexp.com` / `miempresa-api-stg.disruptiveexp.com`). The session cookie is `SameSite=Strict` — same-site across those subdomains, **cross-site (login silently fails) on `*.amplifyapp.com`**.
- API access must go **through CloudFront** (it injects `x-origin-verify`); direct `IP:3001` returns 403 on everything except `/api/v1/health`.
- The sidebar is off-canvas by default — UI tests must click the header "Toggle menu" before touching sidebar controls.
- DB access from a laptop: SSH tunnel only (`backend/infrastructure/db/utilities/db-tunnel.sh`); pg_hba only allows localhost.

## 5. How to Expand

- **New backend smoke test**: add to `backend/tests/staging/*.spec.ts` — keep read-only or self-cleaning; env vars are already exported by the runner. Serial mode if it shares the session cookie.
- **New frontend flow**: add to `frontend/tests/staging/*.spec.ts` — reuse the QA user; follow selectors from the local suites (`frontend/tests/auth/login.spec.ts` is the reference).
- **New DB assertion**: extend the heredoc in `db-staging-qa.sh` (helper `q "SQL"` runs as postgres on-instance; `ok`/`bad` update the counters).
- **New stage**: nothing to change — provision QA user (`seed-qa-staging.sh --stage <s>`), then `qa-staging.sh --stage <s>`.
- **CI integration** (once the repo has a GitHub remote): call `scripts/qa-staging.sh` as a post-deploy job step; AWS creds + `npx playwright install chromium` are the only requirements.
- **Test data beyond the QA user**: prefer a new idempotent script in `backend/prisma/test-db/` over touching `seed.ts`; never add wipe logic aimed at deployed stages.
