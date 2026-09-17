# Handoff: fixes-jul17-2 (2026-07-17) — COMPLETE, SHIPPED TO STAGING

## Delivered (all workers fresh, all validated independently, all SHUTDOWN)
| Worker | Deliverables |
|---|---|
| W9 backend | `TipoEmpleado.CONTRATOS` migration (#22), `domainAccess.ts` (matrix + requireDomain), route applications, tipoEmpleado in login/me, seed-qa trio rewrite (3 users + SSM + creds listing), R6 docs (checklist + OP-7 + reset reminder), crear-from-template service/route, 13 specs |
| W10 frontend | `useDomainAccess` + route middleware + sidebar/tab gating + 403 toast, crear template selector + sin-definición states, `InstrumentAuditView.vue` + dry-run dialog, 11 specs |
| W11 QA | 20 live tests (parity/live-profiles/crear-live/audit-dryrun-live), ficha-transitions fixture modernized, regression 114/0, gap report: 0 gaps |
| W12 release | Gated staging release: reset → first real seed-qa run → deploy `d-8E7JTGNMK` + Amplify job 9 → 23/23 QA. Runbook `staging-release-jul17-2-runbook.md` |

## Staging state
22/22 migrations; canonical seed + 3 QA users (qa-admin id=5, qa-gerontologa id=6, qa-contratos id=7)
with SSM SecureStrings; both domains 200; RBAC live-verified (contratos 200/403/200 probes);
legacy admin canary works (DEV_USERS_ENABLED=true).

## Developer login (fixed)
```bash
./backend/prisma/test-db/get-qa-creds.sh --stage staging   # prints all 3 profiles
# https://miempresa-stg.disruptiveexp.com/login (custom domain only)
```

## Run / verify locally
```bash
cd backend  && TEST_API_URL=http://localhost:3101 npx playwright test tests/rbac/ tests/instruments-dynamic/
cd frontend && TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1 \
               npx playwright test tests/rbac/ tests/instruments-dynamic/
```

## Deferred / follow-ups
1. **B34/B35** seed-qa-staging.sh hardening (portable bash syntax; put_param --overwrite) — small fix-up wave.
2. B32 TTY-guard on reset-staging-db.sh (from jul-17 cycle).
3. Pre-existing certificates filter 500 (unrelated ticket).
4. Working tree still uncommitted (both cycles) — commit only on explicit instruction.
5. Consider a fresh `context/resume-session/summary-2026-07-17.md` before next session break.
