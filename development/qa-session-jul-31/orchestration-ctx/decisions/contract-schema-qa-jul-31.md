# Schema & Behavior Contract: qa-session-jul-31

**Author:** W1 (pt-fullstack-impl)
**Date:** 2026-08-02
**Status:** Published · authoritative source for W2 (frontend).
**Read first, before opening any `*.prisma` or DB file.**

This contract is the shared interface for the 3 QA-Jul-31 items (R1, R2/R2b, R3). W2 must
implement to this contract — they should **not** read `schema.prisma` directly. Any change
that conflicts with this doc is a breaking change and must be escalated.

**Source of truth (do not duplicate):**
- `backend/prisma/schema.prisma` — schema
- `backend/prisma/migrations/<new_add_eps_fondo_arl>/migration.sql` — DDL (this wave)
- `backend/src/services/employeeService.ts:50-69,127-206,411-659` — `EmpleadoDetail`,
  `CreateEmployeeInput`, `UpdateEmployeeInput`, `getEmployee`, `createEmployee`,
  `updateEmployee`
- `backend/src/services/nominaService.ts:263-303` — `getNominaMonth` suggestion payload
- `backend/src/routes/employees.routes.ts:22-184` — Zod schemas

---

## 1. Enums

### `MedioPagoNomina` (Empleado.medioPagoTipo)
- Values: `NEQUI` | `TRANSFERENCIA_BANCARIA` | `EFECTIVO`
- Unchanged this migration.
- **R1**: the option label renders as **`Nequi/Bre-B`**. The stored enum value is
  still `NEQUI`. No backend change.

### `TipoContrato` (Contrato.tipoContrato, NominaPeriodo.tipoContrato)
- Values: `OPS` | `OBRA_O_LABOR` | `TERMINO_FIJO` | `TERMINO_INDEFINIDO`
- Unchanged this migration.

---

## 2. Empleado — R3: EPS / Fondo de pensiones / ARL

Three new optional free-text fields. Pattern matches `bancoNombre` (free text VARCHAR,
no catalog, no validation beyond length).

| DB column | Type | Nullable | Notes |
|-----------|------|----------|-------|
| `eps` | `VARCHAR(100)` | yes | Free text (e.g. "Sura", "Sanitas"). No catalog. |
| `fondo_pensiones` | `VARCHAR(100)` | yes | Free text (e.g. "Porvenir", "Colfondos"). No catalog. |
| `arl` | `VARCHAR(100)` | yes | Free text (e.g. "Positiva", "Sura ARL"). No catalog. |

API-layer field names (camelCase) match exactly:
- `eps`
- `fondoPensiones`
- `arl`

### Validation
- All three are optional at the API layer: omitting them in create/update must NOT error.
- When provided, max length **100** characters. Trim is **not** required (preserve
  user-entered casing/whitespace, matching the existing `bancoNombre` behavior).
- No enum/catalog validation. No cross-field validation. No normalization.

### Persistence rules (mirrors `bancoNombre` in jul-24 R7)
- Create: if the field is present in the payload → persist the trimmed/non-null value.
- Update (partial): if the field is present in the payload → overwrite. If absent →
  preserve the existing value (do NOT null out).
- These fields are returned by `GET /employees/:id` (`empleadoService.getEmployee`),
  `GET /employees` (only summary fields today — these are NOT in `EmployeeSummary`,
  consistent with how `bancoNombre` is excluded from list view), and by `create` /
  `update` responses.
- They belong to the **Datos personales** step of the employee form. No new step
  is introduced.

---

## 3. Contrato & Nómina interface — R2/R2b

The nómina "Registrar" dialog must branch on `contratoActivo.tipoContrato`. The
matrix below is the source of truth for both the dialog UI and the BE suggestion
payload.

| `tipoContrato` | Base shown | Medias jornadas input | Valor jornada input | Aportes sociales | Total = base + aportes? |
|---|---|---|---|---|---|
| `OPS` | `mediasJornadas × valorJornada` (subtotal) | **shown** | **shown** | hidden (not used) | n/a |
| `OBRA_O_LABOR` | `valorMensual` | **hidden** | **hidden** | hidden | `valorMensual` only (no aportes) |
| `TERMINO_FIJO` | `valorMensual` | **hidden** | **hidden** | **shown** | `valorMensual + aportes` |
| `TERMINO_INDEFINIDO` | `valorMensual` | **hidden** | **hidden** | **shown** | `valorMensual + aportes` |

- For all non-OPS contracts, `Total a pagar` is still **manually adjustable** (the
  user may override with a different number); the UI pre-fills from the table above.
- The "valor media jornada (contrato)" info/warning chip is shown only for OPS.
- D1: `OBRA_O_LABOR` has **no aportes** (aportes are gated to FIJO/INDEF only,
  matching the existing `APORTES_ALLOWED` set in `nominaService.ts:46`).

### R2b — backend suggestion payload (already implemented in jul-24 R7)

The endpoint `GET /nomina?periodo=YYYY-MM[&tipoContrato=...]` already returns the
sugerencia block below (see `nominaService.getNominaMonth` lines 263-301). W2 must
read **only the `sugerido` block** for prefilling the dialog. No new field is added
this wave.

