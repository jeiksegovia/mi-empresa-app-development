# Schema & Behavior Contract: qa-session-jul-24

**Author:** W1 (pt-data-schema)
**Date:** 2026-07-31
**Status:** Published · authoritative source for W2 (backend) and W3 (frontend).
**Read first, before opening any `*.prisma` or DB file.**

This contract is the shared interface for the 7 QA-Jul-24 items (R1–R7). W2 and W3 must
implement to this contract — they should **not** read `schema.prisma` directly. Any change
that conflicts with this doc is a breaking change and must be escalated.

**Source of truth (do not duplicate):**
- `backend/prisma/schema.prisma` — schema
- `backend/prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/` — DDL
- `backend/src/services/empresaService.ts:35-49` — `DEFAULT_CARGOS` (lockstep with the migration)
- `orchestration-ctx/decisions/cargos-fk-reassignment.md` — fallback-cargo decision

---

## 1. Enums

### `MedioPagoNomina` (Empleado.medioPagoTipo)
- Values: `NEQUI` | `TRANSFERENCIA_BANCARIA` | **`EFECTIVO`** *(new this migration)*
- EFECTIVO requires no extra payment fields.

### `TipoContrato` (Contrato.tipoContrato, NominaPeriodo.tipoContrato)
- Values: `OPS` | `OBRA_O_LABOR` | `TERMINO_FIJO` | `TERMINO_INDEFINIDO`
- Unchanged this migration.

### `TipoCuentaBanco` (Empleado.bancoTipoCuenta)
- Values: `AHORRO` | `CORRIENTE`
- Unchanged this migration.

---

## 2. Empleado payment fields (5 nullable columns, set 1+ when medioPagoTipo is set)

| DB column | Type | Notes |
|-----------|------|-------|
| `medio_pago_tipo` | `MedioPagoNomina` (enum) | Required to mean anything; `null` = "no payment set". |
| `medio_pago_nequi` | `VARCHAR(50)` | The "llave" — phone, email, or alphanumeric handle. See §3 for validation. |
| `banco_nombre` | `VARCHAR(100)` | Free text. |
| `banco_tipo_cuenta` | `TipoCuentaBanco` (enum) | `AHORRO` or `CORRIENTE`. |
| `banco_numero_cuenta` | `VARCHAR(50)` | Free text. |

API-layer field names (camelCase) match exactly:
- `medioPagoTipo`
- `medioPagoNequi`
- `bancoNombre`
- `bancoTipoCuenta`
- `bancoNumeroCuenta`

### Per-medio required-field matrix (validation target)
| medioPagoTipo | medioPagoNequi | bancoNombre | bancoTipoCuenta | bancoNumeroCuenta |
|---|---|---|---|---|
| `NEQUI` | **required** (see §3) | — | — | — |
| `TRANSFERENCIA_BANCARIA` | — | **required** | **required** | **required** |
| `EFECTIVO` | — | — | — | — |

---

## 3. Nequi "llave" validation rule (R1)

The Nequi llave (`medioPagoNequi`, max 50 chars) must be **either**:
1. A valid email address (RFC-5322 simplified), **or**
2. An alphanumeric handle of length **6 to 25** characters, made of `[A-Za-z0-9]` only,
   with at least one letter **and** at least one digit (to keep it from being a phone number
   in disguise).

**Explicitly rejected:** pure numeric strings (10–15 digits), or any other character class.

**Regex to use (both W2 and W3 must use the same expression):**

```regex
/^(?:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{6,25})$/
```

W2 should wrap it in a Zod refinement (or equivalent) on the employee create/update
endpoints, erroring with `status: 400, field: 'medioPagoNequi'` when medioPagoTipo=NEQUI
and the value fails.

W3 should run the same regex on the input and surface the same error text in the
"Medio de pago" section of `empleados/nuevo.vue` and `empleados/[id]/editar.vue`.

For EFECTIVO, neither Nequi nor bank fields are required — the UI may hide them.

---

## 4. Contrato salary rule (R7)

Both `valorJornada` and `valorMensual` are **nullable** in the DB. Validation is at the
API layer, **branched on `tipoContrato`**:

| `tipoContrato` | Required field | Column | Notes |
|---|---|---|---|
| `OPS` | `valorJornada` | `contratos.valor_jornada DECIMAL(12,2)` | Rate per media-jornada (4h). |
| `OBRA_O_LABOR` | `valorMensual` | `contratos.valor_mensual DECIMAL(12,2)` | New this migration. |
| `TERMINO_FIJO` | `valorMensual` | `contratos.valor_mensual DECIMAL(12,2)` | New this migration. |
| `TERMINO_INDEFINIDO` | `valorMensual` | `contratos.valor_mensual DECIMAL(12,2)` | New this migration. |

API-layer field names: `valorJornada`, `valorMensual`.

W2 must:
- Reject create/update when the required field is null for the given `tipoContrato`
  (`status: 400, field: <the missing field>`).
- Branch `nominaService` on `tipoContrato`:
  - `OPS` → existing logic: `totalPagado = mediasJornadas * valorJornada - aportesSociales`.
  - others → use `valorMensual` as the base; the existing per-period
    `mediasJornadas/subtotalCalculado` snapshot is `null` for these contracts (acceptable
    per the D2 decision — nómina treats null gracefully).

W3 must:
- Show `valorJornada` when `tipoContrato=OPS`, `valorMensual` otherwise; hide the other
  field. Form validation mirrors W2.

---

## 5. Asistencia RBAC + note (R6)

