# Schema Contract — jul-9 Improvements

**Author:** W1 (pt-backend-eng), task T1
**Date:** 2026-07-10
**Migrations applied:** 4 (`jul9_additive_fields`, `jul9_nota_fecha_incidente`, `jul9_educacion_empleado`, `jul9_cargo_empresa`)
**Baseline:** HEAD `48029ef` + jul-9 release (14 migrations); schema is now at **18 migrations**.
**Backend port:** `:3101` (verified after each migration).
**Database:** `miempresa_dev` on `:15432` (dev — safe to migrate). Local seed = 1 empresa ("Mi Empresa S.A.S.", id=6), 4 contratos (0 historical), 3 empleados, 3 clientes, 4 notas.
**Audience:** W2 (frontend certificados/empresa), W3 (frontend pacientes/empleados/contrato), W4 (test/quality). **Every frontend worker should NEVER need to open `backend/prisma/schema.prisma` — read this doc instead.**

---

## 1. Inventory of all jul-9 schema changes

| # | Item | Layer | Model / table | Column / change | Notes |
|---|---|---|---|---|---|
| M1-A4 | `comprobantePagoUrl` | additive nullable | `CertificadoUpdate` | `comprobante_pago_url VARCHAR(500) NULL` | alongside existing `archivo_url` (non-destructive, L5) |
| M1-B3 | `fechaCumpleanos` | additive nullable | `Cliente` | `fecha_cumpleanos DATE NULL` | reports fall back to `fecha_nacimiento` when null |
| M1-B4 | `tipoSangre` | additive nullable + new enum | `Cliente` | `tipo_sangre "TipoSangre" NULL` | enum has 8 values (see §2) |
| M1-B5 | `eps` | additive nullable | `Cliente` | `eps VARCHAR(200) NULL` | `informacion_seguro` stays for other insurance notes |
| M1-D1 | `nivelEscritura` → nullable | loosen NOT NULL | `EducacionIdiomas` | `nivel_escritura` is now NULLABLE | was on idiomas, NOT empleado (assignment phrasing had a name slip — corrected to actual model) |
| M1-D3 | `documentoIdentificacionUrl` | additive nullable | `Empleado` | `documento_identificacion_url VARCHAR(500) NULL` | upload via `useFileUpload().uploadFile(file, 'empleado-documentos')` |
| M1-D6 | `archivoFirmadoUrl` | additive nullable | `Contrato` | `archivo_firmado_url VARCHAR(500) NULL` | signed-contract file slot |
| M2-B1 | `fechaIncidente` (REQUIRED) | new column + backfill + NOT NULL | `NotaCliente` | `fecha_incidente DATE NOT NULL` | all 4 existing rows backfilled from `fecha::date`; new `@@index([fechaIncidente])` |
| M3-D2 | `EducacionEmpleado` | new table | (new) `educacion_empleado` | see §3 model block | repeatable per-empleado education rows |
| M4-D7 | `CargoEmpresa` catalog | new table + seed + nullable FK | new `cargos_empresa` + `Contrato.cargo_id` | see §4 | seeded with 7 cargos per existing empresa |

**No data was dropped.** Every old column (including legacy `cargos.nombre_cargo` and `nomina_periodos.contrato_id`) is untouched.

---

## 2. New enum: `TipoSangre`

```prisma
enum TipoSangre {
  A_POS
  A_NEG
  B_POS
  B_NEG
  AB_POS
  AB_NEG
  O_POS
  O_NEG
}
```

- Optional on `Cliente` (any client may have an unknown blood type).
- UI dropdown (8 options, default "—").
- When `null`, reports skip the row gracefully (do not display "Desconocido" unless you want to).

---

## 3. New model: `EducacionEmpleado`

```prisma
model EducacionEmpleado {
  id              Int       @id @default(autoincrement()) @map("educacion_empleado_id")
  empleadoId      Int       @map("empleado_id")
  profesion       String    @db.VarChar(200)
  universidad     String?   @db.VarChar(200)
  fechaGraduacion DateTime? @map("fecha_graduacion") @db.Date
  diplomaUrl      String?   @map("diploma_url") @db.VarChar(500)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  empleado        Empleado  @relation(fields: [empleadoId], references: [id], onDelete: Cascade)

  @@index([empleadoId])
  @@map("educacion_empleado")
}
```

