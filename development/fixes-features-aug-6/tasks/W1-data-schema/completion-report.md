# W1 Completion Report — fixes-features-aug-6

## Summary
W1 (pt-data-schema) authored the cross-team contract, additive enum migration for
`TipoEmpleado`, and 2 new instrument templates. All 3 assigned tasks (id 1, 2, 3)
completed. CHECKPOINT message sent to team-lead after T1 so W2 (backend) and W3
(frontend) could begin in parallel.

## Deliverables

### 1. Contract (T1)
- `development/fixes-features-aug-6/orchestration-ctx/decisions/contract-fixes-features-aug-6.md`
  - §1 — `TipoEmpleado` enum: 4 values (GERONTOLOGA, CONTRATOS, **PROFESORES**, **AUXILIARES**)
  - §2 — DOMAIN_ACCESS matrix (4 tipos × 11 domains) with new `'read-only'` value,
    GERONTOLOGA.certificados false→true, identical rows for PROFESORES/AUXILIARES
  - §3 — `rolesPermitidos` rule: explicit ADMIN bypass, exact trimmed-upper token match,
    new-role tokens, create-default includes creator's tokens
  - §4 — Notes privacy: autor filter for PROFESORES/AUXILIARES LIST; PUT/DELETE 403
  - §5 — 2 instruments with full section/item IDs (SIGNOS_VITALES: 2 sections, patient
    header + repeatable vitals group; BOLETIN_ANUAL: 3 sections, patient header + 6
    free-text components + author)
  - §6 — Cross-cutting acceptance
  - §7 — Out of scope
  - §8 — File-by-file ownership table (W1/W2/W3)

### 2. Enum Migration (T2)
- `backend/prisma/schema.prisma` — added `PROFESORES` + `AUXILIARES` to `TipoEmpleado`
- `backend/prisma/migrations/20260806035159_add_tipoempleado_profesores_auxiliares/migration.sql` —
  2x `ALTER TYPE "TipoEmpleado" ADD VALUE IF NOT EXISTS` (idempotent)
- Applied via `npx prisma migrate deploy` against local `:15432` — clean
- Prisma client regenerated (`PROFESORES: 'PROFESORES', AUXILIARES: 'AUXILIARES'`
  in generated `index.js`)

### 3. Instrument Templates (T3)
- `backend/prisma/instrument-templates/SIGNOS_VITALES.v1.json`
  - 2 sections, scoring: none
  - paciente: 5 items (tipo_documento, documento_otro, nombre_completo, edad, sexo)
  - mediciones: 1 group-info (cellInput='text') with 7 columns (fecha_hora, o2,
    presion_arterial, fc, fr, temperatura, observaciones) × 1 row (medicion_1)
  - `rolesPermitidos: 'ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES'`
- `backend/prisma/instrument-templates/BOLETIN_ANUAL.v1.json`
  - 3 sections, scoring: none
  - paciente: 7 items (tipo_documento, documento_otro, numero_documento,
    nombre_apellido, periodo_anio, edad, sexo)
  - componentes: 6 long-text-info items (psicologia, deporte, terapia_ocupacional,
    fisioterapia, componente_social, concepto_enfermeria)
  - autor: 1 optional text-info (boletin_autor)
  - `rolesPermitidos: 'ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES'`
- Ran `npm run instruments:upgrade` — both templates validated, inserted and
  activated (v1, activo=true)

## Acceptance criteria — evidence

### AC1 — Contract covers items 1–5; W2/W3 can implement without reading schema/service for facts
✓ `contract-fixes-features-aug-6.md` §1–§5 enumerates enum, full matrix, rolesPermitidos
rule, notes privacy, and both instruments with exact item IDs. W2 and W3 implement
against this doc, not the schema/service files.

