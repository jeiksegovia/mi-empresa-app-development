# task-assignment — R3 seed-qa (OP-7)

## Role
**devops-infra**. Staging only. `disruptive` + `--region us-east-1`. NEVER prod.

## CWD
`/Users/jeik/ws/mi-empresa-app-development`

## Authorized
Developer **PROCEED PHASE R3** only. Do **NOT** start R4 CodeDeploy until `PROCEED PHASE R4:`.

## Context
- R2 done: 23 migrations, canonical seed, **qa users = 0**
- B34/B35 already fixed in `backend/prisma/test-db/seed-qa-staging.sh`
- Tunnel :5433 may still be up from R2 — reuse if alive

## Actions
```bash
export AWS_PROFILE=disruptive
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
# Prefer system /bin/bash (3.2-safe after B34) or default bash
./backend/prisma/test-db/seed-qa-staging.sh \
  --stage staging --profile disruptive --region us-east-1

./backend/prisma/test-db/get-qa-creds.sh \
  --stage staging --profile disruptive --region us-east-1
# Log emails + "password set" only — NEVER paste passwords into runbook
```

### Verify (tunnel psql)
```sql
SELECT id, email, rol, tipo_empleado FROM usuarios
WHERE email ILIKE 'qa-%' OR email ILIKE '%qa%' ORDER BY id;
```
Expect 3 profiles: qa-admin (ADMIN), qa-gerontologa (EMPLEADO+GERONTOLOGA), qa-contratos (EMPLEADO+CONTRATOS).

### Deliver
1. Fill runbook **R3 actuals** + checkpoint table
2. Append progress-report.md
3. SendMessage main:
   `CHECKPOINT: R3 complete. SSM qa-* present. Users: id/email/rol/tipo only. AWAITING PROCEED PHASE R4.`
4. **WAIT** for PROCEED R4

## Hard rules
No passwords in docs. No deploy. No prod. No auto-rollback.

Start R3 NOW.