### 3.1 API surface (W1 wave-2 implements — T4 / T5 worker briefs)

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/empleados/:empleadoId/educacion` | — | `EducacionEmpleado[]` (asc by `createdAt`) | 200 OK; empty array OK |
| `POST` | `/api/v1/empleados/:empleadoId/educacion` | `{ profesion: string (req, ≤200), universidad?: string (≤200), fechaGraduacion?: ISO date, diplomaUrl?: string (≤500) }` | `EducacionEmpleado` | 201 |
| `PATCH` | `/api/v1/empleados/:empleadoId/educacion/:id` | partial of POST body | `EducacionEmpleado` | 404 if not in this empleado |
| `DELETE` | `/api/v1/empleados/:empleadoId/educacion/:id` | — | `204 No Content` | cascades to row |

Field names in **JSON responses are camelCase** (Prisma's default mapping). DB columns are snake_case via `@map`.

Example response (single):
```json
{
  "id": 12,
  "empleadoId": 3,
  "profesion": "Fisioterapeuta",
  "universidad": "Universidad Nacional",
  "fechaGraduacion": "2018-06-15",
  "diplomaUrl": "https://files.example.com/empleado-docs/diploma-12.pdf",
  "createdAt": "2026-07-10T02:50:00.000Z",
  "updatedAt": "2026-07-10T02:50:00.000Z"
}
```

---

## 4. D7: CargoEmpresa catalog + Contrato FK

### 4.1 New model

```prisma
model CargoEmpresa {
  id        Int       @id @default(autoincrement()) @map("cargo_id")
  empresaId Int       @map("empresa_id")
  nombre    String    @db.VarChar(100)
  activo    Boolean   @default(true)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  empresa   Empresa   @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  contratos Contrato[]
  @@unique([empresaId, nombre])
  @@index([empresaId])
  @@map("cargos_empresa")
}
```

### 4.2 New column on `Contrato`

```prisma
cargoId Int? @map("cargo_id")
cargo   CargoEmpresa? @relation(fields: [cargoId], references: [id], onDelete: SetNull)
@@index([cargoId])
```

`cargoId` is **nullable** — `SET NOT NULL` is deferred to wave-3 UI ship (see §4.6 follow-up).

### 4.3 Seed values (per existing empresa — currently 1 row seeded)

The 7 cargos below were inserted for `empresa_id=6` (Mi Empresa S.A.S.):

| nombre |
|---|
| Auxiliar de Enfermería |
| Auxiliar de Servicios Generales |
| Educador Físico |
| Fisioterapeuta |
| Manualidades |
| Otro |
| Terapeuta Ocupacional |

`activo=true` for all. Confirmed via:
```sql
SELECT nombre, activo FROM cargos_empresa ORDER BY nombre;
-- 7 rows, all activo=t
```

### 4.4 Backfill mapping actually applied

**None.** No `Contrato.cargo` text column ever existed in the live schema. Documented as a deviation in `tasks/W1-backend/proposed-plan.md §1.1` and approved by orchestrator in `decisions/d7-cargo-migration-approval.md`.

### 4.5 API surface (W1 wave-2 implements — T5 worker)

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/v1/empresa/cargos?activo=true` | — | `CargoEmpresa[]` (asc by `nombre`) |
| `GET` | `/api/v1/empresa/cargos` (no filtro) | — | `CargoEmpresa[]` (incl. archivados) |
| `POST` | `/api/v1/empresa/cargos` | `{ nombre: string (req, ≤100) }` | `CargoEmpresa` |
| `PATCH` | `/api/v1/empresa/cargos/:id` | `{ activo: boolean }` (or `{ nombre: string }`) | `CargoEmpresa` |
| `DELETE` | `/api/v1/empresa/cargos/:id` | — | 204 (soft-delete via `activo=false`) |

**No hard DELETE** — soft-archive only. Listed archived cargos still appear in the contracts list as read-only.

Example response (single):
```json
{
  "id": 1,
  "empresaId": 6,
  "nombre": "Fisioterapeuta",
  "activo": true,
  "createdAt": "2026-07-10T02:49:28.000Z",
  "updatedAt": "2026-07-10T02:49:28.000Z"
}
```

