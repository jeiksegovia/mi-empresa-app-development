# Result — W5 staging release jul-10

## Outcome: ✅ COMPLETE (single attempt, all green)

**Delivered on staging**:
- 6 new Prisma migrations applied (14 → 20)
- 2 backfills verified (fecha_incidente, cargo_id SET NOT NULL held)
- Backend CodeDeploy `d-9CDIOTWHK` (267.6 KiB, 1 min 9 s)
- Frontend Amplify Job 4 (2.0 MiB, first attempt)
- 3-tier staging suite 33/33 green
- New endpoints + C1/C4/C6/E1/D7 features verified end-to-end against staging

## Artifact IDs
- Backend deployment: `d-9CDIOTWHK`
- Artifact: `s3://miempresa-artifacts-540657241795-staging/deployments/jul10-20260710-104847.zip` (267.6 KiB)
- Frontend release: `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260710-105056.zip` (2.0 MiB)
- Amplify Job: `4`
- DB backup: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul10.sql.gz` (16,862 bytes, SHA256 `91ef420ffd628130676588be46e39d7be4e43e5780950ef99a8af7d86855f273`, AES256)
- Git tag: `staging-jul10-snapshot` (WIP on 48029ef)

## Key outcomes
- migration risk gate cleared (LOW) thanks to sparse staging (empresas=0, contratos=0, notas_clientes=1)
- cargos_empresa ends empty on staging (no empresas to cross-join seed against) — predicted, verified, documented as L23
- pm2 restarted cleanly with new PID 454011 (was 376597), zero restarts, zero error log entries
- all new jul-9/jul-10 features live on staging: single-step ficha dialog, weekly vencimientos, /users ADMIN CRUD, uppercase transforms, cargo catalog endpoint

## Notable findings
- `jul10_contrato_cargo_not_null` migration is dev-tuned (hardcodes `empresa_id=6` lookup) — on staging with 0/0 it's a literal no-op; future staging state changes may require re-tuning. Documented as L24 + issue #2.
- `/users` has no DELETE route — soft-disable via PATCH activo:false is the supported pattern (L26).
- Contrato routes live under `/nomina/employees/:id/contratos` (L25), not at root.
- Single-step ficha requires `versionRegistro` (L27); was missing in first smoke attempt.

## Blockers / escalations
None.

## Verification commands (for the orchestrator to re-check)
```bash
# Backend deployment status
aws deploy get-deployment --deployment-id d-9CDIOTWHK --region us-east-1 --profile disruptive --query 'deploymentInfo.status' --output text
# → Succeeded

# Migration state on the instance
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"
# → 20 migrations found / Database schema is up to date!

# Public health
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-api-stg.disruptiveexp.com/api/v1/health
# → 200

# Frontend root + baked apiBase
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE 'miempresa-api-stg[^"]*' | head -1
# → miempresa-api-stg.disruptiveexp.com/api/v1
```
