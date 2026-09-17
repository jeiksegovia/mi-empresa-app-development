# Schema & Behavior Contract: qa-session-aug-17

**Author:** W1 (pt-data-schema)
**Date:** 2026-08-18
**Status:** Published · authoritative source for W2 (backend) and W3 (frontend).
**Read first, before opening any `schema.prisma`, `domainAccess.ts`, or `useDomainAccess.ts` file.**

This contract is the shared interface for the aug-17 QA cycle
(R1: empleados Activos/Inactivos tabs · R2: CONTRATOS GET cargos exception ·
R3: nómina bonos + total-without-aportes · R4: periodos validation/auth ·
R6: Registro de actividades). W2 and W3 must implement to this contract —
they should **not** invent names from `schema.prisma` or reverse-engineer
the existing matrix. Any change that conflicts with this doc is a breaking
change and must be escalated via `TURNING-POINT-BREAKING`.

**Source of truth (do not duplicate elsewhere):**
- This file for names, formulas, ACL, error codes, testids, seed users.
- `backend/prisma/schema.prisma` after W1 migration lands (physical columns).
- `backend/src/middleware/domainAccess.ts` + FE `useDomainAccess.ts` must
  mirror §2 cell-by-cell (W2 owns BE, W3 owns FE — both copy from here).

---

## 1. Domain vocabulary (extension)

### 1.1 `Domain` union — add `actividades`

```ts
// backend/src/middleware/domainAccess.ts  AND  frontend/app/composables/useDomainAccess.ts
export type Domain =
  | 'pacientes'
  | 'fichas'
  | 'instrumentos'
  | 'empleados'
  | 'nomina'
  | 'certificados'
  | 'empresa'
  | 'notas'
  | 'asistencia'
  | 'centro-costos'
  | 'actividades'   // NEW — qa-session-aug-17 R6
```

`DomainAccessValue` vocabulary is **unchanged**:
`boolean | 'create-only' | 'read-only'`.

| Value | GET | POST | PUT/PATCH/DELETE |
|---|---|---|---|
| `true` | ✓ | ✓ | ✓ |
| `false` | ✗ 403 `DOMAIN_FORBIDDEN` | ✗ | ✗ |
| `'create-only'` | ✓ | ✓ | ✗ 403 |
| `'read-only'` | ✓ | ✗ 403 | ✗ 403 |

ADMIN always bypasses the matrix (existing rule).

### 1.2 `DOMAIN_ACCESS` matrix cells for `actividades` (authoritative)

Only the **new column** is listed. Existing cells for other domains are
**unchanged** this cycle (including `CONTRATOS.empresa = false`).

| TipoEmpleado | `actividades` cell | Meaning |
|---|---|---|
| `GERONTOLOGA` | `'read-only'` | GET only |
| `CONTRATOS` | `'read-only'` | GET only |
| `PROFESORES` | `'create-only'` | GET + POST; PUT/DELETE blocked by matrix |
| `AUXILIARES` | `'create-only'` | GET + POST; PUT/DELETE blocked by matrix |

Literal snippet W2/W3 must paste into their matrix rows:

```ts
GERONTOLOGA: { /* …unchanged…, */ actividades: 'read-only' },
CONTRATOS:   { /* …unchanged…, */ actividades: 'read-only' },
PROFESORES:  { /* …unchanged…, */ actividades: 'create-only' },
AUXILIARES:  { /* …unchanged…, */ actividades: 'create-only' },
```

### 1.3 Service-layer rules (NOT matrix values)

These live in `actividadService` / route handlers — same pattern as notes
`autor` filter and asistencia today-only. **Do not encode them as matrix cells.**

| Rule | Applies to | Behavior |
|---|---|---|
| Own-item filter | `PROFESORES`, `AUXILIARES` | LIST/GET forced to `where.empleadoId = caller.empleadoId`. Cannot POST for another empleado. |
| Today-only write | `PROFESORES`, `AUXILIARES` | POST `fecha` must equal `serverTodayBogota()` (America/Bogotá `YYYY-MM-DD`). Else 403. |
| ADMIN any-date / any-empleado | `ADMIN` | May POST with optional `empleadoId`; may PUT/DELETE any row; any `fecha`. |
| Missing `empleadoId` on caller | non-ADMIN writers | 400 `EMPLEADO_REQUIRED` when `Usuario.empleadoId` is null. |

Reuse `serverTodayBogota` from `backend/src/routes/asistencia.routes.ts`
(extract to a shared helper if W2 prefers; signature must stay
`() => string` returning `YYYY-MM-DD` in America/Bogotá).

