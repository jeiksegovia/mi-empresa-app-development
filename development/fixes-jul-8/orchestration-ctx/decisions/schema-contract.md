# Schema Contract — W2 ↔ W4 Handoff

**Audience:** W4 (Frontend-B: certificados + instrumentos) — also relevant to W3 (Frontend-A: fichas + nomina) since it touches nomina validation feedback.
**Date:** 2026-07-09
**Backend version:** W2 completed; backend running on `http://localhost:3101`, base path `/api/v1`.

This document is the **single source of truth** for the new/changed Prisma model, enums, request/response shapes, and validation errors that the frontend must consume. If anything in this file contradicts what the backend code appears to do, file a `TURNING-POINT-BREAKING:` against W2.

---

## 1. Enums (verbatim from `prisma/schema.prisma`)

### `RolUsuario` (used for `rolesPermitidos` refinement)
```
ADMIN
EMPLEADO
AUDITOR
OPERADOR
```
- The backend `POST /instruments` (and `PUT`) Zod schema now requires each comma-split value of `rolesPermitidos` to equal one of these four strings (case-sensitive). Trim is applied to each part.
- Comma-joined string is still the **on-the-wire shape**. The DB column remains `roles_permitidos VARCHAR(255)`.
- Frontend MultiSelect values: `['ADMIN','EMPLEADO','AUDITOR','OPERADOR']`. On submit: `selected.join(',')`.

### `TipoContrato` (used for nomina validation + filter)
```
OPS
OBRA_O_LABOR
TERMINO_FIJO
TERMINO_INDEFINIDO
```
- Comma-separated query param values are uppercased server-side.
- `NONE` is a **synthetic** value that only the `/nomina?tipoContrato=...` filter accepts; it never appears as an actual `TipoContrato`.