### 4.6 Follow-up — `SET NOT NULL` on `Contrato.cargo_id` (deferred)

Wave-2 API doesn't reject creating a Contrato without `cargoId`. Wave-3 UI ships the cargo `<Select>` which makes mis-selection impossible at the UI level. A **separate follow-up migration** at the end of wave 3 will:
1. Set `Contrato.cargo_id NOT NULL`.
2. Add a CHECK constraint or app-side guard for `cargo.empresa_id = Contrato.empleado.empresa_id` (cross-empresa cargos).

### 4.7 Legacy payload break (per orchestrator instruction)

The new contrato API accepts **`cargoId: number` only**. Any legacy `{ cargo: string }` payload is rejected by Zod with HTTP 400, `field: "cargoId"`. No backward-compatible string path. Document in API consumer changelog.

---

## 5. JSON shapes the API will expose (model changes the API surfaces)

The following are exact fields Prisma will return — JSON keys are camelCase.

### 5.1 `Cliente` — added fields (all optional / nullable)

```json
{
  // ... existing fields ...
  "fechaCumpleanos": "1990-08-20"  // or null
  "tipoSangre": "O_POS",           // or null
  "eps": "Sura Póliza 12345"       // or null
}
```

### 5.2 `Empleado` — added field

```json
{
  // ... existing fields ...
  "documentoIdentificacionUrl": "https://files.example.com/empleado-docs/cedula-12.pdf"  // or null
}
```

### 5.3 `EducacionIdiomas.nivelEscritura`

Now **nullable**. Existing API must accept `null` and the OLD string `"Básico" / "Intermedio" / "Avanzado"` values. New payloads should send `null` to drop the legacy concept (D1 hides it from UI).

### 5.4 `Contrato` — added fields

```json
{
  // ... existing fields ...
  "archivoFirmadoUrl": "https://files.example.com/contratos/firmado-9.pdf",  // or null
  "cargoId": 1,  // or null (transition period)
  "cargo": { "id": 1, "nombre": "Fisioterapeuta", "activo": true, ... }  // Prisma relation; null when cargoId is null
}
```

When the API exposes `CargoEmpresa`, it should include it embedded (`include: { cargo: true }`) for convenience; omit otherwise.

### 5.5 `NotaCliente` — REQUIRED `fechaIncidente`

```json
{
  "id": 29,
  "clienteId": 71,
  "registroFichaId": null,
  "tipoNota": "ALERTA",
  "fecha": "2026-07-09T01:44:33.087Z",
  "fechaIncidente": "2026-07-09",      // <-- always present (was 0 before M2; backfilled to 4/4 rows)
  "autor": 1,
  "contenido": "...",
  "prioridad": "ALTA",
  "visiblePara": "SOLO_MEDICOS"
}
```

**B2 server-side rule (W1 wave-2 enforces in T3):**

```ts
// in notas create/update route, before Prisma create
import { businessDaysBetween } from '../utils/businessDays.js';

const daysBack = businessDaysBetween(new Date(fechaIncidente), new Date());
if (fechaIncidente > new Date() || daysBack > 2) {
  return res.status(400).json({
    success: false,
    message: 'La fecha del incidente debe estar dentro de los últimos 2 días hábiles',
    field: 'fechaIncidente'
  });
}
```

`businessDaysBetween(a, b)` lives in `backend/src/utils/businessDays.ts` (NEW). v1 is weekday-only (no holiday table — see L6). The function should:
- Return 0 if same day and is a weekday.
- Return N where N is the count of weekdays strictly between `a` (inclusive) and `b` (inclusive).
- Treat Saturday, Sunday as non-business days.

### 5.6 `CertificadoUpdate` — added field

```json
{
  // ... existing fields ...
  "comprobantePagoUrl": "https://files.example.com/cert-updates/comprobante-7.pdf"  // or null
}
```

W1 wave-2 extends `addCertificateUpdateSchema` Zod to accept `comprobantePagoUrl?: string (≤500)`.

---

## 6. Migration order & lockstep expectations

