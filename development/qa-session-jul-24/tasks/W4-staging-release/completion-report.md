# W4 Staging Release qa-jul-24 — Completion Report

**Task ID**: `7` · **Worker**: pt-devops-infra · **Slug**: `staging-release-qa-jul24`
**When**: 2026-07-31 (UTC) · **Profile**: `disruptive` · **Region**: `us-east-1`
**Authority**: replayed jul-22 runbook template, executed under team-lead's auto-chain PROCEED.

---

## Outcome

**PASS** — qa-session-jul-24 is LIVE on staging. Backend CodeDeploy `d-OJON0UVVK` Succeeded, migration `20260731203612_qa_jul24_cargos_efectivo_valormensual` applied; frontend Amplify job **12** Succeeded. All 7-item post-deploy smoke items pass; health 200. STAGING ONLY — `miempresa-prod` CodeDeploy group never targeted.

---

## Resources touched (staging only)

| Resource | Identifier | Note |
|---|---|---|
| CodeDeploy application | `miempresa-app` | (existing; both `miempresa-staging` and `miempresa-prod` groups exist — staging only) |
| CodeDeploy deployment | `d-OJON0UVVK` (group `miempresa-staging`) | Succeeded 2026-07-31T16:25:22-05:00 |
| Backend instance | `miempresa-backend-staging` @ `54.144.25.72` | running; on-instance `prisma migrate status` = 24 up to date |
| Backend artifact | `s3://miempresa-artifacts-540657241795-staging/deployments/miempresa-staging-jul24-qa-20260731-162402.zip` (919,367 B, sha256 `19fd0d11…`) | |
| Amplify deployment | `app d1nsxjyualdzdu / branch staging / job 12` | Succeeded 2026-07-31T16:26:15-05:00 |
| Frontend artifact | `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260731-162604.zip` (2.1 MB) | |
| Backup (R1 net) | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz` (31,219 B, sha256 `57a92e70…`, ETag `aedc5dfa…`) | Rollback safety net |
| Database | `miempresa_staging` at staging Lightsail (port 5432 closed publicly) | shipped migration via WT |

**NEVER touched**: `miempresa-prod` CodeDeploy group, prod SSM parameters, prod Lightsail, prod bucket.

---

## Phase summary

| Phase | Status | Actuals |
|---|---|---|
| **R0 preflight** | DONE | Staging at 23 mig, qa_jul24 pending, health 200, FE 200. Cargo risk-gate: 7 cargos / 2 contratos — GERONTÓLOGA 1, AUXILIAR DE ENFERMERÍA 1, 5 with 0 (would be deleted by migration step 4). CodeDeploy groups: `[miempresa-staging, miempresa-prod]`. Last deploy `d-WSU9IQ3QK` (jul-22). |
| **R1 backup** | DONE | SSH tunnel localhost:5433 → psql `miempresa_staging` → `pg_dump` → gzip → 31,219 B / sha256 `57a92e70…` → `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz`. Three-path size consistency (local ls = S3 ls = S3 head-object ContentLength = 31,219 B) ✓. |
| **R2 destructive reset** | SKIPPED | Additive release; destructive step IS the qa_jul24 migration (R4); R1 backup is the net. |
| **R3 seed-qa** | DONE | Idempotent upsert of qa-admin (id=5 ADMIN), qa-gerontologa (id=6 EMPLEADO/GERONTOLOGA), qa-contratos (id=7 EMPLEADO/CONTRATOS). No other rows touched. SSM creds at `/miempresa/staging/qa/qa-*/{EMAIL,PASSWORD}` (passwords never in runbook). |
| **R4 backend deploy + migration** | DONE | `npm ci` + `npm run build` → `dist/server.js`. Zip (appspec.yml at root) uploaded (919,367 B). `aws deploy create-deployment` → `d-OJON0UVVK` Succeeded. AfterInstall hook auto-applied qa_jul24 → 24 up to date. Post-migration: cargos=10 (target 10-item mixed-case canonical list), contratos=2 (both bound to `Temporal`), `EFECTIVO` enum present, `valor_mensual` nullable numeric present. Old upper-case cargos remaining=0. Health 200. |
| **R5 frontend Amplify + smoke** | DONE | `nuxt generate` 18 prerendered routes → zip (2.1 MB) → Amplify job **12 / SUCCEED**. 9-page custom-domain check (all 200) + default domain (200) + baked config (HTML exposes `https://miempresa-api-stg.disruptiveexp.com/api/v1`, matches SSM). |

---

## 7-item post-deploy smoke (ALL PASS)

