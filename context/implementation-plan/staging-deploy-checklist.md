# Staging Deploy Checklist (reusable — fixes-jul17-2 §2.2)

> **Source of truth for what a clean staging deploy looks like after a destructive reset.**
> This is the short, reusable counterpart to the full `staging-release-jul17-runbook.md`
> R-phases. Use this checklist every time you bring staging back up; the long runbook is
> the gate-by-gate recipe, this is the punch-list.

## Pre-deploy (local — read-only)

- [ ] Working tree clean (or committed to a release branch).
- [ ] `npm run typecheck` green.
- [ ] Local DB on `localhost:15432` is current: `npx prisma migrate status` shows no drift.
- [ ] Smoke spec `tests/rbac/domain-access.spec.ts` green locally.

## Deploy (run from local checkout)

- [ ] `npm run build` — backend bundle compiles.
- [ ] CodeDeploy: `d-<DEPLOY_ID>` runs and exits Succeeded.
- [ ] `/api/v1/health` returns `{"status":"ok"}` on the staging instance.

## DB migrate + seed

- [ ] `npx prisma migrate deploy` against staging — replays forward-only migrations.
- [ ] `npm run db:seed` — recreates 4 dev users + 1 empresa + 3 legacy + 6 dynamic
  instruments (active v1 per instrument).

## ★ QA users (REQUIRED — idempotent)

`db:seed` does **NOT** create the dedicated QA users. The 3 QA users (qa-admin /
qa-gerontologa / qa-contratos) are required for the W9 RBAC matrix to be exercisable
on staging.

- [ ] Run `./backend/prisma/test-db/seed-qa-staging.sh --stage staging \
    --region us-east-1 --profile <aws-profile>`
- [ ] Confirm the script prints 3 ✓ lines (one per profile) with non-`null` ids.
- [ ] Run `./backend/prisma/test-db/get-qa-creds.sh --stage staging \
    --profile <aws-profile>` and capture the 3 profiles (stage, URL, email, password).

## Canary QA

- [ ] Log in to staging as `qa-admin` (ADMIN, full access) — landing page renders.
- [ ] Log in as `qa-gerontologa` (EMPLEADO+GERONTOLOGA) — see pacientes/instrumentos;
  expect 403 on `/nomina`, `/employees`, `/empresa`.
- [ ] Log in as `qa-contratos` (EMPLEADO+CONTRATOS) — see empleados/nomina/certificados;
  expect 403 on `/instruments`, `/pacientes` PUT, `/pacientes` DELETE; expect POST
  `/pacientes` to succeed.
- [ ] Capture screenshots / Postman responses in the active runbook (R-phase section).

## Rollback hooks (if QA fails)

- [ ] If a regression surfaces, do NOT auto-rollback — page the orchestrator.
  Rollback options: redeploy prior CodeDeploy revision (read CodeDeploy console),
  re-seed DB only if the schema-level changes are suspect.
