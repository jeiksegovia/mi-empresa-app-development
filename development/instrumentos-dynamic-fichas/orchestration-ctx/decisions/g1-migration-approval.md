# Decision: G1 — destructive migration APPROVED WITH MODIFICATION (2026-07-17)

## Evidence (worker-2, local dev DB)
- instrumentos = 81 (legacy test fixtures; rows KEPT, only file columns dropped)
- registros_fichas_completadas = 126 (PENDIENTE 49 / COMPLETADO 48 / VENCIDO 29) — all reference
  legacy fixtures; none reference the 6 new contract codigos (not yet in DB)
- D2 (hard reset) was explicitly user-approved at intake → truncate of ficha rows is in scope.

## Hazard found in proposed plan
`TRUNCATE registros_fichas_completadas RESTART IDENTITY CASCADE` — `notas_clientes.registro_ficha_id`
is a nullable FK to this table. PostgreSQL TRUNCATE…CASCADE truncates the ENTIRE referencing table,
i.e. ALL patient notes (including ones unrelated to fichas) would be deleted. That exceeds D2 scope.

## Required modification (condition of approval)
Replace the CASCADE truncate with:
```sql
UPDATE notas_clientes SET registro_ficha_id = NULL WHERE registro_ficha_id IS NOT NULL;
TRUNCATE registros_fichas_completadas RESTART IDENTITY;
```
Verification required in completion report: `SELECT count(*) FROM notas_clientes;` BEFORE and AFTER
the migration — counts MUST be identical.

## Approved steps (with the modification)
1. Migration adds `instrumentos_versiones` + partial unique index
   `instrumentos_versiones_activo_unique (instrumento_id) WHERE activo = true`
2. Drops `plantilla_archivo`, `version_plantilla` (instrumentos), `archivo_completado` (registros)
3. Adds respuestas/puntaje_total(Float)/subtotales/clasificacion/instrumento_version_id per contract §3.3
4. Nullify-then-truncate as above (NO CASCADE)
Scope: LOCAL dev DB only. Staging replay happens in a future gated release cycle.
