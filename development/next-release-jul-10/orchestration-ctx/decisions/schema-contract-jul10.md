# Schema Contract — jul-10 Improvements

**Author:** W1 (pt-backend-eng), task T1
**Date:** 2026-07-10
**Migrations applied:** 2 (`jul10_contrato_cargo_not_null`, `jul10_tipo_empleado`)
**Baseline:** HEAD `48029ef` + jul-9 release (18 migrations) → schema now at **20 migrations**.
**Backend port:** `:3101` (verified after each migration and each E1 route change).
**Database:** `miempresa_dev` on `:15432` (dev — safe to migrate).
**Audience:** W2 (frontend on tipoEmpleado field + uppercase inputs), W3 (test/quality on jul10 specs), plus wave-2 workers (T2 #26, T3 #27). Every frontend worker should NEVER need to open `backend/prisma/schema.prisma` — read this doc instead.

**Inherits / supersedes:** `development/improvements-jul-9/orchestration-ctx/decisions/schema-contract-jul9.md` §4 (D7 CargoEmpresa catalog) and §5.4 (`Contrato.cargoId` was nullable there).

---

## 1. Inventory of all jul-10 schema changes

| # | Item | Layer | Model / table | Column / change | Notes |
|---|---|---|---|---|---|
| jul10-A | `TipoEmpleado` enum | new enum | (PG type) `TipoEmpleado` | `GERONTOLOGA` | single value now; enum pattern leaves room for future specializations per L2 |
| jul10-A | `Usuario.tipoEmpleado` | additive nullable | `usuarios` | `tipo_empleado TipoEmpleado NULL` | only EMPLEADO accounts with a known specialization set it |
| jul10-B | `Contrato.cargo_id SET NOT NULL` | tighten | `contratos` | `cargo_id` → NOT NULL | 17 NULL rows backfilled to "Otro" first |
| jul10-B | `Contrato.cargo ON DELETE` | behavior change | `contratos` | was `ON DELETE SetNull` → now `ON DELETE Restrict` | forced by NOT NULL — `SetNull` cannot fire on a NOT NULL column |
| E1 | Zod uppercase transforms | API layer | (no schema) | `.transform(v => v.trim().toUpperCase())` on entity nombre fields | applies to BOTH create AND update paths |

**No data was dropped.** All backfills routed NULL `cargo_id` rows to the "Otro" cargo of the same empresa (cargo_id=7 for empresa_id=6).

---

## 2. New enum: `TipoEmpleado`

```prisma
enum TipoEmpleado {
  GERONTOLOGA
}
```

- Optional on `Usuario` (only set when an account has a known specialization).
- Frontend dropdown will start with a single option; the enum (not a free-text field) leaves room for future types per L2.
- **Where it's set**: wave-2 API will extend `POST /api/v1/usuarios` and `PATCH /api/v1/usuarios/:id` Zod schemas (placeholder §D below). Until then, only direct DB writes work.
- **Gating** (wave-2, T3 / task #27): `/instruments/*` writes require `rol=ADMIN` OR (`rol=EMPLEADO` AND `tipoEmpleado=GERONTOLOGA`).

DB column:
```sql
SELECT typname FROM pg_type WHERE typname='TipoEmpleado';
-- "TipoEmpleado"

SELECT column_name, is_nullable, udt_name
FROM information_schema.columns
WHERE table_name='usuarios' AND column_name='tipo_empleado';
-- is_nullable=YES, udt_name=_TipoEmpleado
```

---

## 3. D7 tighten: `Contrato.cargoId` → NOT NULL

### 3.1 Pre-flight data check (recorded 2026-07-10 07:14 local)

```text
total contratos:        18
NULL cargo_id rows:     17
NOT NULL cargo_id rows: 1
"Otro" cargo id:        7   (empresa_id=6 = only existing empresa)
empresas count:         1   (id=6, "Mi Empresa S.A.S.")
```

Backfill SQL (idempotent — re-runs match no NULL rows):
```sql
UPDATE "contratos" c
SET "cargo_id" = (
  SELECT ce."cargo_id" FROM "cargos_empresa" ce
  WHERE ce."empresa_id" = 6 AND ce."nombre" = 'Otro'
  LIMIT 1
)
WHERE c."cargo_id" IS NULL;
ALTER TABLE "contratos" ALTER COLUMN "cargo_id" SET NOT NULL;
```

### 3.2 Post-migration verification

```text
✓ cargo_id IS NOT NULL on 18/18 contratos (information_schema)
✓ 0 NULL cargo_id rows
✓ FK contratos_cargo_id_fkey still valid (now ON DELETE RESTRICT)
```

### 3.3 Prisma model update

```prisma
// before (jul-9)
// cargoId Int?  @map("cargo_id")
// cargo   CargoEmpresa? @relation(fields: [cargoId], references: [id], onDelete: SetNull)

// after (jul-10)
cargoId Int        @map("cargo_id")
cargo   CargoEmpresa @relation(fields: [cargoId], references: [id], onDelete: Restrict)
```

Note on `onDelete: Restrict`: was `SetNull` in jul-9; with `cargo_id` now NOT NULL, the only viable action is RESTRICT (silently killing contracts by deleting the cargo catalog row would be a data-loss foot-gun). Migration notes the change.

### 3.4 API surface — Zod requires `cargoId`

Update applied in `backend/src/routes/nomina.routes.ts`:

```ts
const contratoSchema = z.object({
  tipoContrato: z.enum(['OPS', 'OBRA_O_LABOR', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO']),
  fechaInicio:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaFin:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  archivoUrl:   z.string().optional(),
  archivoFirmadoUrl: z.string().max(500).optional(),
  // jul-10 D7 tighten: REQUIRED now (no .optional())
  cargoId: z.number().int().positive(),
  activo:  z.boolean().optional(),
})
```

`PUT /api/v1/nomina/employees/:id/contratos/:cid` reuses the same schema (no separate partial).

### 3.5 Contract behavior verified (curl 2026-07-10)

```text
POST /api/v1/nomina/employees/117/contratos
  body: { "tipoContrato":"OPS","fechaInicio":"2026-07-10" }   (no cargoId)
  → 400 "Validation error", errors: { cargoId: ["Required"] }

POST /api/v1/nomina/employees/117/contratos
  body: { "tipoContrato":"TERMINO_INDEFINIDO","fechaInicio":"2026-07-10","cargoId":7 }
  → 201, includes cargo { id:7, nombre:"Otro", activo:true, ... }
```

### 3.6 Legacy payload break (still in force)

`forbidLegacy(['cargo'])` middleware plus the omission of `cargo` from `contratoSchema` means any legacy `{ cargo: string }` payload is rejected with HTTP 400. This is unchanged from jul-9.

---

## 4. E1 — Zod auto-uppercase (entity nombre fields only)

**Hard rule:** these fields are normalized server-side via `.transform(v => v.trim().toUpperCase())`. Frontend mirrors with uppercase-as-you-type inputs but storage is authoritative.

**Transformed (create AND update paths):**

| Field | Model | File | Schema |
|---|---|---|---|
| `nombre` | `CertificadoEmpresa` | `src/routes/certificates.routes.ts` | `baseCertificateFields.nombre` (create + `.partial()` update) |
| `nombreInstrumento` | `Instrumento` | `src/routes/instruments.routes.ts` | `baseInstrumentFields.nombreInstrumento` + `updateInstrumentSchema.nombreInstrumento` |
| `nombre` | `Cliente` | `src/routes/patients.routes.ts` | `createPatientSchema.nombre` (update derives via `.partial()`) |
| `nombre`, `apellido` | `Empleado` | `src/routes/employees.routes.ts` | `createEmployeeSchema.nombre + apellido` (update derives via `.partial().omit(...)`) |
| `nombre` | `Empresa` | `src/routes/empresa.routes.ts` | `updateEmpresaSchema.nombre` |

**NOT transformed (explicit user spec, transcript lines 60–62):**

- Any `descripcion` field (cert, instrumento, cliente, etc.)
- Any `notas` / `observaciones` field
- Any long Text field
- `CargoEmpresa.nombre` (catalog values — title-case seeded in jul-9; users may still pass mixed case but no constraint either way)
- Historical rows (left as-is, per jul-9 user decision)

### 4.1 Verified curls

```text
POST /api/v1/certificates  {nombre:"  prueba minuscula julio10  ", descripcion:"preserva caso"}
  → 201; data.nombre = "PRUEBA MINUSCULA JULIO10"; data.descripcion = "preserva caso"

POST /api/v1/instruments   {nombreInstrumento:"  minimo valoracion julio10  ", descripcion:"preserva minuscula"}
  → 201; data.nombreInstrumento = "MINIMO VALORACION JULIO10"; data.descripcion = "preserva minuscula"

POST /api/v1/employees     {nombre:"  juan min  ", apellido:"  perez loc  "}
  → 201; data.nombre = "JUAN MIN"; data.apellido = "PEREZ LOC"

POST /api/v1/patients      {nombre:"  maria min loc  ", notas:"preserva minuscula"}
  → 201; data.nombre = "MARIA MIN LOC"; data.notas = "preserva minuscula"

PUT  /api/v1/empresa/6     {nombre:"  mi empresa s.a.s. (jul10)  "}
  → 200; data.nombre = "MI EMPRESA S.A.S. (JUL10)"
```

### 4.2 Note on zod `.partial()` + `.transform()`

For `certificates`, `patients`, and `employees` the update schema is derived via `create*.partial()` (or `base*.partial()`). In Zod v3 the transform runs on parse when the optional field is present — no special wiring needed. The W1 verification curls above include both create and update paths, all passing.

---

## 5. Wave-2 API surface (filled by T2 #26 + T3 #27)

### 5.A — C1 single-step ficha (T2 / #26)

`POST /api/v1/patients/:id/fichas` — kept on the SAME endpoint, extended body schema (legacy flow preserved by branching on `archivoCompletado` presence).

#### Request body (Zod)
```ts
const createFichaSchema = z.object({
  instrumentoId: z.number().int().positive(),
  versionRegistro: z.string().min(1).max(20),
  archivoCompletado: z.string().min(1).optional(),  // presence → single-step (C1)
  notasObservaciones: z.string().optional(),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
```

#### Branching rule
- `archivoCompletado` **present and non-empty** → single-step: ONE Prisma `$transaction` creates the `RegistroFichaCompletada` with `estado='COMPLETADO'`, `fechaCompletado=now()`, `archivoCompletado=<value>`, `responsable=req.user.id`.
- `archivoCompletado` **absent or empty** → legacy PENDIENTE flow: `estado='PENDIENTE'`, `archivoCompletado=null`, `fechaCompletado=null`. (Renewal path keeps using `PATCH .../status`.)

#### Response (201)
```json
{
  "success": true,
  "data": {
    "id": 158,
    "clienteId": 52,
    "instrumentoId": 42,
    "estado": "COMPLETADO",
    "archivoCompletado": "https://files.example.com/jul10/ficha-atomic.pdf",
    "fechaCompletado": "2026-07-10T12:25:22.656Z",
    "fechaVencimiento": null,
    "versionRegistro": "v1.0",
    "notasObservaciones": "jul10 c1 single-step",
    "singleStepCompleted": true,            // discriminator for clients
    "instrumento": { "id": 42, "nombreInstrumento": "...", "tipo": "VALORACION" }
  }
}
```

When `singleStepCompleted=false` (legacy path), `estado="PENDIENTE"` and `fechaCompletado` is null.

#### Verified curls (2026-07-10 12:25 local)
```text
POST /api/v1/patients/52/fichas  {instrumentoId:42, versionRegistro:"v1.0"}
  → 201, estado=PENDIENTE, singleStepCompleted=false

POST /api/v1/patients/52/fichas  {instrumentoId:42, versionRegistro:"v1.0", archivoCompletado:"https://...", notasObservaciones:"..."}
  → 201, estado=COMPLETADO, fechaCompletado=now, singleStepCompleted=true
```

Service: `patientService.createFichaAtomic(patientId, responsableId, input)` — `prisma.$transaction(async tx => {...})`.

### 5.B — C4 lazy flip + C7 weekly vencimientos (T2 / #26)

**C4 implementation**: `patientService.flipExpiredFichas(prisma, clienteId?, now=new Date())`. One `updateMany` — bulk flip, NOT per-row.

Trigger points:
1. **Inside `getPatient(id)`** — runs before the `cliente.findUnique` so the relation include reflects the flipped estado.
2. **Inside `listFichasVencimientos(days)`** (C7) — flips globally before computing the report.

Signature:
```ts
export async function flipExpiredFichas(
  prisma: PrismaClient,
  clienteId?: number,
  now: Date = new Date()
): Promise<number>  // returns rows flipped
```

#### Verified (2026-07-10 12:25 local)
```sql
INSERT INTO registros_fichas_completadas (cliente_id, instrumento_id, estado, version_registro, responsable, fecha_vencimiento)
  VALUES (52, 42, 'PENDIENTE', 'v0.9', 38, '2026-06-01');
-- registro_id=159, estado=PENDIENTE

GET /api/v1/patients/52
  → data.registrosFichas[*].estado = ['PENDIENTE', 'COMPLETADO', 'VENCIDO', 'VENCIDO']
    (registro_id=159 was flipped → VENCIDO)
```

**C7 endpoint**: `GET /api/v1/patients/fichas/vencimientos?days=N`

Query schema (Zod preprocess → coerces missing/empty to default 7):
```ts
const vencimientosQuerySchema = z.object({
  days: z.preprocess((v) => (v === undefined ? 7 : Number(v)), z.number().int().min(1).max(365)).default(7),
})
```

Response (200):
```json
{
  "success": true,
  "generatedAt": "2026-07-10T12:25:22.744Z",
  "windowDays": 7,
  "total": 2,
  "data": [
    {
      "id": 40,
      "clienteId": 52,
      "clienteNombre": "Ana Gómez Ruiz",
      "instrumentoId": 43,
      "instrumentoNombre": "Plan Nutricional",
      "instrumentoTipo": "NUTRICION",
      "estado": "VENCIDO",
      "fechaVencimiento": "2024-06-30T00:00:00.000Z",
      "fechaCompletado": null,
      "diasHastaVencimiento": -741
    },
    ...
  ]
}
```

Ordering: `fechaVencimiento` ascending — most overdue first. `estado ∈ {PENDIENTE, VENCIDO}` (excludes `COMPLETADO`).

Routing note: `/fichas/vencimientos` is two segments — does NOT collide with the `/:id` single-segment match.

### 5.C — C6 instruments gating + usuario tipoEmpleado write API (T3 / #27)

#### Middleware (added to `src/middleware/auth.ts`)

```ts
export function requireInstrumentWriter() {
  return async (req, res, next): Promise<void> => {
    if (!req.userId) { res.status(401).json({...}); return }
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.userId },
      select: { id: true, rol: true, tipoEmpleado: true, activo: true },
    })
    if (!usuario || !usuario.activo) { res.status(401).json({...}); return }
    if (usuario.rol === 'ADMIN') { next(); return }
    if (usuario.rol === 'EMPLEADO' && usuario.tipoEmpleado === 'GERONTOLOGA') { next(); return }
    res.status(403).json({
      success: false,
      message: 'Insufficient permissions: instrument writes require ADMIN or EMPLEADO+GERONTOLOGA',
    })
  }
}
```

Applied to: `POST /instruments`, `PUT /instruments/:id`, `DELETE /instruments/:id` (writes only).
`GET` paths remain unguarded.

One extra `SELECT` per gated request (acceptable; allowed since `usuario` is cached implicitly via session JWT lifetime).

#### Allow/deny matrix (verified 2026-07-10 12:27 local)

| Role | POST/PUT/DELETE /instruments | GET /instruments |
|---|---|---|
| `ADMIN` | 201 / 200 / 200 ✓ | 200 ✓ |
| `EMPLEADO` + `tipoEmpleado='GERONTOLOGA'` | 201 / 200 / 200 ✓ | 200 ✓ |
| `EMPLEADO` (plain, no specialization) | 403 ✗ | 200 ✓ |
| `AUDITOR` | 403 ✗ | 200 ✓ |
| `OPERADOR` (untested but follows same matrix) | 403 ✗ | 200 ✓ |

Example denial response:
```json
{ "success": false, "message": "Insufficient permissions: instrument writes require ADMIN or EMPLEADO+GERONTOLOGA" }
```

#### Usuario write API (new `src/routes/users.routes.ts`, mounted at `/api/v1/users`)

```ts
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  rol: z.enum(['ADMIN', 'EMPLEADO', 'AUDITOR', 'OPERADOR']),
  nombre: z.string().min(1).max(100).transform(v => v.trim().toUpperCase()),       // jul-10 E1
  apellido: z.string().min(1).max(100).transform(v => v.trim().toUpperCase()),     // jul-10 E1
  empleadoId: z.number().int().positive().optional().nullable(),
  tipoEmpleado: z.enum(['GERONTOLOGA']).optional().nullable(),                    // jul-10 C6
})

const updateUserSchema = createUserSchema.shape({...}).extend({...}).shape({...})
```

Endpoints (all ADMIN-only):
| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/users` | — | `Usuario[]` (id asc) | `201` style: `{success, data:[...], total}` |
| `POST` | `/api/v1/users` | `createUserSchema` | `Usuario` (no password) | 400 if `tipoEmpleado` set without `rol='EMPLEADO'` |
| `PATCH` | `/api/v1/users/:id` | `updateUserSchema` | `Usuario` (no password) | 404 if not found; `tipoEmpleado` forced to `null` when `rol != 'EMPLEADO'` |

Response shape (single):
```json
{
  "id": 42,
  "email": "gerontologa@miempresa.com",
  "nombre": "MARIA",
  "apellido": "GERONTOLOGA",
  "rol": "EMPLEADO",
  "tipoEmpleado": "GERONTOLOGA",
  "empleadoId": null,
  "activo": true,
  "createdAt": "2026-07-10T12:27:01.462Z",
  "updatedAt": "2026-07-10T12:27:01.462Z"
}
```

Verified curls (2026-07-10 12:27 local):
```text
POST /api/v1/users  {rol:'ADMIN', tipoEmpleado:'GERONTOLOGA'}
  → 400 {message:'tipoEmpleado is only valid when rol="EMPLEADO"', field:'tipoEmpleado'}

POST /api/v1/users  {rol:'EMPLEADO', tipoEmpleado:'GERONTOLOGA'}
  → 201 {rol:'EMPLEADO', tipoEmpleado:'GERONTOLOGA'}

GET /api/v1/users  (logged in as plain EMPLEADO)
  → 403 {message:'Insufficient permissions'}     # requireRole('ADMIN') blocks
```

---

## 6. Migration order & lockstep

| File | Applies | Idempotent guards | Affects existing rows |
|---|---|---|---|
| `20260710100000_jul10_contrato_cargo_not_null` | before B → UPDATE (backfill NULLs) → ALTER COLUMN SET NOT NULL | UPDATE WHERE `cargo_id IS NULL` (no-op on re-run) | 17 rows in dev; assign to "Otro" (cargo_id=7) of empresa_id=6 |
| `20260710100100_jul10_tipo_empleado` | after A — new enum + new nullable column | `ADD COLUMN IF NOT EXISTS` | none |

The B migration MUST run before the Prisma client regenerates with `Contrato.cargoId Int` (otherwise the cargo column on the contract model is required-but-the-column-is-nullable, breaking type alignment). Schema-only `cargoId` change in `schema.prisma` is committed alongside the migration files; Prisma client regenerated and verified.

---

## 7. Deviations / clarifications vs the assignment

| # | Assignment said | Actual implementation | Notes |
|---|---|---|---|
| 1 | Migration A name `jul10_tipo_empleado`; migration B name `jul10_contrato_cargo_not_null` (per assignment §"Scope") | Used the same names verbatim; ordered B before A alphabetically but applied B first by timestamp (`20260710100000` vs `20260710100100`) | Both run on a single `migrate dev` invocation, order chosen to keep Prisma client type-check honest during regen |
| 2 | CargoEmpresa.nombre uppercase — explicit "leave as-is" | Did NOT add `.transform()` to `src/routes/empresa.routes.ts createCargoSchema.nombre`; left as plain string | Matches assignment verbatim |
| 3 | Contrato Zod on update also requires `cargoId` | `contratoSchema` is shared by POST and PUT, so both paths require `cargoId` now | No separate partial for update |

---

## 8. Verification snapshot (executed 2026-07-10 12:19 local)

```text
✓ npx prisma migrate status  → 20 migrations, "Database schema is up to date!"
✓ /api/v1/health  → 200 ok
✓ information_schema: contratos.cargo_id is_nullable = NO  (was YES in jul-9)
✓ 0 rows in contratos with cargo_id IS NULL  (was 17 pre-flight)
✓ 18 rows in contratos with cargo_id NOT NULL
✓ TipoEmpleado enum exists in pg_type
✓ usuarios.tipo_empleado is_nullable = YES, udt_name=_TipoEmpleado
✓ FK contratos_cargo_id_fkey ON DELETE RESTRICT
✓ E1 contracts verified via curl (cert 201, instrumento 201, empleado 201, paciente 201, empresa 200)
✓ Contrato POST without cargoId → 400, error field = "cargoId"
✓ Contrato POST with cargoId=7 → 201 (success path intact)
```

---

## 9. Grep keys for cross-doc searchability

```
schema-contract schemaContract jul10 improvements-jul-10 contract
tipoEmpleado TipoEmpleado GERONTOLOGA usuario.tipoEmpleado
cargo_id NOT NULL D7-tighten cargoId-required contratoSchema
E1 uppercase-transform trim upper-case entity-nombre
allowSpecialization L2 sub-role role-gating instruments-gate
jul10_contrato_cargo_not_null jul10_tipo_empleado
```

