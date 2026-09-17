# Fixes — Aug 04, 2026: contrato test flake + RBAC stale-session

Two items validated & fixed. Grep hooks: contrato-fecha-fin OBRA_O_LABOR postBody stale-session domain-access sessionToken auth.routes qa-gerontologa qa-contratos DOMAIN_FORBIDDEN Lightsail

## Task 1 — jul-24 contrato-monthly FE test timeout (FIXED)

**Symptom**: `jul24-qa-frontend-contract-monthly.spec.ts` test #5 ("Saving an OBRA_O_LABOR contrato sends valorMensual") timed out on `expect.poll(() => postBody != null)`.

**Root cause (TEST DEFECT, not app bug)**: `saveContrato()` (`empleados/[id]/editar.vue:511`) short-circuits with a "Fecha fin requerida" toast and fires **no request** when a non-`TERMINO_INDEFINIDO` contract has a blank `fechaFin`. The test never filled `fechaFin`, so no POST fired → `postBody` stayed null. Tests #2–4 passed because they only assert field *visibility*, not save.

**Fix**: test-only — fill the required `contrato-fecha-fin` (`2027-12-31`) before save so the POST fires and the test verifies its real target (OBRA payload sends `valorMensual`, clears `valorJornada`). Result: **5/5 pass**. App behavior unchanged (requiring fecha fin for OBRA is correct).

## Task 2 — "contratos" role blocked from empleados edit until re-login (FIXED)

**Symptom**: user reported being blocked from `/empleados/[id]/editar` with an access-denied toast right after login, then gaining access after a second login.

**Analysis (RBAC is correct; this is session-freshness)**:
- QA roles (`seed-qa.ts`): `qa-admin`=ADMIN/`tipoEmpleado:null` (full access, un-blockable by matrix); `qa-gerontologa`=EMPLEADO/GERONTOLOGA (`empleados:false`); `qa-contratos`=EMPLEADO/CONTRATOS (`empleados:true`).
- The ONLY profile with `empleados:false` is GERONTOLOGA → a block on `/empleados` means the effective identity was **GERONTOLOGA** (a stale/previous session).
- Client-side gate `domain-access.global.ts` reads the in-memory Pinia identity (`useDomainAccess().can`). A leftover profile from a prior login gated the new user until a fresh login overwrote it.

**Staging log evidence** (read-only SSH via `~/.ssh/miempresa-lightsail-key.pem` to Lightsail `miempresa-backend-staging` 54.144.25.72, `~/.pm2/logs/miempresa-api-out-0.log`):
- **Zero `403`/`DOMAIN_FORBIDDEN` on any `/employees` route** — all employees requests `200`. The block never reached the backend → it was **client-side**.
- Auth timeline 2026-08-04: login qa-gerontologa 14:10 → /auth/me 401 (churn) → login qa-contratos 14:32 → … → login qa-admin 15:26 → /employees/* all 200. A gerontologa login preceding contratos/admin logins is the stale-identity source. (morgan logs method/url/status, not emails — so the *absence* of employees 403 is the proof, not a per-user line.)

**Fix (minimal, FE session-flush + dead-code cleanup — developer-approved)**:
1. `frontend/app/stores/auth.ts` `login()`: reset `user`/`empresa`/`isAuthenticated` at the **start** of login, so a stale identity can never survive into the new session (the client gate then reads only the fresh login response). `logout()` already flushes store + server session + cookie (`credentials:'include'`, matching `clearCookie` options).
2. Deleted dead duplicate `backend/src/routes/auth.routes.ts` (set/cleared cookie `sessionToken` while the live `routes/auth.ts` — mounted via `routes/index.ts` — uses `session`; a latent landmine if the mount ever switched). Unreferenced; backend typecheck clean after removal.

**Validation**:
- Backend `tsc --noEmit` clean.
- FE `rbac/nav-gating.spec.ts` 5/5 pass (GERONTOLOGA hidden, CONTRATOS visible, ADMIN all, forbidden redirect).
- `auth/login.spec.ts` 2 failures are **pre-existing** (fail identically with the change stashed; backend `/auth/login` returns 200 via curl) — env/test issue, not this change.

**Not changed**: RBAC matrix, cookie `sameSite` policy, backend 403 logging (offered, not selected).

## Deploy
Task 2 backend change (file deletion) is behavior-neutral; ships in the next CodeDeploy artifact. FE change ships via Amplify. Git commit + staging deploy pending explicit user request.
