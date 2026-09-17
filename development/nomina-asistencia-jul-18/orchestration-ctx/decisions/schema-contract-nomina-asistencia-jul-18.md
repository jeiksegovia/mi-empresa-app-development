# Schema Contract — nomina-asistencia-jul-18

**Owner**: W1 backend-eng  
**Status**: AUTHORITATIVE for W2/W3  
**Updated**: 2026-07-18

Downstream workers: **do not invent names from schema.prisma** — this document is source of truth for field names, enums, request/response shapes, errors, and calc algorithm.

---

## 1. Enums

```
MedioPagoNomina: NEQUI | TRANSFERENCIA_BANCARIA
TipoCuentaBanco: AHORRO | CORRIENTE
```

Prisma enum names match exactly. Column maps use snake_case in DB.

---

## 2. Empleado — medio de pago

### Fields (all nullable)

| API (camelCase) | DB column | Type | Notes |
|---|---|---|---|
| `medioPagoTipo` | `medio_pago_tipo` | `MedioPagoNomina?` | null = no medio |
| `medioPagoNequi` | `medio_pago_nequi` | `string?` max 50 | required when tipo=NEQUI |
| `bancoNombre` | `banco_nombre` | `string?` max 100 | required when tipo=TRANSFERENCIA_BANCARIA |
| `bancoTipoCuenta` | `banco_tipo_cuenta` | `TipoCuentaBanco?` | required when tipo=TRANSFERENCIA_BANCARIA |
| `bancoNumeroCuenta` | `banco_numero_cuenta` | `string?` max 50 | required when tipo=TRANSFERENCIA_BANCARIA |

### Conditional validation (Zod + service)

- `medioPagoTipo` omitted/null → all other medio fields optional; **no** conditional 400.
- `medioPagoTipo = 'NEQUI'` → `medioPagoNequi` required non-empty → else **400** `field: 'medioPagoNequi'`.
- `medioPagoTipo = 'TRANSFERENCIA_BANCARIA'` → `bancoNombre`, `bancoTipoCuenta`, `bancoNumeroCuenta` all required → else **400** with first missing field name.
- On NEQUI: bank fields are cleared/stored null.
- On TRANSFERENCIA: nequi field cleared/stored null.

### Pendiente constant

```ts
export const PENDIENTE_MEDIO_PAGO = 'Falta medio de pago de nómina'
```

- After **create** or **update**, service calls `syncMedioPagoPendiente(empleadoId, userId)`.
- If medio is **incomplete** (tipo null OR conditional fields missing): ensure exactly one open manual pendiente whose `descripcion` equals or startsWith `PENDIENTE_MEDIO_PAGO` (idempotent).
- If medio is **complete**: resolve all matching open pendientes → `estado: 'RESUELTO'`, set `fechaResuelto`.
- Create path needs `userId` from `req.user.id` for `creadoPor`.

### Request/response

POST `/api/v1/employees` and PUT `/api/v1/employees/:id` accept medio fields in body.

GET employee detail returns medio fields on the employee object.

POST without medio → **201** + open pendiente with exact text.

---

## 3. Contrato — valorJornada

| API | DB | Type | Notes |
|---|---|---|---|
| `valorJornada` | `valor_jornada` | `number` (Decimal 12,2) | **Required on CREATE**; nullable in DB for legacy |

### Validation

- POST `/api/v1/nomina/employees/:id/contratos`: `valorJornada: z.number().nonnegative()` **required**.
  - Missing/null → **400** `{ success:false, message, field:'valorJornada' }`
- PUT same path: `valorJornada` optional when provided must be `number().nonnegative()`.
- Response includes `valorJornada` (number or null).

---

## 4. AsistenciaEmpleado

| API | DB | Type |
|---|---|---|
| `id` | `asistencia_id` | int |
| `empleadoId` | `empleado_id` | int |
| `fecha` | `fecha` | date YYYY-MM-DD |
| `jornadaAm` | `jornada_am` | boolean default false |
| `jornadaPm` | `jornada_pm` | boolean default false |
| `notas` | `notas` | string? max 500 |
| `registradoPor` | `registrado_por` | int (Usuario.id) |

- Unique `(empleadoId, fecha)`
- **No rate fields** on this model.
- `medias` for a day = `(jornadaAm?1:0) + (jornadaPm?1:0)`
- `horas` = `medias * 4`

### Domain RBAC

```
Domain += 'asistencia'
GERONTOLOGA.asistencia = false
CONTRATOS.asistencia = true
```

Routes: `authMiddleware` + `requireDomain('asistencia')`. Writes do **not** require ADMIN in v1 (unlike nomina periodos).

### Endpoints

#### GET `/api/v1/asistencia?fecha=YYYY-MM-DD`