### 1.4 FE nav / path map

```ts
// useDomainAccess.ts DOMAIN_PREFIX_MAP — add:
{ prefix: '/actividades', domain: 'actividades' }

// app.config.ts sidebar — insert IMMEDIATELY AFTER Asistencia:
{ label: 'Registro de actividades', icon: 'pi pi-list', to: '/actividades' }
```

Visible when `can('actividades')` is true (ADMIN + the four tipos above).

---

## 2. Route-level exception — CONTRATOS GET `/empresa/cargos` (R2)

**Matrix cell stays `CONTRATOS.empresa = false`.** Do **not** flip it.

W2 implements a **route-level exception** on `GET /empresa/cargos` only:

- If caller is `EMPLEADO + CONTRATOS` and the request would otherwise 403
  via `requireDomain('empresa')`, allow the GET.
- `POST` / `PATCH` / `PUT` / `DELETE` on `/empresa/cargos` remain blocked
  (matrix false + existing `requireRole('ADMIN')` on writes).
- Do **not** open the whole `empresa` router to CONTRATOS.

matrix-parity specs must keep asserting `CONTRATOS.empresa === false` and
document the exception in a comment (not as a matrix cell).

Error envelope on denied writes stays:
`{ success: false, message: 'Acceso no permitido para su perfil', code: 'DOMAIN_FORBIDDEN' }`
status 403.

---

## 3. Nómina — `bonos` + formulas (R3) + periodos auth (R4)

### 3.1 Schema field (W1)

On `NominaPeriodo` / table `nomina_periodos`:

| Prisma field | DB column | Type | Null | Notes |
|---|---|---|---|---|
| `bonos` | `bonos` | `Decimal? @db.Decimal(12, 2)` | YES | Additive. Existing rows → `NULL`. Treat `NULL` as `0` in formulas. |

No other money columns change. `valorMensual` continues to live on
`Contrato` (request may override for calc; it is **not** a new
`nomina_periodos` column).

### 3.2 Constants

```ts
export const BONOS_ALLOWED: ReadonlySet<string> = new Set([
  'TERMINO_FIJO',
  'TERMINO_INDEFINIDO',
])
// APORTES_ALLOWED stays: TERMINO_FIJO | TERMINO_INDEFINIDO (unchanged)
```

- Reject `bonos > 0` (or non-null non-zero) unless `tipoContrato ∈ BONOS_ALLOWED`
  → 400, `field: 'bonos'`.
- OPS / `OBRA_O_LABOR`: no bonos UI; if client sends `bonos`, treat as
  invalid (400) when `> 0`. Prefer rejecting rather than silently dropping.

### 3.3 Formulas (`resolveCalcFields`) — **authoritative**

Let `B = Number(bonos ?? 0)`, `V = Number(valorMensual ?? 0)`,
`A = Number(aportesSociales ?? 0)`, `M = mediasJornadas`, `J = valorJornada`.

| `tipoContrato` | `subtotalCalculado` | `totalPagado` | Notes |
|---|---|---|---|
| `TERMINO_FIJO` | `V + B` | `V + B` | **Aportes stored, NOT added.** This is the intentional change vs prior `(V + A)`. |
| `TERMINO_INDEFINIDO` | `V + B` | `V + B` | Same as FIJO. |
| `OBRA_O_LABOR` | `null` (unchanged) | `V` | No bonos. No aportes. |
| `OPS` | `M * J` (existing) | **unchanged this cycle** | Do **not** change OPS total formula. Whatever OPS does today (including whether aportes are added) stays. Bound the risk. |

Client-supplied `subtotalCalculado` / `totalPagado` overrides remain allowed
(existing behavior) but FE must send values that match the formulas above
for FIJO/INDEF.

Dual-write `salario = totalPagado` stays.

### 3.4 Periodos POST/PUT auth (R4)

```
POST /nomina/periodos  → requireDomain('nomina') + requireEmployeeUnlocked('empleadoId')
PUT  /nomina/periodos/:id → requireDomain('nomina') + requireEmployeeUnlocked('empleadoId')
                           (resolve empleadoId from body OR existing row — W2 picks;
                            body.empleadoId preferred when present)
DELETE /nomina/periodos/:id → stays requireRole('ADMIN')  (not requested to open)
```

**Drop** `requireRole('ADMIN')` on POST/PUT. CONTRATOS already pass
`requireDomain('nomina')`. Locked empleado → 403 `EMPLOYEE_LOCKED`.

