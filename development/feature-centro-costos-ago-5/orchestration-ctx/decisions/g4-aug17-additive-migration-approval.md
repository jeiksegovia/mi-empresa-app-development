# Decision Record — G4: additive Aug-17 migration approved (local)

**Date**: 2026-08-18 · **Gate**: G4 · **Decided by**: developer
**Worker**: worker-4 · **Task**: 1 (T9) · **Migration**: `20260819025302_centro_costos_aug17_qa`

## Decision

**APPROVED** — apply to **local** `miempresa_dev` only (`miempresa-postgres` :15432). Staging is not in this approval.

## Evidence (orchestrator re-verified)

- 11 centros (including `Transporte`), 10 ítems
- `_prisma_migrations` latest was `20260818113726_add_nomina_bonos_and_registro_actividades` — worker applied nothing
- SQL additive only; `fecha` 3-step nullable→backfill→NOT NULL; `habilitar_recibo DEFAULT false`
- Original `20260805000000_centro_costos_ago5` untouched

## Follow-through

W4 applies migrate deploy, then Transporte rename + 3 inserts + resequence, updates the contract in place, then T10.