### `EstadoCertificadoEmpresa` (computation rule)
```
VIGENTE
VENCIDO
PENDIENTE
```
- After a `POST /certificates/:id/updates` carrying a `fechaVencimiento`, the parent `CertificadoEmpresa.estado` is recomputed:
  - `fechaVencimiento` is in the future (>= today's UTC date) → `VIGENTE`
  - past → `VENCIDO`
  - `fechaVencimiento` not provided in the update AND parent has none → keep parent state (effectively `PENDIENTE`)
- The frontend can rely on `estado` always being current after re-fetching the certificate.

### `EstadoRegistroFicha` (transitions)
```
PENDIENTE
COMPLETADO
VENCIDO
```
- Backend transition table now:
  - `PENDIENTE → { COMPLETADO, VENCIDO }`
  - `COMPLETADO → { VENCIDO }`
  - `VENCIDO  → { COMPLETADO }` ← **changed by W2 per D3**

### `TipoArchivoNomina` (unchanged)
```
CUENTA_COBRO
INFORME_ACTIVIDADES
COMPROBANTE_APORTES
DESPRENDIBLE
OTRO
```

---

## 2. NEW Prisma model — `CertificadoUpdate`

```prisma
model CertificadoUpdate {
  id                Int                       @id @default(autoincrement()) @map("cert_update_id")
  certificadoId     Int                       @map("certificado_id")
  archivoUrl        String?                   @map("archivo_url") @db.VarChar(500)
  notas             String?                   @db.Text
  fechaEmision      DateTime?                 @map("fecha_emision") @db.Date
  fechaVencimiento  DateTime?                 @map("fecha_vencimiento") @db.Date
  creadoPor         Int                       @map("creado_por")
  createdAt         DateTime                  @default(now()) @map("created_at")

  certificado       CertificadoEmpresa        @relation("CertificadoUpdates", fields: [certificadoId], references: [id], onDelete: Cascade)
  creador           Usuario                   @relation("CertificadoUpdateCreador", fields: [creadoPor], references: [id])

  @@index([certificadoId])
  @@index([createdAt])
  @@map("certificados_empresa_updates")
}
```

### JS / JSON shape (`CertificateUpdateRecord`)
```ts
interface CertificateUpdateRecord {
  id: number                  // DB column cert_update_id
  certificadoId: number       // FK to certificados_empresa.cert_empresa_id
  archivoUrl: string | null   // DB column archivo_url (S3 key, max 500 chars)
  notas: string | null        // DB column notas (free-form text)
  fechaEmision: string | null // ISO date "YYYY-MM-DDTHH:mm:ss.sssZ" — may be null
  fechaVencimiento: string | null
  creadoPor: number           // FK to usuarios.id
  createdAt: string           // ISO datetime
}
```

### Semantics
- **Append-only.** Rows are never updated or deleted via the API.
- **Snapshot rule.** The "current" view of a `CertificadoEmpresa` is its parent row's `archivoUrl` / `fechaEmision` / `fechaVencimiento` / `estado`. Every `POST /updates` both appends a history row and mutates the parent snapshot.
- The history table is the audit trail the user asked for ("… in case user need to validate any old file updates or note updated previously added").

---

## 3. NEW endpoints

### 3.1 `POST /api/v1/certificates/:id/updates`

Append a CertificadoUpdate row + update parent snapshot + recompute parent `estado`.

**Auth:** required, role = `ADMIN`.
**Path:** `/api/v1/certificates/{id}/updates` where `{id}` is integer.
**Body (JSON):**
```ts
interface AddCertificateUpdateBody {
  archivoUrl?: string         // required-or-optional: at least one of the four fields
  notas?: string
  fechaEmision?: string       // any string parseable by `new Date()`
  fechaVencimiento?: string
}
```
The Zod schema also enforces `archivoUrl` length `1..500` if provided. `.refine()` requires at least one of the four fields to be present (no empty updates).

**Success — 201:**
```json
{
  "success": true,
  "data": {
    "update": { /* CertificateUpdateRecord */ },
    "certificate": { /* CertEmpresa row after parent mutation */ }
  }
}
```

**Error cases:**

| Status | Body | Cause |
|---|---|---|
| 400 | `{ success: false, message: "Invalid certificate ID" }` | non-integer `id` |
| 400 | `{ success: false, message: "Validation failed", errors: { field: [msg] } }` | Zod refinement failure (empty body, too-long `archivoUrl`, bad date) |
| 401 | (auth middleware) | no session |
| 403 | (auth middleware) | role != ADMIN |
| 404 | `{ success: false, message: "Certificate not found" }` | certificate doesn't exist |
| 500 | `{ success: false, message: "Error adding certificate update" }` | unexpected |

### 3.2 `GET /api/v1/certificates/:id/updates`

**Auth:** required (any role).
**Path:** `/api/v1/certificates/{id}/updates`
**Query params:** none.

**Success — 200:**
```json
{
  "success": true,
  "data": [
    { /* CertificateUpdateRecord — newest first by createdAt */ },
    ...
  ]
}
```

**Error cases:** same shape as 3.1 for invalid id / not-found / 500.

---

## 4. CHANGED endpoints

### 4.1 `POST /api/v1/instruments` and `PUT /api/v1/instruments/:id`

The `rolesPermitidos` field is now Zod-refined against the `RolUsuario` enum.

**Body (creation):** unchanged except `rolesPermitidos` must be a non-empty comma-separated string of `ADMIN` / `EMPLEADO` / `AUDITOR` / `OPERADOR` (trim OK, case-sensitive).

**Error — 400 on invalid role:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "rolesPermitidos": [
      "rolesPermitidos must be a comma-separated list of valid RolUsuario values (ADMIN, EMPLEADO, AUDITOR, OPERADOR)"
    ]
  }
}
```

### 4.2 `PATCH /api/v1/patients/:id/fichas/:fichaId/status`

Now backed by Zod schema. Body must be:
```ts
interface UpdateFichaStatusBody {
  estado: 'PENDIENTE' | 'COMPLETADO' | 'VENCIDO'
  archivoCompletado?: string     // min 1 char; required when estado='COMPLETADO'
  notasObservaciones?: string
  fechaVencimiento?: string       // any Date-parseable string; storable as Date
}
```

**New transition allowed:** `VENCIDO → COMPLETADO`.

**Error — 400 on Zod failure:**
```json
{ "success": false, "message": "Validation failed", "errors": [ /* ZodError[] */ ] }
```

**Error — 400 on invalid transition:**
```json
{ "success": false, "message": "Cannot transition from {from} to {to}" }
```

**Error — 400 on missing file:**
```json
{ "success": false, "message": "archivoCompletado is required when transitioning to COMPLETADO" }
```

The Open Question raised in W1 research ("… admin override VENCIDO?") is **resolved** by W2: VENCIDO → COMPLETADO is now permitted. Frontend should remove the `:disabled="data.estado === 'VENCIDO'"` clause from the pencil button and let `availableTransitions.length > 0` gate it.

### 4.3 `GET /api/v1/nomina`

Now accepts an optional comma-separated `tipoContrato` query param.

**Default** (no param): only `empleado.estado='ACTIVO'` AND `empleado` has at least one active contract. (NB: this is intentionally narrower than the prior behaviour — `tipoContrato=NONE` must be passed to recover the old default.)

**With param:** each value is one of:
- `OPS`
- `OBRA_O_LABOR`
- `TERMINO_FIJO`
- `TERMINO_INDEFINIDO`
- `NONE` — include empleados with no active contract

Multiple values are OR-combined. `tipoContrato=OPS,OBRA_O_LABOR` returns OPS + OBRA_O_LABOR employees. Add `NONE` to also include contract-less ones. Pure `NONE` returns only contract-less employees.

**Error — 400 on no valid values:**
```json
{ "success": false, "message": "tipoContrato must be a comma-separated list of OPS,OBRA_O_LABOR,TERMINO_FIJO,TERMINO_INDEFINIDO,NONE" }
```

**Otherwise:** response shape unchanged —
```json
{ "success": true, "data": [ { empleado, contratoActivo, entrada, cargoSalario }, ... ] }
```

### 4.4 `POST /api/v1/nomina/periodos`

Existing `cuenta_de_cobro` rule is **now enforced**. The backend refuses to insert a `NominaPeriodo` for an `OPS`/`OBRA_O_LABOR` empleado if the request body does not include an `archivos[]` entry with `tipoArchivo === 'CUENTA_COBRO'`.

**Error — 400 (validation from the service, NOT from Zod):**
```json
{
  "success": false,
  "message": "Cuenta de cobro requerida para contratos OPS/OBRA_O_LABOR",
  "field": "archivos.CUENTA_COBRO"
}
```
The `field` key is the contract the frontend should render inline next to the missing slot.

All other validation paths unchanged. The Zod-validated `nominaPeriodoSchema` still applies first, then the service-level check runs (so the order of error responses depends on which fails first).

---

## 5. Stable identifiers W4 should NOT regenerate

| Key | Value (use exactly) |
|---|---|
| New model DB table | `certificados_empresa_updates` |
| New model PK column | `cert_update_id` |
| New model FK columns | `certificado_id`, `creado_por` |
| Endpoint paths | `/api/v1/certificates/:id/updates` (both methods) |
| Filter query param | `tipoContrato` (case-sensitive at HTTP boundary; server uppercases) |
| Synthetic filter value | `NONE` |
| Error field key for OPS/OOL cuenta-de-cobro | `archivos.CUENTA_COBRO` |
| Roles enum literal set | `['ADMIN','EMPLEADO','AUDITOR','OPERADOR']` |
| Transition rule change | `VENCIDO → COMPLETADO` is now allowed |

---

## 6. Files W2 changed (for W4 reference)

```
backend/prisma/schema.prisma                                       (added CertificadoUpdate)
backend/prisma/migrations/20260709025844_add_certificado_update/    (new migration)
backend/src/services/certificateService.ts                          (added methods + CertificateError)
backend/src/routes/certificates.routes.ts                           (added 2 routes + addCertificateUpdateSchema)
backend/src/routes/instruments.routes.ts                           (refine on rolesPermitidos)
backend/src/routes/patients.routes.ts                               (Zod on PATCH fichas, VENCIDO→COMPLETADO)
backend/src/services/nominaService.ts                               (cuenta-de-cobro check, tipoContrato filter)
backend/src/routes/nomina.routes.ts                                 (pass query param, surface field on 400)
```

---

## 7. Quick curl reproduction (for W4 if it needs to test independently)

```bash
# Login & save cookie
curl -s -c /tmp/cookies.txt -X POST http://localhost:3101/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@miempresa.com","password":"<redacted>"}'

