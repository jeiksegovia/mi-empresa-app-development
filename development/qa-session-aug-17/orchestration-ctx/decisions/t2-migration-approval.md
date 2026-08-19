# Decision: T2 migration PROCEED

**Date:** 2026-08-18  
**Gate:** PLAN-APPROVAL from W1 `proposed-plan.md`

**Verdict:** PROCEED

**Why:** Additive only. `nomina_periodos.bonos` nullable (existing rows NULL). New empty `registro_actividades`. No drops, no enum changes, no NOT NULL on live columns. Matches contract §3 + §4 + §8.

**Constraints restated:** no `--shadow-database-url`; apply with `npx prisma migrate deploy` on local `:15432` only.
