# W1 T1 — Progress Report

**Task ID:** `9`
**Worker:** pt-backend-eng
**Started:** 2026-07-09
**Backend port:** 3101 (PID to be verified each migration restart)
**DB:** `localhost:15432` / `miempresa_dev` (docker, dev — safe to mutate)

---

## Pre-flight findings

- **Live schema vs assignment:** `prisma/schema.prisma` matches the `48029ef` baseline referenced in the team plan; 14 migrations already applied locally (`20260709025844_add_certificado_update` is the latest).
- **Staging state:** confirmed healthy on the jul-9 release; local DB reflects it.
- **`Contrato.cargo` does not exist.** Live `\d contratos` shows: `contrato_id, empleado_id, tipo_contrato, fecha_inicio, fecha_fin, archivo_url, activo, created_at, updated_at` — no `cargo` column. The insights doc §D7 and task assignment both assume `cargo String → cargoId Int?` migration. **No `Contrato.cargo` data exists to backfill from.** `Nomina.cargo` exists (1 row) and the legacy `cargos.nombre_cargo` table has 12 rows, mostly playwright-generated (`P3 cargo 17…`), 2 real ones (`Gerente de Proyectos`, `Ingeniero de Software Senior`). This is documented as a DEVIATION in the D7 plan-approval packet.
- **`notas_clientes` data:** 4 rows, all with `fecha NOT NULL`. Backfill target is safe.
- **Backend health:** `:3101` returned 200.
- **`cargo` mapping source:** the assignment seed list (`Fisioterapeuta, Terapeuta Ocupacional, Educador Físico, Manualidades, Auxiliar de Enfermería, Auxiliar de Servicios Generales, Otro`) is taken as-is per the assignment's "adjust based on data" clause — no real data exists in `contratos` to cross-reference.

---

## Migration timeline

### M1 — `jul9_additive_fields` — additive nullable columns on existing tables

- **Status:** ✅ APPLIED 2026-07-10 02:45 UTC
- **Migration file:** `prisma/migrations/20260710024539_jul9_additive_fields/migration.sql`
- **Changed models:** `CertificadoUpdate` (+`comprobantePagoUrl`), `Cliente` (+`fechaCumpleanos`,+`eps`,+`tipoSangre` + new enum), `EducacionIdiomas` (`nivelEscritura` → nullable — was on idiomas, NOT empleado, so the assignment's "Empleado.nivelEscritura" wording was a name slip; corrected in deviation), `Empleado` (+`documentoIdentificacionUrl`), `Contrato` (+`archivoFirmadoUrl`).
- **Risk:** LOW — purely additive, no NOT NULL constraints, no FKs.
- **Verification:** `INFORMATION_SCHEMA` confirms the 6 new columns + enum exist; `nivel_escritura` now nullable; backend `/api/v1/health` returned 200.

### M2 — `jul9_nota_fecha_incidente`

- **Status:** ✅ APPLIED 2026-07-10 02:46 UTC
- **Migration file:** `prisma/migrations/20260710024613_jul9_nota_fecha_incidente/migration.sql`
- **Approach used:** declared `fechaIncidente DateTime` (required) in schema, ran `--create-only`, hand-edited SQL into 4 statements with idempotent guards (ADD nullable → UPDATE backfill from `fecha::date` → SET NOT NULL → CREATE INDEX guarded). Applied clean. Also added `@@index([fechaIncidente])`.
- **Backfill verification:** `SELECT COUNT(*), COUNT(fecha_incidente) FROM notas_clientes` → 4 / 4 (all 4 rows backfilled, zero nulls). Constraint enforced.
- **Schema ↔ DB parity:** yes — `prisma migrate status` returns "Database schema is up to date!".

### M3 — `jul9_educacion_empleado`

- **Status:** ✅ APPLIED 2026-07-10 02:47 UTC
- **Migration file:** `prisma/migrations/20260710024705_jul9_educacion_empleado/migration.sql`
- **New table:** `educacion_empleado` (`educacion_empleado_id, empleado_id, profesion, universidad?, fecha_graduacion?, diploma_url?, created_at, updated_at`), FK `empleado_id → empleados.empleado_id ON DELETE CASCADE`, index `empleado_id`.
- **Schema relation:** added `educacionEmpleado EducacionEmpleado[]` on `Empleado`. The existing legacy `EducacionIdiomas` model is untouched (kept alongside — different table, different semantics).
- **No backfill** — `Empleado` row count is small, and the legacy idiomas rows don't map cleanly to Educación rows (different schema). Frontend (W3) will let admins add Educación rows manually for each empleado.

### M4 — `jul9_cargo_empresa` — PLAN-APPROVAL GATE

- **Status:** ✅ APPLIED 2026-07-10 02:49 UTC
- **Migration file:** `prisma/migrations/20260710024928_jul9_cargo_empresa/migration.sql` (hand-edited for idempotent guards and seeded insert)
- **Plan approval:** orchestrator approved via in-conversation message; recorded at `orchestration-ctx/decisions/d7-cargo-migration-approval.md`
- **Deviation applied:** added `Contrato.cargoId Int?` only (no `cargo` column existed); 7 cargos seeded per existing empresa; cargo_id stays nullable (SET NOT NULL deferred to wave-3 UI ship).
- **Seed result:** 7 cargos in `cargos_empresa` for `empresa_id=6` (Mi Empresa S.A.S.)
- **Verification:** SELECT counts + is_nullable=YES for cargo_id, 2 FK constraints present, schema/DB in sync.

---

## State after M1-M3

- 17 migrations in `backend/prisma/migrations/` (was 14 at task start)
- Backend healthy on :3101 across all 3 migrations (verified after each `migrate dev`)
- Database: `miempresa_dev` at `:15432` — backfill complete, schema in sync
- Prisma client regenerated; `tsx watch` HMR picked up regen without crash
- No git commits made
- No staging/prod touched
- No `prisma migrate diff --shadow-database-url` used


---

## Acceptance checklist (rolled-forward per migration)

- [ ] `npx prisma migrate status` clean after each migration
- [ ] `curl http://localhost:3101/api/v1/health` → 200 after Prisma client regen
- [ ] Backend `tsx watch` picks up Prisma client change without crash
- [ ] Counts in DB match expected (fecha_incidente backfill = 4 of 4, cargos seeded per empresa)
- [ ] No shadow-database-url flag used (HARD BLOCKER)
- [ ] No pkill / generic signal sent to backend (targeted PID via `lsof`)
- [ ] No git commit made
- [ ] No stage/prod resource touched