### 3.5 Required fields by `tipoContrato` (create)

| Tipo | Required | Must NOT require |
|---|---|---|
| `TERMINO_FIJO` / `TERMINO_INDEFINIDO` | `empleadoId`, `periodo`, base mensual source (`valorMensual` from active contrato or body) | `valorJornada`, `mediasJornadas` |
| `OBRA_O_LABOR` | same as FIJO (no bonos) | `valorJornada`, `mediasJornadas` |
| `OPS` | `empleadoId`, `periodo`, `valorJornada` (on create) | — |

`aportesSociales` optional (default 0). `bonos` optional (default null/0),
only meaningful for FIJO/INDEF.

### 3.6 API JSON names (periodos)

Request/response camelCase (existing convention):

```ts
{
  id: number
  empleadoId: number
  periodo: string            // YYYY-MM (API) / Date (DB day-1)
  tipoContrato: TipoContrato
  valorMensual: number | null  // from contrato / override (response convenience)
  bonos: number | null         // NEW
  mediasJornadas: number | null
  valorJornada: number | null
  subtotalCalculado: number | null
  aportesSociales: number | null
  totalPagado: number | null
  salario: number | null
  notas?: string | null
  archivos?: ...
}
```

---

## 4. `RegistroActividad` model (R6)

### 4.1 Prisma model (exact)

```prisma
model RegistroActividad {
  id            Int      @id @default(autoincrement()) @map("registro_actividad_id")
  empleadoId    Int      @map("empleado_id")
  fecha         DateTime @db.Date
  texto         String   @db.Text
  registradoPor Int      @map("registrado_por")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  empleado    Empleado @relation(fields: [empleadoId], references: [id], onDelete: Cascade)
  registrador Usuario  @relation("ActividadRegistrador", fields: [registradoPor], references: [id])

  @@unique([empleadoId, fecha])
  @@index([fecha])
  @@index([empleadoId])
  @@map("registro_actividades")
}
```

### 4.2 Relation back-references (exact names)

```prisma
// on Empleado:
registrosActividad RegistroActividad[]

// on Usuario:
actividadesRegistradas RegistroActividad[] @relation("ActividadRegistrador")
```

Pattern mirrors `AsistenciaEmpleado` / `AsistenciaRegistrador`.

### 4.3 API — `/api/v1/actividades`

All routes behind `authMiddleware` + `requireDomain('actividades')`.

| Method | Path | Who | Body / query | Success | Errors |
|---|---|---|---|---|---|
| `GET` | `/actividades` | matrix GET roles | query `fecha?: YYYY-MM-DD`, `empleadoId?: number` | 200 `{ success, data: RegistroActividad[] }` | 403 matrix |
| `POST` | `/actividades` | ADMIN or create-only | `{ fecha: YYYY-MM-DD, texto: string, empleadoId?: number }` | 201 `{ success, data }` | 400 `EMPLEADO_REQUIRED`; 403 today-only / own-item; 409 unique |
| `PUT` | `/actividades/:id` | **ADMIN only** | `{ texto?: string, fecha?: YYYY-MM-DD }` | 200 | 403 non-admin (matrix or explicit); 404; 409 if fecha collides |
| `DELETE` | `/actividades/:id` | **ADMIN only** | — | 200/204 | 403; 404 |

**POST rules detail:**
1. Resolve target `empleadoId`:
   - ADMIN: `body.empleadoId` required if admin has no self link **or** may pass explicitly; if omitted and admin has `empleadoId`, may default to self — **prefer requiring `empleadoId` for ADMIN when acting for others; for self-service roles always use caller.**
   - PROFESORES / AUXILIARES: ignore/forbid foreign `empleadoId`; always use `caller.empleadoId`. Sending another id → 403.
2. If resolved `empleadoId` is null → 400 `{ success:false, code:'EMPLEADO_REQUIRED', message:'Empleado requerido' }`.
3. Today-only: if tipo ∈ {PROFESORES, AUXILIARES} and `fecha !== serverTodayBogota()` → 403
   `{ success:false, code:'DOMAIN_FORBIDDEN', message:'Solo puede registrar la fecha de hoy' }`
   (or a dedicated code if W2 prefers — default `DOMAIN_FORBIDDEN`).
4. Unique `(empleadoId, fecha)` violation → 409
   `{ success:false, code:'DUPLICATE_DAY', message:'Ya existe un registro para este día' }`.
5. `texto` required, non-empty trimmed string.