Returns all **ACTIVO** employees (regardless of contract) with that day's flags.

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "empleadoId": 3,
      "jornadaAm": true,
      "jornadaPm": false,
      "notas": null,
      "empleado": {
        "id": 3,
        "nombre": "ANA",
        "apellido": "PEREZ",
        "numeroDocumento": "123",
        "estado": "ACTIVO"
      }
    }
  ]
}
```

When no attendance row exists for an employee, still include them with `id: null`, `jornadaAm: false`, `jornadaPm: false`, `notas: null`.

Missing/invalid `fecha` → **400**.

#### PUT `/api/v1/asistencia/dia`

```json
{
  "fecha": "2026-07-18",
  "items": [
    { "empleadoId": 3, "jornadaAm": true, "jornadaPm": false, "notas": "opcional" }
  ]
}
```

- Upserts each item by `(empleadoId, fecha)`.
- Sets `registradoPor` from auth user.
- Returns `{ success:true, data: [saved rows...] }`.

#### GET `/api/v1/asistencia/resumen?periodo=YYYY-MM&empleadoId?`

```json
{
  "success": true,
  "data": [
    { "empleadoId": 3, "mediasJornadas": 12, "horas": 48 }
  ]
}
```

Sum over all days in month for each empleado that has rows (or filter one). Employees with zero attendance may be omitted.

---

## 5. NominaPeriodo — calc fields

| API | DB | Type |
|---|---|---|
| `mediasJornadas` | `medias_jornadas` | Decimal? 8,2 |
| `valorJornada` | `valor_jornada` | Decimal? 12,2 |
| `subtotalCalculado` | `subtotal_calculado` | Decimal? 12,2 |
| `aportesSociales` | `aportes_sociales` | Decimal? 12,2 |
| `totalPagado` | `total_pagado` | Decimal? 12,2 |
| `salario` | `salario` | Decimal? — **dual-write** = `totalPagado` when total set |

### Calc algorithm (create/update period)

1. Resolve active contrato (existing rule; 400 if none).
2. Cuenta-cobro rule unchanged for OPS/OBRA_O_LABOR.
3. `aportesSociales` default `0`.
4. If `aportesSociales > 0` and `tipoContrato ∈ {OPS, OBRA_O_LABOR}` → **400**  
   `{ success:false, message:'Aportes sociales no aplican para este tipo de contrato', field:'aportesSociales' }`
5. Aportes allowed for `TERMINO_FIJO` | `TERMINO_INDEFINIDO`.
6. Defaults when omitted:
   - `mediasJornadas` ← sum of medias for empleado in month of `periodo` (from AsistenciaEmpleado)
   - `valorJornada` ← active contrato `valorJornada` (may be null)
7. `subtotalCalculado` ← if client sent it use it; else `mediasJornadas * valorJornada` (0 if either null)
8. `totalPagado` ← if client sent it use it; else `subtotalCalculado + aportesSociales`
9. Dual-write: if `totalPagado` is set (including computed default), `salario = totalPagado`
10. Total override allowed: client may send `totalPagado ≠ subtotal+aportes`; server stores without reject.

### GET `/api/v1/nomina?periodo=YYYY-MM`

Each row:

```json
{
  "empleado": { "id", "nombre", "apellido", "numeroDocumento",
    "medioPagoTipo", "medioPagoNequi", "bancoNombre", "bancoTipoCuenta", "bancoNumeroCuenta" },
  "contratoActivo": { /* existing + valorJornada */ } | null,
  "entrada": { /* NominaPeriodo incl. calc fields + archivos */ } | null,
  "cargoSalario": number | null,
  "asistenciaMes": { "mediasJornadas": number, "horas": number },
  "sugerido": {
    "mediasJornadas": number,
    "valorJornada": number | null,
    "subtotalCalculado": number,
    "aportesSociales": 0,
    "totalPagado": number
  }
}
```

`sugerido` is computed for the dialog when no entrada or as reference; does not persist.

### POST/PUT periodos body extras

```
mediasJornadas?: number
valorJornada?: number
subtotalCalculado?: number
aportesSociales?: number
totalPagado?: number
// existing: empleadoId, periodo, salario?, notas?, archivos?
```

Response data includes all calc fields + dual-written salario.

---

## 6. Domain matrix delta

```ts
export type Domain = ... | 'asistencia'

GERONTOLOGA: { ..., asistencia: false }
CONTRATOS:   { ..., asistencia: true }
```

Mirror on FE in W2 (`useDomainAccess.ts`).

---

## 7. Error shapes

| Case | Status | Body |
|---|---|---|
| Zod validation | 400 | `{ success:false, message:'Validation error', errors:{ path:[msgs] } }` |
| Field business rule | 400 | `{ success:false, message, field }` |
| Cuenta cobro (existing) | 400 | `{ success:false, message, field:'archivos.CUENTA_COBRO' }` |
| Duplicate period | 409 | `{ success:false, message:'Ya existe entrada para este periodo' }` |
| Domain forbidden | 403 | `{ success:false, message, code:'DOMAIN_FORBIDDEN' }` |

---

## 8. Migration

- Folder: `backend/prisma/migrations/20260718100000_nomina_asistencia/`
- Pure additive: no backfill, no shadow DB.
- Apply: `npx prisma migrate deploy` (or project usual) from `backend/`.

---

## 9. Deviations

| # | Assignment said | Found / decided | Impact |
|---|---|---|---|
| D1 | — | Asistencia writes not ADMIN-gated (only domain) | Intentional per R13 |
| D2 | — | GET day board includes employees without attendance as synthetic rows with `id:null` | FE-friendly matrix |
| D3 | — | `sugerido` object on GET /nomina is computed-only | FE dialog bootstrap |

---

## 10. Integration notes for W2

- Contract path: this file.
- FE-critical response shapes: §4 day board, §5 GET /nomina enrichment (`asistenciaMes`, medio on empleado, `sugerido`).
- Pendiente text must match exactly for list UI.
- Domain key string: `'asistencia'`.
- Sidebar gate: same as empleados matrix for CONTRATOS.
