# F4 — Centro de costos CONTRATOS fecha lock (aug-27)

Implemented locally 2026-08-28. Staging R0–R5 COMPLETE 2026-08-27. Not committed (await git instruction).

## Behavior

- `empresas.limitar_fecha_contratos BOOLEAN NOT NULL DEFAULT false`
- **Off (default):** CONTRATOS can create/edit ítems on any date, list any month (July/August backfill). Still cannot delete ítems or mutate centros. Still cannot see balance.
- **On (ADMIN toggle on `/centro-costos`):** CONTRATOS create/edit only `hoy` or `día hábil anterior` (Colombia weekends + Ley Emiliani 2026–2027). List/GET locked to current Bogotá month again.
- ADMIN PUT `/empresa/:id` `{ limitarFechaContratos: true|false }`
- GET `/centro-costos/policy` returns `{ limitarFechaContratos, today, previousBusinessDay, allowed[] }`

## Tests (local)

`cd backend && TEST_API_URL=http://localhost:3101 npx playwright test tests/centro-costos --reporter=list` → **49 passed**.

`fecha-lock-switch.spec.ts` → **4/4** against QA seed (`admin@miempresa.com` / `qa-contratos@miempresa.com` / `password123`).

## Staging actuals (profile `disruptive`, us-east-1)

Never `miempresa-prod`. Group **`miempresa-staging` ONLY**. Custom domain only.

| Step | Actual |
|---|---|
| R0 | Health 200. Prior CodeDeploy `d-1G7ST2PDL` (certificados). On-instance 30 migrations. Column `limitar_fecha_contratos` absent. |
| R1 | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-f4-fecha-lock.sql.gz` · 44278 B · sha256 `5ca363f5224f7580deb600ebd925e0bcaa9c78601197fe04e051465cd74d6b43` |
| R4 | Zip `/tmp/miempresa-staging-f4-fecha-lock-20260828-005354.zip` 341702 B sha256 `eabafd1b88ac33116e6dccb2a55a61c91b1dc61305681b76ac9d3ce33c26d96f`. S3 `deployments/f4-fecha-lock-20260828-005354.zip`. CodeDeploy **`d-KBO6T5QDL` Succeeded** 2026-08-27T19:55:21-05:00. **31 migrations**. Flag **false**. GET `/policy` 200. |
| R5 | Amplify app `d1nsxjyualdzdu` branch `staging` **job 20 SUCCEED**. Zip `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260827-195603.zip`. Live chunk `/_nuxt/CLVoqw_5.js` contains `Limitar fechas CONTRATOS`. |

### Staging smoke

API (`TEST_API_URL=https://miempresa-api-stg.disruptiveexp.com`, SSM qa-admin / qa-contratos):

`backend/tests/centro-costos/fecha-lock-switch.spec.ts` → **4/4**.

UI (`TEST_FRONTEND_URL=https://miempresa-stg.disruptiveexp.com`):

`frontend/tests/centro-costos/fecha-lock-switch-ui.spec.ts` → **2/2**. ADMIN sees switch; CONTRATOS does not; month picker visible while lock off.

Post-smoke: `limitarFechaContratos=false` (afterAll restored). today `2026-08-27`, previousBusinessDay `2026-08-26`.

### Restore (R1 dump)

```bash
# Lightsail staging only. Never prod.
aws s3 cp s3://miempresa-backups-540657241795-staging/pre-releases/pre-f4-fecha-lock.sql.gz /tmp/pre-f4-fecha-lock.sql.gz --profile disruptive --region us-east-1
# then gunzip | psql against the staging DATABASE_URL from SSM. Do not run without explicit approval.
```

## Not this release

Commit / push. Prod. F1–F3 (already in `cca4dd7`, not pushed).
