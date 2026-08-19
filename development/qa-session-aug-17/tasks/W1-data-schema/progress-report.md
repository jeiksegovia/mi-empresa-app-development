# W1 progress — qa-session-aug-17

## Subtask 1 — Contract SSOT (Task 1)

**Status:** done · 2026-08-18

Published:
`development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md`

Covered:
- Domain `actividades` cells (PROFESORES/AUXILIARES `create-only`; GERONTOLOGA/CONTRATOS `read-only`)
- Service rules (own-item + today-only) documented as non-matrix
- CONTRATOS.empresa stays false; GET `/empresa/cargos` route exception
- `NominaPeriodo.bonos` Decimal(12,2) NULL; `BONOS_ALLOWED`; FIJO/INDEF formulas (aportes stored not added); OPS unchanged; OBRA = valorMensual
- Periodos POST/PUT → `requireEmployeeUnlocked('empleadoId')` (drop ADMIN role)
- `RegistroActividad` exact Prisma + @@unique([empleadoId, fecha]) + @@map
- API shapes + error codes (`DOMAIN_FORBIDDEN`, `EMPLOYEE_LOCKED`, `EMPLEADO_REQUIRED`, `DUPLICATE_DAY`)
- FE testids locked
- Seed users `profesor@` / `auxiliar@` / `password123`
- Migration SQL gist + down
- Deviations table D1–D10

## Subtask 2 — Schema + migration (Task 2)

**Status:** done · 2026-08-18 after PROCEED

### Evidence

```text
$ npx prisma validate
The schema at prisma/schema.prisma is valid 🚀

$ npx prisma migrate status   # before
Following migration have not yet been applied:
20260818113726_add_nomina_bonos_and_registro_actividades

$ npx prisma migrate deploy
Applying migration `20260818113726_add_nomina_bonos_and_registro_actividades`
All migrations have been successfully applied.

$ npx prisma migrate status   # after
Database schema is up to date!

$ npx prisma generate
✔ Generated Prisma Client (v6.19.2) to ./src/generated/prisma in 152ms

$ psql "$DATABASE_URL" -c "…bonos…" -c "…registro_actividades…" -c "…indexes…"
 bonos | numeric | 12 | 2 | YES
 registro_actividades
 registro_actividades_empleado_id_fecha_key
 registro_actividades_empleado_id_idx
 registro_actividades_fecha_idx
 registro_actividades_pkey
```

Artifacts:
- `backend/prisma/schema.prisma` — `bonos` + `RegistroActividad` + relations
- `backend/prisma/migrations/20260818113726_add_nomina_bonos_and_registro_actividades/migration.sql`
- `backend/prisma/migrations/20260818113726_add_nomina_bonos_and_registro_actividades/down.sql`

## Subtask 3 — Seed (Task 3)

**Status:** done · 2026-08-18

Extended `backend/prisma/seed.ts`:
- clean-slate: `registroActividad`, `asistenciaEmpleado`, `archivoNominaPeriodo`, `nominaPeriodo`, `contrato` before cargo/empleado/usuario
- creates Empleado `900000001` / `900000002` + users `profesor@miempresa.com` (PROFESORES) / `auxiliar@miempresa.com` (AUXILIARES) with `empleadoId` set

### Evidence (additive upsert against local :15432 — avoids full wipe)

```text
$ node --import tsx scripts/_tmp-seed-profesor-auxiliar.ts
{
  "profesor": {
    "email": "profesor@miempresa.com",
    "userId": 276,
    "empleadoId": 395,
    "tipoEmpleado": "PROFESORES"
  },
  "auxiliar": {
    "email": "auxiliar@miempresa.com",
    "userId": 277,
    "empleadoId": 396,
    "tipoEmpleado": "AUXILIARES"
  }
}
```

## SendMessage COMPLETE blocked

All three tasks are `completed` in TaskList. Completion-report is on disk.
Repeated `SendMessage(to: team-lead, message: "COMPLETE: …")` calls are being rewritten by the harness into `{type:"plan_approval_response", request_id:"schema-migration-t2", approve:true}` and rejected with "Only the team lead can approve plans".
T2 already received plain-text `PROCEED` from team-lead and was applied. Need orchestrator to clear the stuck plan-approval dialog so W1 COMPLETE can land (or treat TaskList completed + completion-report.md as the signal).

## Subtask 4 — worker-1-2 verify T2/T3 (2026-08-18)

**Status:** done · 2026-08-18

### Evidence (verbatim)

**1. schema.prisma shapes (lines 440, 475-492, 145, 51)**
- `NominaPeriodo.bonos Decimal? @map("bonos") @db.Decimal(12, 2)` ✓
- `RegistroActividad` exact (id/empleadoId/fecha/texto/registradoPor/createdAt/updatedAt + relations + `@@unique([empleadoId, fecha])` + `@@index([fecha)` + `@@index([empleadoId])` + `@@map("registro_actividades")`) ✓
- Back-refs: `Empleado.registrosActividad`, `Usuario.actividadesRegistradas @relation("ActividadRegistrador")` ✓

**2. `npx prisma migrate status`**
```
29 migrations found in prisma/migrations
Database schema is up to date!
```

**3. Live DB verification (read-only SELECT, no `prisma db seed`)**
- `nomina_periodos.bonos` → `numeric(12,2) YES` ✓
- `registro_actividades` table exists; `\d` shows PK + unique index on (empleado_id, fecha) + indexes on (fecha) and (empleado_id) ✓
- FKs: `empleado_id → empleados ON DELETE CASCADE`, `registrado_por → usuarios ON DELETE RESTRICT` ✓
- `_prisma_migrations`: `20260818113726_add_nomina_bonos_and_registro_actividades | applied = t` ✓

**4. seed.ts has profesor + auxiliar (lines 106-154)**
- Empleado `900000001` (profesor) + `900000002` (auxiliar) with `estado: 'ACTIVO'`
- Users `profesor@miempresa.com` (PROFESORES, empleadoId set) + `auxiliar@miempresa.com` (AUXILIARES, empleadoId set), password `password123`
- Console summary prints all 6 credentials

**5. DB users live (SELECT)**
```
 id  |         email          |   rol    | tipo_empleado | empleado_id
-----+------------------------+----------+---------------+-------------
 277 | auxiliar@miempresa.com | EMPLEADO | AUXILIARES    |         396
 276 | profesor@miempresa.com | EMPLEADO | PROFESORES    |         395
```

**6. `backend/scripts/_tmp-seed-profesor-auxiliar.ts`**
- Not present. Nothing to delete. No new tmp scripts added.

### Result
**MATCH** — all T2/T3 acceptance criteria verified against contract + live DB.
No re-migration performed. No product work invented.

verify-report.md written. Sending COMPLETE to team-lead.
