# Progress Report — W5 staging release (jul-10)

**Task ID**: 32 · **Completed**: 2026-07-10
**Profile/region**: disruptive / us-east-1
**Instance**: 54.144.25.72

---

## Phase R0 — Preflight (READ-ONLY) — ✅ COMPLETE
See initial R0 section above for full data. Headline: migration risk = LOW (empresas=0, contratos=0, notas_clientes=1). CHECKPOINT sent; team-lead authorized R1→R5 autonomously.

## Phase R1 — IaC verify — ✅ COMPLETE (2026-07-10)
```bash
aws cloudformation deploy --template-file ...s3-stack.yml --stack-name miempresa-s3-staging ...
# → "No changes to deploy. Stack miempresa-s3-staging is up to date"
```
LastUpdated still 2026-07-05 → no drift. Idempotent no-op, matches jul-9 pattern.

## Phase R2 — DB backup — ✅ COMPLETE (2026-07-10)
- `/tmp/pre-jul10-migration.sql.gz` 16,862 bytes, SHA256 `91ef420ffd628130676588be46e39d7be4e43e5780950ef99a8af7d86855f273`
- Uploaded to `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul10.sql.gz`
- AES256 at rest. Pre-jul9.sql.gz (14,694 bytes) preserved alongside.

## Phase R3 — Backend deploy — ✅ COMPLETE (2026-07-10)
- **CodeDeploy `d-9CDIOTWHK`** with artifact `s3://.../deployments/jul10-20260710-104847.zip` (267.6 KiB, 1 min 9 s, Succeeded=1/Failed=0)
- All **6 new migrations applied** on the instance:
  - 20260710024539_jul9_additive_fields ✓
  - 20260710024613_jul9_nota_fecha_incidente ✓
  - 20260710024705_jul9_educacion_empleado ✓
  - 20260710024928_jul9_cargo_empresa ✓
  - 20260710100000_jul10_contrato_cargo_not_null ✓
  - 20260710100100_jul10_tipo_empleado ✓
- **Backfill verification (`psql` on instance)**:
  | Check | Result | Status |
  |---|---|---|
  | `notas_clientes.fecha_incidente IS NULL` | 0 (1/1 rows have value) | ✓ SET NOT NULL held |
  | `contratos.cargo_id IS NULL` | 0 (0 contratos total) | ✓ SET NOT NULL vacuous |
  | `cargos_empresa` row count | 0 | ✓ empty (0 empresas to seed against) |
  | `to_regclass('public.cargos_empresa')` | cargos_empresa | ✓ table created |
  | `to_regclass('public.educacion_empleado')` | educacion_empleado | ✓ table created |
  | `contratos` columns `cargo_id`,`archivo_firmado_url` | both present | ✓ columns added |
- PM2: `miempresa-api` online, restart_time=0, PID 454011 (was 376597 in R0)
- Public health: `https://miempresa-api-stg.disruptiveexp.com/api/v1/health` → 200 with new-build timestamp

## Phase R4 — Frontend deploy — ✅ COMPLETE (2026-07-10)
- **Amplify Job 4** (was job 3 in jul-9) — `s3://.../releases/20260710-105056.zip` (2.0 MiB), SUCCEED on first attempt
- `https://miempresa-stg.disruptiveexp.com/` → 200, baked apiBase = `miempresa-api-stg.disruptiveexp.com/api/v1` ✓
- SPA fallback `/certificados` → 200 ✓

## Phase R5 — Post-deploy QA — ✅ COMPLETE (2026-07-10)
- **qa-staging.sh**: 33/33 green (18 DB + 9 Backend API + 6 Frontend browser)
- **New jul-10 endpoints authed smoke**: 8/8 reachable (fichas/vencimientos, /users, /empresa/cargos, certificates/stats, instruments, nomina, patients, employees, auth/me)
- **Negative tests**:
  - Contrato sans cargoId via `/nomina/employees/5/contratos` → 400 with `cargoId:Required` validation ✓ (D7 enforced)
  - `/users` POST `rol=ADMIN+tipoEmpleado=GERONTOLOGA` → 400 "tipoEmpleado is only valid when rol=EMPLEADO" ✓ (C6 pairing rule)
  - `/users` POST `rol=EMPLEADO` → 201 with nombre/apellido UPPERCASE on create ✓ (E1 uppercase transform)
  - Test user cleaned via PATCH `activo:false` (no DELETE on `/users`)
- **Single-step ficha (C1 atomic)**: POST with `archivoCompletado` → 201 with `singleStepCompleted:true`, `estado:COMPLETADO` ✓
- **PM2 stability**: online, 0 restarts, 0 error matches in `pm2 logs --err`

## Strategy Request
(none — release went smooth on first attempt)

---

## Files produced
- `context/implementation-plan/staging-release-jul10-runbook.md` (full verbatim R0–R5 logs, issues/mitigations, learnings 22–27, rollback section, grep hooks)
- `development/next-release-jul-10/tasks/W5-staging-release/progress-report.md` (this file)
- `development/next-release-jul-10/tasks/W5-staging-release/result.md`
- `development/next-release-jul-10/tasks/W5-staging-release/completion-report.md`
- Git tag: `staging-jul10-snapshot` (WIP on 48029ef + dirty-tree WIP commit)