### AC2 — `npx prisma migrate status` clean local :15432; enum has 4 values; client regenerated
✓ `npx prisma migrate status` output:
```
Database schema is up to date!
```
✓ Enum values verified via SQL:
```
   unnest
-------------
 GERONTOLOGA
 CONTRATOS
 PROFESORES
 AUXILIARES
(4 rows)
```
✓ Prisma client regenerated; `PROFESORES` and `AUXILIARES` present in
`backend/src/generated/prisma/index.js`.

### AC3 — Both templates parse and validate; `npm run instruments:upgrade` inserts+activates
✓ `npm run instruments:upgrade` output excerpts:
```
  Found 14 validated template(s): …, BOLETIN_ANUAL@v1, …, SIGNOS_VITALES@v1, …
➕ BOLETIN_ANUAL Instrumento row created
➕ SIGNOS_VITALES Instrumento row created
➕ insert BOLETIN_ANUAL v1 (activo=true)
➕ insert SIGNOS_VITALES v1 (activo=true)
✓ BOLETIN_ANUAL v1 already active
✓ SIGNOS_VITALES v1 already active
✅ instruments:upgrade complete.
```
✓ Active version rows verified in DB:
```
     codigo     | roles_permitidos | version_numero | activo
----------------+------------------+----------------+--------
 BOLETIN_ANUAL  | ADMIN,EMPLEADO   |              1 | t
 SIGNOS_VITALES | ADMIN,EMPLEADO   |              1 | t
```
```
     codigo     | num_sections | scoring_total
----------------+--------------+---------------
 BOLETIN_ANUAL  |            3 | none
 SIGNOS_VITALES |            2 | none
```

## Contract items communicated to W2 / W3
- W2 must update `DOMAIN_ACCESS` matrix (extend `DomainAccessValue` union, add
  `read-only` branch in `requireDomain`, add PROFESORES/AUXILIARES rows, flip
  GERONTOLOGA.certificados false→true, extend MATRIX_TIPOS allow-list).
- W2 must fix `getInstrumentDefinition` (explicit ADMIN bypass, exact trimmed
  upper token match, new-role tokens) and the create-default `rolesPermitidos`
  to include creator's tokens.
- W2 may extend `instruments-upgrade.ts` to honor the template's `rolesPermitidos`
  field, OR run a post-upgrade SQL update to set the 2 new instrumentos'
  `roles_permitidos` to `'ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES'`.
- W2 must add notes LIST `autor = userId` filter for PROFESORES/AUXILIARES and
  PUT/DELETE 403 for those roles (the matrix `notas: 'create-only'` already
  blocks POST/PUT/DELETE at the `requireDomain` layer; LIST is the special case).
- W3 must mirror the matrix in `useDomainAccess.ts` (extend `DomainAccessValue`,
  add `isReadOnly`, add new rows, fix certificados, extend profile allow-list)
  and extend `TipoEmpleado` union in `shared/types/api.ts`.

## File-by-file summary of W1-changes
| File | Status |
|---|---|
| `development/fixes-features-aug-6/orchestration-ctx/decisions/contract-fixes-features-aug-6.md` | created |
| `development/fixes-features-aug-6/tasks/W1-data-schema/progress-report.md` | created |
| `development/fixes-features-aug-6/tasks/W1-data-schema/completion-report.md` | created |
| `backend/prisma/schema.prisma` | modified (enum TipoEmpleado +2 values) |
| `backend/prisma/migrations/20260806035159_add_tipoempleado_profesores_auxiliares/migration.sql` | created |
| `backend/prisma/instrument-templates/SIGNOS_VITALES.v1.json` | created |
| `backend/prisma/instrument-templates/BOLETIN_ANUAL.v1.json` | created |
| `backend/src/generated/prisma/` | regenerated (Prisma client) |

## Status
- **T1**: completed (contract published, CHECKPOINT sent)
- **T2**: completed (enum migration applied, client regenerated)
- **T3**: completed (2 templates authored, validated, inserted, activated)
- **W1 deliverables**: 100% ready for W2 + W3 implementation
