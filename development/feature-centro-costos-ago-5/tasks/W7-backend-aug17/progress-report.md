# W7 (pt-backend-eng) — Aug-17 centro-costos progress (replacement for W4)

## T9 — schema + seed + contract (G4 already approved by orchestrator)

### Pre-deploy migration check (verbatim, 2026-08-18)

```
                      migration_name
----------------------------------------------------------
 20260818113726_add_nomina_bonos_and_registro_actividades
 20260806035159_add_tipoempleado_profesores_auxiliares
 20260805000000_centro_costos_ago5
 20260804165919_add_empleado_bloqueado
 20260803022244_add_empleado_eps_fondo_arl
```

`20260819025302_centro_costos_aug17_qa` was **absent** → applied.

### Migration applied

```
Applying migration `20260819025302_centro_costos_aug17_qa`

migrations/
  └─ 20260819025302_centro_costos_aug17_qa/
    └─ migration.sql

All migrations have been successfully applied.
```

### T9 status

- [x] Migration applied (no AWS, no `--shadow-database-url`, no edit of `20260805000000_centro_costos_ago5`)
- [x] Schema columns verified: `centro_costos_items` has `fecha, pagador, beneficiario_cliente_id, medio_pago`; `centros_costos` has `precio_unitario, habilitar_recibo`
- [ ] `applyAug17SeedFix()` helper + DEFAULT_CENTROS_COSTOS updated to 14-row catalog
- [ ] Idempotency check (run twice; second no-op)
- [ ] Contract updated in place
- [ ] T9 acceptance commands captured