# Task Assignment — W12 · Staging R4 + R5 (autonomous after backup)

**Worker**: `worker-12` (you just finished R1)  
**TaskList ID**: `8` then you may complete 8 after R5 smoke  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address `team-lead`, never `main`.**

Developer (2026-08-19): **PROCEED R4 and execute the rest of the deploy autonomously** (gate 3). Low risk. Check each phase, do not stop for extra human gates unless BLOCKED.

Profile **`disruptive`**. Region **`us-east-1`**.  
**Never** `miempresa-prod`. Never auto-rollback.

---

## FIRST ACTION

Read and **follow** the established pattern from:
- `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` §R4 / §R5
- `context/implementation-plan/staging-release-qa-session-aug-17-runbook.md` (last working-tree zip + CodeDeploy + Amplify)

Then execute R4, verify, then R5 + smoke. Fill the runbook as you go.

---

## R4 — backend (point of no easy return)

**Working-tree deploy** (aug-6 / aug-17 precedent). Zip **must** include:

- `appspec.yml` at zip root
- `backend/prisma/migrations/20260819025302_centro_costos_aug17_qa/`
- `backend/src/services/centroCostosService.ts`, `centroCostos.routes.ts`, `empresaService.ts` seed
- AfterInstall already runs `npx prisma migrate deploy` (do not invent a new hook)

Group: **`miempresa-staging` ONLY**.  
Artifact name pattern: `miempresa-staging-centro-costos-aug17-YYYYMMDD-HHMMSS.zip`  
Bucket: `miempresa-artifacts-540657241795-staging` (same as prior BE deploys).

After CodeDeploy **Succeeded**:

1. SSH: `npx prisma migrate status` → **30** migrations, up to date, includes `20260819025302_centro_costos_aug17_qa`
2. `\d centro_costos_items` has `fecha`, `pagador`, `beneficiario_cliente_id`, `medio_pago`
3. `\d centros_costos` has `precio_unitario`, `habilitar_recibo`
4. After API is up: GET `/centro-costos` as admin → **8 INGRESOS**, includes `Transporte completo`, **no** exact `Transporte`.  
   If catalog still 11 / still `Transporte` → seed did not run → `BLOCKED:` do not call R5 “done”. Restart via the **same pm2 process name** prior runbooks use (`miempresa-api`), not `pkill`.

QA creds: on-instance / SSM as prior (`qa-admin@miempresa.com` etc.) or `backend/prisma/test-db/get-qa-creds.sh --stage staging --profile disruptive --region us-east-1`.

Write R4 actuals (deployment id, zip name, migrate status, catalog query) into the runbook.

---

## R5 — frontend + smoke

```bash
./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
```

**Do not pass `--stage prod`.**

Poll Amplify job until SUCCEED. Then smoke (runbook table):

| Check | Expect |
|---|---|
| FE `/centro-costos` | 200 |
| FE `/` `/login` `/empleados` `/nomina` `/asistencia` | 200 |
| ADMIN GET `/centro-costos` | 8 INGRESOS, no exact Transporte |
| CONTRATOS GET `/centro-costos/balance` | 403 |
| CONTRATOS GET `/items?periodo=1999-01` | 403 |
| CONTRATOS POST `/centro-costos` | 403 |
| GERONTOLOGA GET `/centro-costos` | 403 `DOMAIN_FORBIDDEN` |
| Health API | 200 |

Optional if time: ADMIN POST one EGRESOS ítem with `fecha` today → periodo day-1.

---

## BLOCKED if

- CodeDeploy group is anything but `miempresa-staging`
- migrate status ≠ 30 or aug-17 missing
- seed catalog wrong after restart
- Amplify job FAILED

Do **not** auto-restore the dump. Report and wait.

---

## Write

- Runbook R4 + R5 actuals + smoke table + status COMPLETE
- `tasks/W12-staging-r4r5/completion-report.md` verbatim ids / commands

Then:

```
COMPLETE: R4+R5 done. CodeDeploy=<id> Amplify=<job> migrations=30. Catalog=8 INGRESOS. Smoke=<pass/fail>.
```

`TaskUpdate` 8 → completed only if smoke table is filled and migrate is 30.

Task 9 (staging QA worker) is a **deeper** smoke later — your R5 table is the minimum to close deploy.