**GET rules detail:**
- PROFESORES / AUXILIARES: force filter `empleadoId = caller.empleadoId` (ignore foreign query param or 403).
- ADMIN / GERONTOLOGA / CONTRATOS: unfiltered except optional query params.

### 4.4 Response shape

```ts
interface RegistroActividadDto {
  id: number
  empleadoId: number
  fecha: string            // YYYY-MM-DD
  texto: string
  registradoPor: number
  createdAt: string        // ISO
  updatedAt: string        // ISO
}
```

---

## 5. Error codes (shared)

| HTTP | `code` | When |
|---|---|---|
| 403 | `DOMAIN_FORBIDDEN` | Matrix deny; today-only deny; own-item deny |
| 403 | `EMPLOYEE_LOCKED` | `requireEmployeeUnlocked` on periodos / contratos |
| 400 | `EMPLEADO_REQUIRED` | Writer has no `Usuario.empleadoId` |
| 400 | *(field-level)* | Zod / `field: 'bonos' \| 'valorJornada' \| …` |
| 409 | `DUPLICATE_DAY` | Unique `(empleadoId, fecha)` on actividades |
| 404 | *(existing)* | Missing periodo / actividad |

Envelope: `{ success: false, message: string, code?: string, field?: string }`.

---

## 6. Frontend testids (locked — W3 must not invent)

| Surface | `data-testid` |
|---|---|
| Empleados tab Activos | `empleados-tab-activos` |
| Empleados tab Inactivos | `empleados-tab-inactivos` |
| Nómina dialog Bonos input | `nomina-bonos` |
| Nómina dialog Subtotal | `nomina-subtotal` |
| Nómina dialog Aportes | `nomina-aportes` |
| Nómina dialog Total a pagar | `nomina-total` |
| Actividades fecha | `actividades-fecha` |
| Actividades texto | `actividades-texto` |
| Actividades guardar | `actividades-guardar` |

### 6.1 R1 tabs behavior (FE)

- Replace estado dropdown with two tabs Activos | Inactivos.
- Default tab = Activos → first paint calls `GET /employees?estado=ACTIVO`.
- Switching to Inactivos → `estado=INACTIVO`.
- **No "Todos" tab.** Stats cards must not reset the filter to empty/Todos.

### 6.2 R3 dialog field order (FIJO / INDEF only)

Valor mensual → **Bonos** (`nomina-bonos`) → Subtotal (`nomina-subtotal`) →
Aportes sociales (`nomina-aportes`, helper: referente / no suma) →
Total a pagar (`nomina-total`, helper: mensual + bonos).

OPS / OBRA: hide bonos input entirely.

---

## 7. Local seed users (R6 tests) — W1 owns `backend/prisma/seed.ts`

Extend the **user-create** section of `seed.ts`. Do **not** revive deleted
finance/empleado legacy seed blocks beyond the minimal Empleado rows needed
to link these two users.

| Email | Password | `rol` | `tipoEmpleado` | Linked Empleado |
|---|---|---|---|---|
| `profesor@miempresa.com` | `<redacted>` | `EMPLEADO` | `PROFESORES` | yes (`Usuario.empleadoId` set) |
| `auxiliar@miempresa.com` | `<redacted>` | `EMPLEADO` | `AUXILIARES` | yes |

Minimal `Empleado` required fields (per current schema):

```ts
{
  nombre, apellido,
  tipoDocumento: 'CC',
  numeroDocumento: '<unique>',  // e.g. '900000001' / '900000002'
  genero: 'Masculino' | 'Femenino',
  fechaNacimiento: new Date('1990-01-01'),
  estado: 'ACTIVO',
  // permisoTrabajo default false — ok
}
```

Also delete `registroActividad` in the clean-slate block (before `empleado`
delete) so re-seed does not trip FKs.

Console summary must print the two new credentials alongside the existing four.

**Out of scope this cycle:** staging `seed-qa.ts` / SSM users for
PROFESORES/AUXILIARES (deploy task later).

---

## 8. Migration (W1)

Directory:
`backend/prisma/migrations/<YYYYMMDDHHMMSS>_add_nomina_bonos_and_registro_actividades/`

Contents:
- `migration.sql` — additive only
- (Prisma may also write `migration_lock.toml` at migrations root — already exists; do not touch)

SQL gist:

```sql
-- bonos on nomina_periodos (nullable → existing rows safe)
ALTER TABLE "nomina_periodos"
  ADD COLUMN IF NOT EXISTS "bonos" DECIMAL(12,2);

-- registro_actividades
CREATE TABLE IF NOT EXISTS "registro_actividades" (
  "registro_actividad_id" SERIAL PRIMARY KEY,
  "empleado_id" INTEGER NOT NULL,
  "fecha" DATE NOT NULL,
  "texto" TEXT NOT NULL,
  "registrado_por" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registro_actividades_empleado_id_fkey"
    FOREIGN KEY ("empleado_id") REFERENCES "empleados"("empleado_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "registro_actividades_registrado_por_fkey"
    FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "registro_actividades_empleado_id_fecha_key"
  ON "registro_actividades"("empleado_id", "fecha");
CREATE INDEX IF NOT EXISTS "registro_actividades_fecha_idx"
  ON "registro_actividades"("fecha");
CREATE INDEX IF NOT EXISTS "registro_actividades_empleado_id_idx"
  ON "registro_actividades"("empleado_id");
```

Row-count risk: **low** — `bonos` nullable, no backfill; new table empty.
Apply with `npx prisma migrate deploy` in `backend/`.
**Never** `--shadow-database-url`.

Down (documented for reversibility; Prisma deploy does not auto-run it):

```sql
DROP TABLE IF EXISTS "registro_actividades";
ALTER TABLE "nomina_periodos" DROP COLUMN IF EXISTS "bonos";
```

---

## 9. File ownership (who touches what)

| Surface | W1 | W2 | W3 |
|---|---|---|---|
| `contract-schema-qa-aug-17.md` | author | read | read |
| `schema.prisma` + migration | ✓ | — | — |
| `seed.ts` (profesor/auxiliar + Empleado) | ✓ | — | — |
| `domainAccess.ts` (`actividades` cell + Domain union) | — | ✓ | — |
| `empresa.routes.ts` GET cargos exception | — | ✓ | — |
| `nomina.routes.ts` / `nominaService.ts` (bonos, formulas, auth) | — | ✓ | — |
| `actividades.routes.ts` + `actividadService.ts` (new) | — | ✓ | — |
| `routes/index.ts` mount | — | ✓ | — |
| BE Playwright specs | — | ✓ | — |
| `useDomainAccess.ts` + `DOMAIN_PREFIX_MAP` | — | — | ✓ |
| `app.config.ts` sidebar | — | — | ✓ |
| `empleados/index.vue` tabs | — | — | ✓ |
| `nomina/index.vue` bonos UI + formula | — | — | ✓ |
| `actividades/index.vue` (new) | — | — | ✓ |
| `shared/types/api.ts` | — | — | ✓ (Dto types) |
| FE Playwright specs | — | — | ✓ |

---

## 10. Deviations / locked product decisions

| # | Decision | Notes |
|---|---|---|
| D1 | `CONTRATOS.empresa` stays `false` | GET cargos is route exception only |
| D2 | Bonos only FIJO/INDEF | OPS/OBRA reject non-zero bonos |
| D3 | FIJO/INDEF `totalPagado = valorMensual + bonos` | Aportes stored, **not** added (changes prior `+ aportes` behavior) |
| D4 | OPS total formula **unchanged** this cycle | Even if it still adds aportes |
| D5 | OBRA `totalPagado = valorMensual` | No bonos, no aportes; subtotal stays null |
| D6 | Actividades unique per (empleadoId, fecha) | Second POST same day → 409; ADMIN edits via PUT |
| D7 | Own-item + today-only are **service rules** | Not matrix values |
| D8 | Periodos POST/PUT: unlock middleware, not ADMIN role | DELETE stays ADMIN |
| D9 | No staging seed for PROFESORES/AUXILIARES this cycle | Local `seed.ts` only |
| D10 | No commit / no deploy in worker scope | Orchestrator-gated |

---

## 11. Cross-cutting acceptance

1. Contract published at this path; W2/W3 start from it (no schema.prisma diving for names).
2. Migration applied locally (`prisma migrate status` clean on `:15432`).
3. `NominaPeriodo.bonos` nullable Decimal(12,2); `RegistroActividad` mapped to `registro_actividades` with `@@unique([empleadoId, fecha])`.
4. DOMAIN_ACCESS FE ↔ BE parity includes `actividades` cells per §1.2; `CONTRATOS.empresa === false`.
5. FIJO/INDEF save round-trip: `totalPagado === valorMensual + bonos` and `bonos` persisted.
6. qa-contratos GET `/empresa/cargos` → 200; writes → 403.
7. Seed login `profesor@miempresa.com` / `auxiliar@miempresa.com` / `<redacted>` with non-null `empleadoId`.
8. Smoke Playwright specs assert new money math + R6 ACL (W2/W3).