| # | Item | Profile | Endpoint / check | Result |
|---|---|---|---|---|
| 1 | efectivo/llave create+edit | qa-admin | `PUT /employees/1` EFECTIVO → 200; NEQUI valid → 200; NEQUI invalid → 400 path:medioPagoNequi | ✓ |
| 2 | partial payment edit ADMIN+CONTRATOS RBAC | qa-admin / qa-contratos | `PUT /nomina/periodos/1` totalPagado=675000 → 200 ✓; qa-contratos same → 403 `Insufficient permissions` ✓ | ✓ |
| 3 | cargos block gone | DB + API | `old_cargos_remaining_count=0`, `temporal_count=1`, contratos.cargo.nombre=`Temporal` (both) | ✓ |
| 4 | pago preview | qa-admin | `POST /nomina/periodos` 201 + `GET /nomina?periodo=2026-07` returns empleados+contratoActivo+entrada | ✓ |
| 5 | asistencia CONTRATOS today-lock / ADMIN any-date + nota | qa-contratos / qa-admin | CONTRATOS today 200 / CONTRATOS yesterday 403 `NOT_TODAY` / ADMIN yesterday 200; nota persisted (max 500 char) | ✓ |
| 6 | contract valorMensual by tipo | qa-admin | `PUT /nomina/employees/1/contratos/2` {valorMensual:1300000, tipoContrato:TERMINO_FIJO} → 200, persisted | ✓ |
| 7 | nómina calc | qa-admin | `GET /nomina/periodos/1` → 200 (salario=675000 parcial, totalPagado=675000, contrato+empleado embedded, valorMensual branch respected) | ✓ |

---

## Acceptance criteria verification

| AC | Status | Evidence |
|---|---|---|
| 1. R0 runbook block written with verbatim staging row counts + migrate status + health | ✅ | `context/implementation-plan/staging-release-qa-jul24-runbook.md` §R0 actuals |
| 2. No mutating command before PROCEED (R0 read-only; R1+ gated) | ✅ | Progress report §R0; team-lead PROCEED at 21:24 triggered R1 + chain |
| 3. qa_jul24 applied on staging; 24 up to date; health 200 | ✅ | On-instance migrate status 24/24; health 200 at 2026-07-31T21:25:30 |
| 4. Frontend Amplify job succeeded | ✅ | Job 12 Succeeded 16:26:15 |
| 5. Post-deploy smoke of the 7 items passes on staging | ✅ | Smoke table above; all PASS |
| 6. Runbook is replayable | ✅ | R1 restore command + R4 build/zip/deploy pattern + R5 build/deploy pattern documented with verbatim actuals |

---

## Deliverables produced

1. **`context/implementation-plan/staging-release-qa-jul24-runbook.md`** — release runbook (R0–R5 + restore command + trap ledger + grep hooks).
2. **`development/qa-session-jul-24/tasks/W4-staging-release/progress-report.md`** — phase-by-phase log.
3. **`development/qa-session-jul-24/tasks/W4-staging-release/completion-report.md`** — this file.
4. **Backup**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz` (rollback net if needed).

---

## Known side effects (developer-visible on staging)

- 7 existing `cargos_empresa` rows (GERONTÓLOGA, AUXILIAR DE ENFERMERÍA, ADMINISTRADOR, OTRO, SERVICIOS GENERALES, COCINERA, ENFERMERA JEFE) deleted by qa_jul24 step 4; replaced by the canonical 10-item mixed-case list (Administrador, Artes y Manualidades, Auxiliar de Enfermería, Educador Físico, Fisioterapeuta, Gerontólogo/Gerontóloga, Psicólogo, Servicios Generales, Temporal, Terapeuta Ocupacional).
- Both staging `contratos` (id=1 OPS, id=2 TERMINO_FIJO, both for employee JAEKOV SEGOVIA) repointed to `Temporal` (cargo_id=12) per decision D1.
- New: `MedioPagoNomina` enum value `EFECTIVO`; nullable `contratos.valor_mensual DECIMAL(12,2)` column (existing rows kept NULL until updated via API).
- One staging contrato (`id=2`) valorMensual set to 1300000 + valorJornada nulled during R5 smoke (was 50000 before smoke). If a payroll calc ever runs for 2026-07 period, it will reflect these values; nominal periodo id=1 created with salario=1350000, later partial-paid to 675000 during smoke.
- Smoke reverted nothing destructive — staging now has a 2026-07 nomina periodo linked to contrato id=2, plus asistencia entries for today (2026-07-31) and yesterday (2026-07-30). If these matters for QA viewing, leave them; if not, the R1 backup at `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz` is the pre-smoke state — restore command in runbook R1.

---

## New trap ledger (B36+)

| ID | Phase | Issue | Mitigation | Permanent fix |
|---|---|---|---|---|
| B36 | R5 FE | `*.amplifyapp.com` default domain login rejected (CORS/cookie pinning) — only custom domain works | Always smoke auth against `miempresa-stg.disruptiveexp.com/login`, never `staging.d1nsxjyualdzdu.amplifyapp.com/login` | Document in deploy-frontend.sh header (already present) |

---

## Grep hooks (for future searches)

`staging-release-qa-jul24 qa-jul-24 qa_jul24 EFECTIVO MedioPagoNomina valor_mensual cargos_empresa Temporal d-OJON0UVVK d-WSU9IQ3QK amplify-job-12 contrato-cargo valorMensual RBAC NOT_TODAY OP-7 B36`

