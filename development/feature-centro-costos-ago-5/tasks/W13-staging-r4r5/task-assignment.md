# Task Assignment — W13 `pt-devops-infra` · R4+R5 (W12 replacement)

**Worker name**: `worker-13`  
**TaskList ID**: `8`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address `team-lead`, never `main`.**

R1 backup is **done and independently verified**. Developer approved **autonomous R4+R5** (gate 3). W12 idled and never created a deployment (latest still `d-YRWXPRH7L`).

**Do NOT send PLAN-APPROVAL. Do NOT wait. Start R4 immediately.**

Profile **`disruptive`**. Region **`us-east-1`**.  
**Never** `miempresa-prod`. Never auto-rollback.

---

## FIRST ACTION

```bash
pwd
```

Copy the **exact zip + CodeDeploy + Amplify sequence** from the last successful release:

`context/implementation-plan/staging-release-qa-session-aug-17-runbook.md`

and execute it for this tree. Also follow:

`context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` §R4 / §R5  
`development/feature-centro-costos-ago-5/tasks/W12-staging-r4r5/task-assignment.md` (acceptance checks)

---

## R4 must

- Working-tree zip, `appspec.yml` at root
- **Must contain** `backend/prisma/migrations/20260819025302_centro_costos_aug17_qa/`
- `aws deploy create-deployment` → group **`miempresa-staging` ONLY**
- After Succeeded: on-instance `prisma migrate status` = **30**, aug-17 applied
- Columns: `fecha`, `pagador`, `beneficiario_cliente_id`, `medio_pago`, `precio_unitario`, `habilitar_recibo`
- After API up: admin GET `/centro-costos` → **8 INGRESOS**, `Transporte completo`, **no** exact `Transporte`
- If seed wrong → `pm2 restart miempresa-api` (specific process, not pkill) and re-check. Still wrong → `BLOCKED:`

## R5 must

```bash
./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
```

Poll until SUCCEED. Fill smoke table in the runbook (health, catalog, CONTRATOS 403s, GERONTO 403, FE 200s).

## Write

Runbook R4/R5 actuals + `tasks/W13-staging-r4r5/completion-report.md`  
Then `COMPLETE:` with CodeDeploy id, Amplify job, migrations=30, catalog, smoke.

`TaskUpdate` 8 → completed only if migrate is 30 and smoke table is filled.