```ts
{
  empleado: { id, nombre, apellido, numeroDocumento, medioPagoTipo, /* ... */ },
  contratoActivo: {
    id, empleadoId, tipoContrato, fechaInicio, fechaFin,
    valorJornada,    // null for non-OPS
    valorMensual,    // null for OPS
    cargo: { id, nombre, /* ... */ }
  },
  entrada: NominaPeriodo | null,   // existing per-period snapshot, if any
  cargoSalario: number | null,
  asistenciaMes: { mediasJornadas: number, horas: number },
  sugerido: {
    mediasJornadas:    number | null,  // null for non-OPS
    valorJornada:      number | null,  // null for non-OPS
    valorMensual:      number | null,  // null for OPS
    subtotalCalculado: number | null,  // null for non-OPS (per D2)
    aportesSociales:   number,         // 0 for OPS/OBRA (D1), pre-filled from existing entrada if FIJO/INDEF
    totalPagado:       number          // base + aportes (manual override allowed)
  }
}
```

**Prefill rules for W2 (R2):**

| `tipoContrato` | Base to prefill (`sugerido.*`) | Default aportes (`sugerido.aportesSociales`) |
|---|---|---|
| `OPS` | `subtotalCalculado` (= `mediasJornadas × valorJornada`) | always 0 |
| `OBRA_O_LABOR` | `valorMensual` | always 0 (field hidden) |
| `TERMINO_FIJO` | `valorMensual` | pre-fill from `entrada?.aportesSociales` if it exists, else 0 |
| `TERMINO_INDEFINIDO` | `valorMensual` | pre-fill from `entrada?.aportesSociales` if it exists, else 0 |

If the user has already saved a `NominaPeriodo` for this month (`entrada` is non-null),
the dialog opens with the **stored** values from `entrada` (the user is *editing*,
not creating). W2 already does this; no change.

### No new BE fields for R2/R2b
- The BE already returns everything W2 needs from jul-24 R7. **No new code, no new
  fields, no new migration.** This contract documents the existing shape so W2 can
  implement the dialog branch without re-reading `nominaService.ts`.
- Validation rules in `nominaService.resolveCalcFields` (the `aportes` non-zero +
  non-FIJO/INDEF guard) already match D1. No change.

---

## 4. R1 — Nequi → Nequi/Bre-B label

**Display-only change** in these UI surfaces:
- `frontend/app/pages/empleados/nuevo.vue`
- `frontend/app/pages/empleados/[id]/index.vue` (detail page)
- `frontend/app/pages/empleados/[id]/editar.vue`
- `frontend/app/pages/asistencia/index.vue` *(no — this page is asistencia, not
  employee; corrected: only the **4 employee/nómina surfaces** below)*

The actual pages are:
- `frontend/app/pages/empleados/nuevo.vue` (Medio de pago dropdown)
- `frontend/app/pages/empleados/[id]/index.vue` (Medio de pago display)
- `frontend/app/pages/empleados/[id]/editar.vue` (Medio de pago dropdown)
- `frontend/app/pages/nomina/index.vue` (anywhere Nequi is shown for the empleado)

Rules:
- The `<option value="NEQUI">` text reads `Nequi/Bre-B` (Spanish label, capital N).
- When displaying a stored `medioPagoTipo === 'NEQUI'`, render the same label
  `Nequi/Bre-B`.
- No change to the `value`, the API payload, the DB enum, or the validation regex.

---

## 5. Cross-cutting acceptance

For the whole team to consider the wave done:
1. `npx prisma migrate status` clean against local `:15432`. Migration
   `add_empleado_eps_fondo_arl` applied. 3 new nullable VARCHAR(100) columns on
   `empleados`. Prisma client regenerated. *(DONE for W1.)*
2. `empleados.eps` / `empleados.fondo_pensiones` / `empleados.arl` exist,
   nullable, no rows back-filled, no default. *(DONE for W1.)*
3. `POST /employees` and `PUT /employees/:id` accept, persist, and return
   `eps`/`fondoPensiones`/`arl` (optional). Omitting them does NOT error.
4. `GET /employees/:id` returns the 3 fields when present; `null` when not.
5. `GET /nomina?periodo=YYYY-MM` returns a `sugerido` block with
   `valorMensual != null` for non-OPS contracts and `totalPagado == valorMensual`
   for OPS/OBRA/no-aportes inputs. *(Already implemented in jul-24 R7; verified.)*
6. W1 backend tests cover: eps/fondoPensiones/arl create+update round-trip,
   partial update omitting all 3, suggestion valorMensual for FIJO/INDEF/OBRA.
7. W2 frontend tests cover: Nequi/Bre-B label on the 4 surfaces, R2 dialog
   matrix, R3 fields create/editar/detail round-trip.

---

## 6. Out of scope for this contract

- Staging deploy: gated step, deferred.
- Centros de costos / cajas (ingresos/egresos) — separate cycle (dev decision
  2026-08-02).
- Any enum/catalog for EPS / Fondo / ARL — free-text only this wave.
- Google Drive / Excel sync mismatch — not an app issue.
- Changing `nominaService.resolveCalcFields` behavior — already correct per jul-24.
- New routes, new services, new tables.