### Field name
- DB column: `asistencia_empleados.notas` (VARCHAR 500, nullable).
- API/UI field name: **`notas`**.
- UI label: "Justificación" (or "Nota de justificación"); required only when jornadaAM=false
  AND jornadaPM=false (i.e. registering a non-attendance with a reason). Otherwise optional.

### RBAC: who can PUT asistencia for which date
| Role | Allowed `fecha` range | Behavior |
|---|---|---|
| `ADMIN` | any date (past, today, future) | Full read/write. |
| `CONTRATOS` (sub-role of `EMPLEADO`) | **`fecha == today`** only | Server-local America/Bogota; see §5.1. |
| `EMPLEADO` (no sub-role / `GERONTOLOGA`) | none on this endpoint | — |
| `AUDITOR`, `OPERADOR` | read-only | No PUT. |

**W2 (backend):** in the asistencia PUT handler, after authn/authz, compute
`serverToday` and reject with `status: 403, field: 'fecha'` if
`user.rol === 'EMPLEADO' && user.tipoEmpleado === 'CONTRATOS' && fecha !== serverToday`.
ADMIN bypasses the check.

### 5.1 "Today" computation (must be byte-identical on W2 and W3)
- Use `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())` to
  produce a `YYYY-MM-DD` string. `en-CA` is the only stable locale that emits ISO date.
- Compare as strings (`'2026-07-31'`) — do not parse to `Date` and back, to avoid drift
  across server TZ. W2 may also do this in SQL with
  `((NOW() AT TIME ZONE 'America/Bogota')::date)::text` for the canonical answer, but
  the JS helper above is the safe cross-runtime source.
- W3 (UI): when rendering the date picker for a CONTRATOS user, set `:disabled-date`
  to dates ≠ today, and the input `value` to today. This is display-only; the
  authoritative check is server-side.

---

## 6. Target cargo list (R4, decision D1)

**Exactly these 10 strings, in this order**, used in:
- `backend/src/services/empresaService.ts:35-49` `DEFAULT_CARGOS`
- the migration seed (`cargos_empresa` for every empresa)
- the frontend `Cargo` select options

| # | nombre | Notes |
|---|---|---|
| 1 | `Administrador` | Base |
| 2 | `Auxiliar de Enfermería` | Base (preserved from jul-9 list) |
| 3 | `Gerontólogo/Gerontóloga` | Base |
| 4 | `Servicios Generales` | Base (renamed from "Auxiliar de Servicios Generales") |
| 5 | `Temporal` | Base — also the **fallback cargo** for cargo reassignment |
| 6 | `Terapeuta Ocupacional` | Profesional |
| 7 | `Fisioterapeuta` | Profesional |
| 8 | `Psicólogo` | Profesional |
| 9 | `Educador Físico` | Profesional |
| 10 | `Artes y Manualidades` | Profesional (renamed from "Manualidades") |

**Removed:** `Cocinera`, `Otro`, `Auxiliar de Servicios Generales`, `Manualidades`,
`Auxiliar QA` (local QA fixture, not in target list — deleted by this migration).

**Reassign-on-delete behavior:** every existing contrato that referenced a non-target
cargo is now repointed to its empresa's `Temporal` cargo. Per-contract cargo semantics
are intentionally not preserved (developer accepted).

---

## 7. Employee update behavior (R2)

The employee update endpoint must support **partial update** of the 5 payment fields
(§2) **by both ADMIN and CONTRATOS** (sub-role of EMPLEADO). Other employee fields
follow the existing RBAC matrix.

Validation rules for partial payment-field updates:
- If `medioPagoTipo` is in the payload, the per-medio required-field matrix (§2) applies
  to the **merged** resulting state (existing + new), not just the new values. Otherwise
  a user could erase their own bank name by submitting only `medioPagoTipo: 'NEQUI'`.
- If `medioPagoTipo` is **not** in the payload but other payment fields are, the existing
  `medioPagoTipo` is preserved and its required-field matrix is re-checked against the
  merged state. If it fails, return `status: 400, field: <missing>`.

---

## 8. Cross-cutting acceptance

For the whole team to consider the wave done:
1. `npx prisma migrate status` clean against local `:15432`. *(DONE for W1.)*
2. `cargos_empresa` has exactly the 10 target rows for the active empresa
   *(empresa_id=14 has all 10; verified).*
3. `enum MedioPagoNomina` = `{NEQUI, TRANSFERENCIA_BANCARIA, EFECTIVO}` *(verified).*
4. `contratos.valor_mensual` column exists, nullable, no rows back-filled
   *(verified — 0 rows non-null, all existing contracts OPS-style).*
5. W2 backend tests cover: Nequi validation matrix, valorJornada/valorMensual branch,
   asistencia RBAC, partial payment-field update, default-cargo bootstrap.
6. W3 frontend tests cover: EFECTIVO option in selector, Nequi llave validation feedback,
   cargo preview in profile, contract form per-tipo, asistencia date lock + nota.

---

## 9. Out of scope for this contract

- Staging deploy: gated step, deferred.
- New routes/services: none — extends existing `empleadoService`, `contratoService`,
  `nominaService`, `asistenciaService`, `empresaService`.
- `Cargo` (per-employee, not per-empresa): UI-only removal (Item 3) — see W3.
- Migration safety on staging: cargo delete+recreate re-runs are safe (IF NOT EXISTS
  on enum, ON CONFLICT DO NOTHING on seed, guard clause). The
  `cargos-fk-reassignment.md` decision note covers the deploy-gate checklist.
