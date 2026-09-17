# Task Assignment — W14 `pt-test-quality` · Staging smoke QA

**Worker name**: `worker-14`  
**TaskList ID**: `9`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address `team-lead`, never `main`.**

Staging **R4+R5 already deployed** and independently gated:

- CodeDeploy **`d-IUQUHA58L`** Succeeded, group `miempresa-staging`
- Amplify **job 17** SUCCEED
- Migrations **30**, catalog **8 INGRESOS**, no exact `Transporte`
- Lead already confirmed: CONTRATOS balance/1999/POST centro 403; GERONTO 403 `DOMAIN_FORBIDDEN`

Your job is the **deeper** live smoke (task 9), not another deploy.

---

## FIRST ACTION

```bash
pwd
```
`TaskUpdate` task `9` → `in_progress`.

URLs:
- API `https://miempresa-api-stg.disruptiveexp.com/api/v1`
- FE `https://miempresa-stg.disruptiveexp.com` (**custom domain only**)

Creds: `backend/prisma/test-db/get-qa-creds.sh --stage staging --profile disruptive --region us-east-1`

Contract: `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md`

**Do not** CodeDeploy, migrate, or edit product source. Read-only except creating **one** EGRESOS test ítem you then **delete**.

Never `miempresa-prod`. AWS profile only if you need creds script (`disruptive`).

---

## Cover (live)

| ID | Check |
|---|---|
| R18 | 8 INGRESOS D12 names; no exact Transporte; EGRESOS 6 |
| R21 | CONTRATOS cannot POST/PUT/DELETE centro |
| R22 | CONTRATOS no `/balance`; `/items?periodo=` non-current 403 |
| R24 | ADMIN POST EGRESOS `{fecha: today Bogotá}` → periodo `YYYY-MM-01`; then DELETE the ítem |
| R25–26 | INGRESOS missing pagador → 400; unpriced centro → 400 `precioUnitario` (most seed centros still unpriced except any already set) |
| R31 | GET `/items/:id` 200 shape; CONTRATOS GET historical (1999 if you create then delete, or any non-current) 403 |
| D14 | CONTRATOS GET item current month 200 |
| FE | `/centro-costos` 200; `/login` 200. Optional Playwright against custom domain if FE e2e env works; otherwise curl+note TEST-ENV if cookies need host match |
| Regression pages | FE 200: `/empleados` `/nomina` `/asistencia` `/pacientes` |

Classify every fail BUG / TEST-ENV / FLAKE.

---

## Write

- Fill remaining smoke rows in `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` if anything new
- `tasks/W14-staging-qa/completion-report.md` + `gap-report.md` (empty “none” if clean)

`COMPLETE:` with pass/fail counts. Then idle — lead will shutdown.
