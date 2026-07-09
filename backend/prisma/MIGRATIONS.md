# Prisma migrations — conventions

## Rule 1: never edit applied migration files
Once a migration has been deployed (CI or staging), editing its SQL breaks `prisma migrate status` and `migrate deploy`. The migration engine tracks each file's checksum; any drift causes the next deploy to fail. This was the F2 / DRIFT-1 incident.

If a fix is needed for an applied migration:
1. Add a new migration (`npx prisma migrate dev --name <fix>`).
2. Never edit the original file.

## Rule 2: idempotent guards for shared environments
Migrations applied to staging/prod must be safe under re-runs (operational DBAs sometimes re-apply). For `20260705*` and later:
- Wrap `CREATE TYPE` / `CREATE TABLE` / `ADD CONSTRAINT` in `DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$;` or use `IF NOT EXISTS`.
- F-series migrations (`20260701_f1_*`, `20260702_f2_*`, `20260703_f3_*`) are intentionally **one-shot** — they correct historical drift and must NOT use guards. The originals are preserved with their checksums.

## Rule 3: drift history lives here
When a column-not-null or data-correction is required after data has been written (e.g. the `tipo_certificado` SET NOT NULL fix in DRIFT-1), document the rationale in this file, not in the migration SQL header. Headers should stay terse.

## See also
- `context/implementation-plan/jul-4-improvements-db-schema.md` — schema intent
- `tasks/code-review-jul4/result.md` — review findings that motivated these rules