# Append a CertificadoUpdate
curl -s -b /tmp/cookies.txt -X POST http://localhost:3101/api/v1/certificates/96/updates \
  -H "Content-Type: application/json" \
  -d '{"archivoUrl":"certificados/test.pdf","notas":"sanity check","fechaVencimiento":"2027-12-31"}'

# Read history
curl -s -b /tmp/cookies.txt http://localhost:3101/api/v1/certificates/96/updates

# Try to invent a role (should 400)
curl -s -b /tmp/cookies.txt -X POST http://localhost:3101/api/v1/instruments \
  -H "Content-Type: application/json" \
  -d '{"nombreInstrumento":"X","tipo":"VALORACION","periodicidad":"UNICA","rolesPermitidos":"ADMIN,SUPERHEROE","versionPlantilla":"v1"}'

# Recover a VENCIDO ficha (D3)
curl -s -b /tmp/cookies.txt -X PATCH http://localhost:3101/api/v1/patients/72/fichas/44/status \
  -H "Content-Type: application/json" \
  -d '{"estado":"COMPLETADO","archivoCompletado":"fichas/late.pdf"}'

# Filter nomina by OPS only
curl -s -b /tmp/cookies.txt "http://localhost:3101/api/v1/nomina?periodo=2026-07&tipoContrato=OPS"

# Force OPS sin cuenta-de-cobro to fail
curl -s -b /tmp/cookies.txt -X POST http://localhost:3101/api/v1/nomina/periodos \
  -H "Content-Type: application/json" \
  -d '{"empleadoId":101,"periodo":"2026-07","archivos":[{"tipoArchivo":"INFORME_ACTIVIDADES","nombre":"informe.pdf","url":"fichas/informe.pdf"}]}'
```
