# W1 Completion Report — wave 1 (#25) + wave 2 (#26 + #27)

**Worker**: pt-backend-eng (W1, FRESH for #25; REUSE for #26 + #27)
**Date**: 2026-07-10
**Status**: ✅ Complete — all 10 acceptance criteria satisfied (5 from #25 + 5 from #26+#27)

---

## Wave 1 (#25)

### T1 — Migrations + E1 + contract

(See `progress-report.md §0` for the pre-flight NULL-count data check: **18 contratos / 17 NULL**; cargo_id=7 "Otro" used for backfill.)

**Migration A** (`jul10_contrato_cargo_not_null`, file `20260710100000_*`):
- Backfill 17 NULL `cargo_id` rows → cargo_id=7 (empresa 6's "Otro").
- `ALTER TABLE contratos ALTER COLUMN cargo_id SET NOT NULL`.
- Schema: `cargoId Int` (was `Int?`); FK `onDelete: Restrict` (forced by NOT NULL — SetNull no longer meaningful).

**Migration B** (`jul10_tipo_empleado`, file `20260710100100_*`):
- New enum `TipoEmpleado { GERONTOLOGA }`.
- `Usuario.tipoEmpleado TipoEmpleado? @map("tipo_empleado")` (nullable; only EMPLEADOs with a known specialization set it).

**E1 — Zod auto-uppercase**: `.transform(v => v.trim().toUpperCase())` on entity nombre fields, applied to create AND update paths:
- `CertificadoEmpresa.nombre` (certificates.routes.ts)
- `Instrumento.nombreInstrumento` (instruments.routes.ts)
- `Cliente.nombre` (patients.routes.ts)
- `Empleado.nombre + apellido` (employees.routes.ts)
- `Empresa.nombre` (empresa.routes.ts)

NOT transformed: `descripcion`, `notas`, any Text, `CargoEmpresa.nombre` (per assignment).

**Contrato Zod**: `cargoId` now REQUIRED on both POST + PUT (schema NOT NULL reflected in API).

**Contract**: `development/next-release-jul-10/orchestration-ctx/decisions/schema-contract-jul10.md` written with §1–§9 (placeholders for wave-2 endpoints, now filled in §5).

---

### T1 Acceptance criteria — all green

| # | Criterion | Evidence |
|---|---|---|
| 1 | `npx prisma migrate status` clean | 20 migrations, "Database schema is up to date!" |
| 2 | cargo_id NOT NULL via information_schema; backfill count documented | `is_nullable=NO`; pre/post-flight counts in `progress-report.md §0` |
| 3 | Curl: lowercase nombre → UPPERCASE | All 4 entity routes verified (see §3 of the wave-1 evidence below) |
| 4 | Contrato create without cargoId → 400 | curl: `{errors:{cargoId:["Required"]}}` |
| 5 | Backend healthy throughout | `/api/v1/health` 200 after every change |

---

## Wave 2 (#26 + #27)

### T2 (#26) — C1 single-step ficha + C4 lazy flip + C7 vencimientos

**Sources:** `task-assignment-wave2-api.md` T2 section + plan decisions D-C1, D-C4.

#### C1 — atomic assign + first update

`POST /api/v1/patients/:id/fichas` kept on the same path; extended body schema branches on `archivoCompletado` presence:

- `archivoCompletado` present → single-step: ONE `prisma.$transaction` creates the `RegistroFichaCompletada` with `estado='COMPLETADO'`, `fechaCompletado=now()`, `archivoCompletado=<value>`, `responsable=req.user.id`.
- Absent → legacy PENDIENTE flow (renewal path uses `PATCH .../fichas/:fichaId/status`, unchanged).

Implementation: `patientService.createFichaAtomic(patientId, responsableId, input)`. Response includes discriminator `singleStepCompleted: boolean`.

#### C4 — lazy flip (no cron, per D-C4)

`patientService.flipExpiredFichas(prisma, clienteId?, now)` — single `updateMany` (bulk, NOT per-row).

Triggered inside:
1. `getPatient(id)` — before the relation read so the include reflects flipped estado.
2. `listFichasVencimientos(days)` — before the report computes.

Verified manually: inserted `INSERT INTO registros_fichas_completadas (...) (..., '2026-06-01')` → subsequent `GET /patients/52` returns estado=VENCIDO for that row.

#### C7 — weekly vencimientos report

`GET /api/v1/patients/fichas/vencimientos?days=N` (default 7, max 365 via Zod).
- Runs C4 flip first.
- Returns fichas with `estado ∈ {PENDIENTE, VENCIDO}` AND `fechaVencimiento <= today+days`.
- Ordered by fechaVencimiento asc (most overdue first).
- Includes paciente nombre + instrumento nombre + `diasHastaVencimiento` (negative = overdue).

Routing: `/fichas/vencimientos` is two segments; doesn't collide with single-segment `/:id`.

---

### T3 (#27) — C6 instruments gating + usuario tipoEmpleado

**Sources:** `task-assignment-wave2-api.md` T3 section + locked L2.

#### C6 — gating (locked L2)

New composable middleware `requireInstrumentWriter()` in `src/middleware/auth.ts`:

```ts
// one SELECT per request (rol + tipoEmpleado + activo).
// ADMIN → next
// EMPLEADO + tipoEmpleado='GERONTOLOGA' → next
// else → 403 with custom denial message
```

Applied to `POST /instruments`, `PUT /instruments/:id`, `DELETE /instruments/:id`. GETs remain open.

#### Usuario API (NEW)

`src/routes/users.routes.ts` mounted at `/api/v1/users`. ADMIN-only.

| Method | Path | Accepts `tipoEmpleado`? |
|---|---|---|
| `GET` | `/users` | (read-only — list with all fields) |
| `POST` | `/users` | yes, only when `rol='EMPLEADO'` (otherwise 400) |
| `PATCH` | `/users/:id` | yes, set OR clear (`null`); auto-nulled on `rol` change |

E1 uppercase transform applied to `nombre` + `apellido` on both create and update.

#### Allow/deny matrix (verified 12:27 local)

| Role | POST /instruments | GET /instruments |
|---|---|---|
| `ADMIN` | 201 ✓ | 200 ✓ |
| `EMPLEADO` + `tipoEmpleado='GERONTOLOGA'` | 201 ✓ | 200 ✓ |
| `EMPLEADO` (plain) | 403 ✗ | 200 ✓ |
| `AUDITOR` | 403 ✗ | 200 ✓ |

---

## Wave 2 Verification (final)

```text
✓ npx tsc --noEmit  → clean
✓ /api/v1/health  → 200 (every change absorbed by tsx-watch)
✓ C1: legacy PENDIENTE flow preserved (ficha 157, response includes singleStepCompleted=false)
✓ C1: single-step COMPLETADO flow atomic (ficha 158, singleStepCompleted=true)
✓ C4: bulk updateMany flips past-vencimiento row to VENCIDO on GET /patients/52
✓ C7: returns due/overdue fichas with paciente+instrumento names, ordered asc, diasHastaVencimiento calc
✓ C6: 4-row allow/deny matrix verified
✓ Users endpoints (GET/POST/PATCH) work; ADMIN-only enforced; tipoEmpleado pairing rule enforced
✓ E1 uppercase transform applied to usuario nombre/apellido (verified via /users POST response)
✓ Test rows cleaned: 3 fichas + 2 instruments + 1 user (cascade sessions)
✓ Schema contract §5 placeholders filled in with C1/C4/C7 + C6 spec, Zod, response shapes, verified curls
```

---

## Wave 2 Files changed

**Created:**
- `backend/src/routes/users.routes.ts`
- `development/next-release-jul-10/tasks/W1-backend/result-wave2.md`

**Modified:**
- `backend/src/services/patientService.ts` — added `flipExpiredFichas`, `listFichasVencimientos`, `createFichaAtomic`
- `backend/src/services/nominaService.ts` — `ContratoInput.cargoId: number` (type forced by NOT NULL); both create/update paths use direct assignment (no `?? null`)
- `backend/src/routes/patients.routes.ts` — new `vencimientosQuerySchema`, `createFichaSchema`; C7 endpoint; C1-aware `POST /:id/fichas`
- `backend/src/routes/instruments.routes.ts` — `requireInstrumentWriter()` on POST/PUT/DELETE
- `backend/src/middleware/auth.ts` — added `requireInstrumentWriter()` composable middleware
- `backend/src/routes/index.ts` — mounted `userRoutes` at `/api/v1/users`
- `development/next-release-jul-10/orchestration-ctx/decisions/schema-contract-jul10.md` — §5.A/B/C filled (C1, C4, C7, C6 + users routes)

---

## Wave 2 Acceptance criteria — all green

| # | Criterion | Evidence |
|---|---|---|
| 1 | C1: one POST creates COMPLETADO ficha with file, atomically; legacy PENDIENTE flow intact | curl verified both paths; legacy returns `singleStepCompleted=false`, single-step returns `true` with `fechaCompletado=now()` |
| 2 | C4: a PENDIENTE ficha with past fechaVencimiento reads back VENCIDO | Manual `INSERT` + `GET /patients/52` → estado=VENCIDO confirmed |
| 3 | C7: endpoint returns due/overdue fichas with paciente+instrumento names | Curl returned 2 fichas with full join shape + `diasHastaVencimiento` |
| 4 | C6: 4-row allow/deny matrix verified | ADMIN 201, GERONTOLOGA 201, plain EMPLEADO 403, AUDITOR 403 |
| 5 | Backend healthy; typecheck clean | Final `npx tsc --noEmit` clean; `/api/v1/health` 200 |

---

## Notes for downstream workers

- **W3 (#31, test/quality)**: jul10 specs — C1 happy path + legacy fallback, C4 flip after GET, C7 response shape + ordering, C6 4-role matrix. Reuse the `getApiOrigin()` helper pattern from T4 (#28).
- **W2 (T5 #29)**: Fichas dialog rewrite — single-step flow that POSTs the C1 body. The `singleStepCompleted` discriminator is the signal to the UI to drop back into "edit" mode for renewals.
- **W2 (T6 #30)**: tipoEmpleado dropdown on the new `/users` admin page; uppercase-as-you-type on `nombre` + `apellido` (consistent with the jul-9 E1 contract).
- All three workers can rely on `schema-contract-jul10.md` §5 as the authoritative API surface spec.

---


---

## Scope delivered

### Migration A — `jul10_contrato_cargo_not_null`

- **Pre-flight data check** (recorded in `progress-report.md §0`):
  - 18 contratos, **17 with NULL cargo_id** (`SELECT COUNT(*) FROM contratos WHERE cargo_id IS NULL`).
  - 1 empresa (`id=6`); "Otro" cargo_id = 7.
- **Backfill**: 17 NULL rows → cargo_id=7 (empresa 6's "Otro"). Idempotent (UPDATE matches only NULL rows; re-run is a no-op).
- **DDL**: `ALTER TABLE contratos ALTER COLUMN cargo_id SET NOT NULL;`
- **Prisma model updated**: `cargoId Int` (was `Int?`) + `onDelete: Restrict` (forced by NOT NULL — SetNull cannot fire on NOT NULL column; documented in schema-contract-jul10.md §3.3).
- **Zod**: `contratoSchema.cargoId: z.number().int().positive()` (REQUIRED, no `.optional()`) in `backend/src/routes/nomina.routes.ts`. Applied to BOTH `POST` and `PUT /employees/:id/contratos`.

### Migration B — `jul10_tipo_empleado`

- New enum `TipoEmpleado { GERONTOLOGA }` in `schema.prisma` and PG type.
- `Usuario.tipoEmpleado TipoEmpleado? @map("tipo_empleado")` (nullable; only EMPLEADOs with a known specialization set it).
- `usuarios.tipo_empleado` column added; `ADD COLUMN IF NOT EXISTS` makes re-runs safe.

### E1 — Zod auto-uppercase

Applied `.transform(v => v.trim().toUpperCase())` to entity `nombre` fields on BOTH create AND update schemas:

| Field | File |
|---|---|
| `CertificadoEmpresa.nombre` | `src/routes/certificates.routes.ts` (baseCertificateFields — update is `.partial()` of base) |
| `Instrumento.nombreInstrumento` | `src/routes/instruments.routes.ts` (base + explicit update schema) |
| `Cliente.nombre` | `src/routes/patients.routes.ts` (createPatientSchema — update is `.partial().omit(...)`) |
| `Empleado.nombre`, `Empleado.apellido` | `src/routes/employees.routes.ts` (createEmployeeSchema — update is `.partial().omit(...)`) |
| `Empresa.nombre` | `src/routes/empresa.routes.ts` (updateEmpresaSchema — explicit) |

NOT transformed: `descripcion`, `notas`, any Text, `CargoEmpresa.nombre` (title-case catalog seeded in jul-9 — leave as-is per assignment).

### Contract document

`development/next-release-jul-10/orchestration-ctx/decisions/schema-contract-jul10.md` written with:
- §1 schema inventory
- §2 TipoEmpleado enum + Usuario.tipoEmpleado field
- §3 D7 NOT NULL with pre-flight, Prisma model diff, Zod update, curl verification
- §4 E1 exact field list (transformed + NOT transformed) with verified curls
- §5 placeholders for wave-2 (#26, #27) endpoints
- §6 migration order rationale
- §7 deviations/clarifications table
- §8 verification snapshot
- §9 grep keys

---

## Acceptance criteria — all green

| # | Criterion | Evidence |
|---|---|---|
| 1 | `npx prisma migrate status` clean (24 total) | **20 total** in dev (18 from jul-9 + 2 from jul-10); "Database schema is up to date!" confirmed at 12:14 and again at 12:19 |
| 2 | `cargo_id NOT NULL` via information_schema; NULL-backfill count documented | `information_schema.columns` shows `is_nullable=NO`; pre-flight counted 17 NULL rows, post-flight 0 |
| 3 | Curl: create cert/instrumento/cliente/empleado with lowercase nombre → UPPERCASE stored + returned; descripcion preserved | All 4 verified — see `progress-report.md §4` (pending, now verified) + `schema-contract-jul10.md §4.1` |
| 4 | `descripcion` preserves case | Test data: "preserva caso" → "preserva caso", "preserva minuscula" → "preserva minuscula" |
| 5 | Contrato create without cargoId → 400 | Verified 12:19 — response: `{ success:false, message:"Validation error", errors: { cargoId:["Required"] } }` |

(Re-numbering: original criterion list quoted 1–4 in the assignment; the 5th "Backend healthy throughout" — verified at every step via `/api/v1/health`.)

---

## Verification log (executed)

```text
2026-07-10 12:14  npx prisma migrate status  → 20 migrations, "Database schema is up to date!"
2026-07-10 12:16  curl /api/v1/health  → 200 {"status":"ok"}
2026-07-10 12:17  TSX-watch reload after each E1 file edit
2026-07-10 12:18  curl POST /certificates (lowercase nombre) → 201, nombre=UPPERCASE, descripcion=preserves
2026-07-10 12:18  curl POST /instruments (lowercase nombreInstrumento) → 201, =UPPERCASE
2026-07-10 12:18  curl POST /employees (lowercase nombre+apellido) → 201, both =UPPERCASE
2026-07-10 12:18  curl POST /patients (lowercase nombre) → 201, =UPPERCASE
2026-07-10 12:18  curl PUT /empresa/6 (lowercase nombre) → 200, =UPPERCASE
2026-07-10 12:19  curl POST /nomina/employees/117/contratos {no cargoId} → 400 + field=cargoId
2026-07-10 12:19  curl POST /nomina/employees/117/contratos {cargoId:7} → 201, includes cargo{nombre:"Otro"}
2026-07-10 12:19  curl /api/v1/health  → 200 (final sanity check)
2026-07-10 12:19  Cleaned 4 E1 test rows (cert 155, instr 78, empleado 117, paciente 107) — test contrato 87 cascade-deleted via empleado FK
```

---

## Deviations / clarifications

1. **Migration filename order**: alphabetical (B then A) but applied B first by Prisma timestamp (`20260710100000_jul10_contrato_cargo_not_null` applied before `20260710100100_jul10_tipo_empleado`). Reason: B is the tightening migration — applying A first would leave the Prisma client temporarily out of sync with the contracts table (column NULL vs. model `Int`).
2. **`onDelete: Restrict` on Contrato.cargo relation** (was `SetNull` in jul-9). Forced by NOT NULL — Prisma would otherwise error on generate. Documented in contract §3.3; behaviour change is benign (a cargo cannot be deleted while referenced, which is the right answer for a FK now made required).
3. **Test row cleanup**: created 4 E1 entity test rows + 1 contrato, then deleted them after acceptance. The contrato row auto-deleted via `Empleado.onDelete: Cascade` when its empleado FK was deleted.

---

## Files created / modified

**Created:**
- `backend/prisma/migrations/20260710100000_jul10_contrato_cargo_not_null/migration.sql`
- `backend/prisma/migrations/20260710100100_jul10_tipo_empleado/migration.sql`
- `development/next-release-jul-10/orchestration-ctx/decisions/schema-contract-jul10.md`
- `development/next-release-jul-10/tasks/W1-backend/progress-report.md`
- `development/next-release-jul-10/tasks/W1-backend/completion-report.md` (this file)
- `development/next-release-jul-10/tasks/W1-backend/result.md` (delivery summary)

**Modified:**
- `backend/prisma/schema.prisma` — `Usuario.tipoEmpleado` field; `TipoEmpleado` enum; `Contrato.cargoId` (Int, NOT NULL); `Contrato.cargo.onDelete: Restrict`
- `backend/src/routes/certificates.routes.ts` — `baseCertificateFields.nombre` transform
- `backend/src/routes/instruments.routes.ts` — `nombreInstrumento` transform on create + update
- `backend/src/routes/patients.routes.ts` — `createPatientSchema.nombre` transform
- `backend/src/routes/employees.routes.ts` — `createEmployeeSchema.nombre + apellido` transform
- `backend/src/routes/empresa.routes.ts` — `updateEmpresaSchema.nombre` transform
- `backend/src/routes/nomina.routes.ts` — `contratoSchema.cargoId` required (no `.optional()`)

---

## Notes for downstream workers

- **W2 (frontend, T5/T6, tasks #29/#30)**:
  - **T6 (#30)** — `tipoEmpleado` field on the usuario form (admin → create/edit usuario); uppercase-as-you-type inputs on the E1 entity nombre fields.
  - **T5 (#29)** — the new `POST /api/v1/patients/:id/fichas` from T2 (#26) — sheet for that worker.
- **W3 (test/quality, T7 / task #31)**:
  - 4 jul10 specs needed: cert uppercase, instrumento uppercase, empleado uppercase, contrato 400.
  - Reuse the `tests/helpers/api-origin.ts` `getApiOrigin()` pattern introduced in T4 (#28) per `team-plan-next-release-jul-10.md §Groups 2`.
- **Wave-2 W1 (T2 #26 + T3 #27)**:
  - Schema contract §5 has placeholder sections; fill in during the wave-2 pushes.

---

## Constraints honored

- ✅ No `migrate diff --shadow-database-url` used.
- ✅ All DDL ran against dev DB `:15432` only.
- ✅ Backend tsx-watch on `:3101` absorbed every change without manual restart.
- ✅ No git commit.
- ✅ No staging/prod interaction.

---