| File | Applies | Idempotent guards | Affects existing rows |
|---|---|---|---|
| `20260710024539_jul9_additive_fields` | before M1 → `ADD COLUMN`, `DROP NOT NULL`, `CREATE TYPE` | none (first application) | none |
| `20260710024613_jul9_nota_fecha_incidente` | before M2 → `ADD COLUMN` → `UPDATE` backfill → `ALTER COLUMN SET NOT NULL` → `CREATE INDEX` | `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` | backfills `fecha_incidente = fecha::date` for rows that existed pre-M2 (4/4 in dev) |
| `20260710024705_jul9_educacion_empleado` | before M3 → new table + index + FK | none | none |
| `20260710024928_jul9_cargo_empresa` | before M4 → table + indexes + FK + seed | `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, `DO $$ ... IF NOT EXISTS` blocks for FK constraints, `ON CONFLICT DO NOTHING` for seed | none (zero contratos existed) |

All four are **applied in dev (`miempresa_dev`)** and ready to roll forward to staging/prod via `prisma migrate deploy` once that promotion happens.

---

## 7. Endpoints the API worker (W1 wave-2) must implement

| T | Item | Routes |
|---|---|---|
| T2 | `comprobantePagoUrl` on `CertificadoUpdate` | `POST /api/v1/certificates/:id/updates` (extend Zod), `GET .../updates` (no change) |
| T3 | `fechaIncidente` + business-day validation | `POST /api/v1/notas-clientes`, `PATCH /api/v1/notas-clientes/:id`, `GET /api/v1/clientes/:clienteId/notas` (list preview includes `fechaIncidente` formatted DD/MM/YYYY) |
| T4 | cliente fields + empleado educación + documento | `POST/PATCH /api/v1/clientes`, `POST/PATCH /api/v1/empleados` + sección Educación (CRUD on `/api/v1/empleados/:id/educacion[/...]`) + file-upload hook for documento |
| T5 | contrato archivoFirmado + cargos CRUD | `POST/PATCH /api/v1/contratos` accepts `archivoFirmadoUrl?` + `cargoId?` (cargoId required by UI but optional at API until wave-3), full CRUD on `/api/v1/empresa/cargos[/:id]` |

---

## 8. Deviations from the task assignment (full list)

| # | Assignment said | Actual implementation | File where it's documented |
|---|---|---|---|
| 1 | `Empleado.nivelEscritura → nullable` | `EducacionIdiomas.nivelEscritura → nullable` (corrected model — the column lived on idiomas, not empleado) | `proposed-plan.md` + progress-report |
| 2 | `Contrato.cargo String → Contrato.cargoId Int? + backfill` | No `cargo` column existed; added `cargoId Int?` only with no backfill. Nullable (no SET NOT NULL) | `proposed-plan.md §2.1`; `decisions/d7-cargo-migration-approval.md` |
| 3 | "KEEP `Contrato.cargo` column for now (deprecate later)" | Nothing to keep — column never existed | same |

All three deviations were surfaced via `proposed-plan.md` before any M4 SQL ran.

---

## 9. Verification snapshot (executed 2026-07-10)

```text
✓ npx prisma migrate status  →  18 migrations, "Database schema is up to date!"
✓ curl http://localhost:3101/api/v1/health  →  200
✓ INFORMATION_SCHEMA confirms: comprobante_pago_url, fecha_cumpleanos, tipo_sangre, eps,
                                 documento_identificacion_url, archivo_firmado_url
✓ educacion_idiomas.nivel_escritura is_nullable = YES
✓ notas_clientes: 4 / 4 rows have fecha_incidente NOT NULL
✓ cargos_empresa: 7 rows seeded (empresa_id=6)
✓ contratos.cargo_id: integer nullable
✓ FK contratos_cargo_id_fkey exists (fk to cargos_empresa(cargo_id) ON DELETE SET NULL)
✓ FK cargos_empresa_empresa_id_fkey exists (fk to empresas(id) ON DELETE CASCADE)
```

---

## 10. Grep keys for cross-doc searchability

```
schema-contract schemaContract jul9 improvements-jul-9 contract
comprobantePagoUrl fechaIncidente fechaCumpleanos tipoSangre eps CargoEmpresa archivoFirmadoUrl
documentoIdentificacionUrl EducacionEmpleado nivelEscritura educacionEmpleado cargos_empresa
TipoSangre 2-business-day weekday-only L1 L3 L5 L6 cargoId
```
