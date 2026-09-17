# Decision: cargos catalog delete+recreate — FK reassignment

Date: 2026-07-31 · Trigger: W1 TURNING-POINT-BREAKING (local DB QA-fixture state).

## Situation
- Local `miempresa_dev` (:15432): `cargos_empresa` has ONE row `id=42 'Auxiliar QA' (empresa_id=14)`;
  all **24 contratos** reference it. The jul9 seed's 7 cargos are absent.
- Migration replays on staging later (real contracts on cargos being removed/renamed, e.g. 'Otro').
- FK `contratos.cargo_id` is `onDelete: Restrict` → cannot delete a referenced cargo.

## Decision (developer, this session)
1. **Full delete+recreate** (strict D1): drop all existing cargos, insert the 10 target cargos,
   reassign **every** contrato to a single fallback cargo, then delete the non-target rows.
2. **Fallback cargo = `Temporal`**. All existing contracts (local 24 QA rows; and on staging, all
   contracts) get repointed to the empresa's `Temporal` cargo. Per-contract cargo semantics are
   intentionally not preserved — accepted by developer.

## Migration shape (per empresa, FK-safe ordering)
1. INSERT the 10 target cargos for each empresa — `ON CONFLICT (empresa_id, nombre) DO NOTHING`.
2. `UPDATE contratos c SET cargo_id = (SELECT id FROM cargos_empresa t WHERE t.empresa_id =
   (SELECT empresa_id FROM cargos_empresa WHERE id = c.cargo_id) AND t.nombre = 'Temporal')`
   — repoint every contrato to its empresa's Temporal cargo. (Verify no contrato left on a non-target cargo.)
3. `DELETE FROM cargos_empresa WHERE nombre NOT IN (<10 target names>)` — now unreferenced, safe.
4. Keep a safety `RAISE EXCEPTION` if any contrato still references a to-be-deleted cargo after step 2
   (defensive; should be zero).

## Target cargo list (exact strings)
Administrador, Auxiliar de Enfermería, Gerontólogo/Gerontóloga, Servicios Generales, Temporal,
Terapeuta Ocupacional, Fisioterapeuta, Psicólogo, Educador Físico, Artes y Manualidades.

## Staging note
At the deploy gate, W-verify must SELECT contract→cargo distribution BEFORE running (developer
already accepted that all staging contracts collapse onto Temporal). Never run against prod without approval.
