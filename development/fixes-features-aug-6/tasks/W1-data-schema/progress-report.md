# W1 Progress Report — fixes-features-aug-6

## T1 — Contract (DONE 2026-08-05)
- Published `development/fixes-features-aug-6/orchestration-ctx/decisions/contract-fixes-features-aug-6.md`
- Covers: TipoEmpleado enum extension, DOMAIN_ACCESS matrix (4 tipos × 11 domains)
  with new `read-only` value, rolesPermitidos rule (explicit ADMIN bypass + exact
  trimmed upper token match), notes privacy (autor filter + PUT/DELETE 403 for
  PROFESORES/AUXILIARES), 2 instrument templates with full section/item IDs.
- CHECKPOINT message sent to team-lead.

## T2 — Enum Migration (DONE 2026-08-05)
- Edited `backend/prisma/schema.prisma` enum `TipoEmpleado`: added `PROFESORES` and
  `AUXILIARES` (additive — no row rewrites).
- Authored `backend/prisma/migrations/20260806035159_add_tipoempleado_profesores_auxiliares/migration.sql`
  with two `ALTER TYPE ... ADD VALUE IF NOT EXISTS` statements (idempotent).
- Applied via `npx prisma migrate deploy`. Verified `Database schema is up to date!`.
- Verified enum values in DB:
  ```
   unnest
  -------------
   GERONTOLOGA
   CONTRATOS
   PROFESORES
   AUXILIARES
  (4 rows)
  ```
- Regenerated Prisma client (`npx prisma generate`). Confirmed `PROFESORES` and
  `AUXILIARES` in generated `index.js` (`PROFESORES: 'PROFESORES', AUXILIARES: 'AUXILIARES'`).

## T3 — Instrument Templates (DONE 2026-08-05)
- Authored `backend/prisma/instrument-templates/SIGNOS_VITALES.v1.json`:
  - 2 sections (paciente, mediciones), scoring: none
  - paciente: 5 items (tipo_documento, documento_otro, nombre_completo, edad, sexo)
  - mediciones: 1 group-info item with cellInput='text', 7 columns, 1 row
- Authored `backend/prisma/instrument-templates/BOLETIN_ANUAL.v1.json`:
  - 3 sections (paciente, componentes, autor), scoring: none
  - paciente: 7 items (tipo_documento, documento_otro, numero_documento, nombre_apellido, periodo_anio, edad, sexo)
  - componentes: 6 long-text-info items (psicologia, deporte, terapia_ocupacional, fisioterapia, componente_social, concepto_enfermeria)
  - autor: 1 optional text-info item
- Both templates include top-level `rolesPermitidos: 'ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES'`
  per contract §3.4 (consumed by W2's extension to `instruments-upgrade.ts`).
- Ran `npm run instruments:upgrade`. Output confirms:
  ```
  ➕ BOLETIN_ANUAL Instrumento row created
  ➕ SIGNOS_VITALES Instrumento row created
  ➕ insert BOLETIN_ANUAL v1 (activo=true)
  ➕ insert SIGNOS_VITALES v1 (activo=true)
  ✓ BOLETIN_ANUAL v1 already active
  ✓ SIGNOS_VITALES v1 already active
  ✅ instruments:upgrade complete.
  ```
- Verified in DB (both active, v1):
  ```
       codigo     | roles_permitidos | version_numero | activo
  ----------------+------------------+----------------+--------
   BOLETIN_ANUAL  | ADMIN,EMPLEADO   |              1 | t
   SIGNOS_VITALES | ADMIN,EMPLEADO   |              1 | t
  ```
  (Note: `roles_permitidos = 'ADMIN,EMPLEADO'` is the upgrade script's default.
  W2's §3.4 contract task extends the upgrade script to honor the template's
  `rolesPermitidos` field; until then, the 2 new instrumentos can be filled by
  ADMIN+EMPLEADO callers and need a post-upgrade SQL update or the W2 extension.
  This is correctly handed off to W2 per the contract.)
- Verified JSONB stored matches contract sections/scoring:
  ```
       codigo     | num_sections | scoring_total
  ----------------+--------------+---------------
   BOLETIN_ANUAL  |            3 | none
   SIGNOS_VITALES |            2 | none
  ```
