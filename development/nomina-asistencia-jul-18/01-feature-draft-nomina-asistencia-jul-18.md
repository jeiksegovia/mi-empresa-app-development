# Feature Draft: nomina-asistencia-jul-18

**Status**: AWAITING DEVELOPER APPROVAL (no implementation / no worker spawn until approved)  
**Slug**: `nomina-asistencia-jul-18`  
**Inputs**: cleaned QA Jul-17 + user answers 2026-07-18

---

## 1. Locked product decisions

| Decision | Choice |
|---|---|
| Daily attendance unit | **AM/PM media jornadas** per employee+day (each media = 4h). Hours derived = medias × 4. |
| Rate storage | **On Contrato only**: `valorJornada` (required for payroll calc when using jornadas). Optional future `valorHora` not in v1 unless needed for display. |
| Nómina total | **Computed default, editable override**: `medias × valorJornada + aportes` pre-fills total; user can change total with optional note. |
| Medio de pago | **Optional on create**; if missing → `PendienteEmpleado` “Falta medio de pago de nómina”. |
| Transfer fields | **Full bank**: banco + tipo cuenta (AHORRO/CORRIENTE) + número. **Nequi**: número only. |
| Aportes | **Only TERMINO_FIJO + TERMINO_INDEFINIDO** (amount field + existing COMPROBANTE_APORTES slot). |
| Asistencia nav | **New sidebar item**, same level as Empleados, **below Empleados**. |
| RBAC | Same domain as empleados/nómina → **CONTRATOS + ADMIN** (and legacy EMPLEADO null). GERONTOLOGA: no. |

---

## 2. Domain model sketch (v1)

### 2.1 Empleado — medio de pago

```
Empleado
  + medioPagoTipo     MedioPagoNomina?   // NEQUI | TRANSFERENCIA_BANCARIA | null
  + medioPagoNequi    String?            // required if NEQUI
  + bancoNombre       String?            // required if TRANSFERENCIA
  + bancoTipoCuenta   TipoCuentaBanco?   // AHORRO | CORRIENTE
  + bancoNumeroCuenta String?            // required if TRANSFERENCIA
```

Validation (API):
- If `medioPagoTipo = NEQUI` → `medioPagoNequi` non-empty; bank fields null/ignored.
- If `TRANSFERENCIA_BANCARIA` → bancoNombre + bancoTipoCuenta + bancoNumeroCuenta required; nequi null/ignored.
- If all null → allowed; service creates pendiente if none exists open for this code.

### 2.2 Contrato — valor jornada

```
Contrato
  + valorJornada   Decimal?  // COP per media jornada (4h). Nullable for legacy rows; required when creating/editing contract after this feature (or warn + pendiente).
```

Payroll uses **active** contract’s `valorJornada`.

### 2.3 NEW: Asistencia

```
AsistenciaEmpleado
  id            Int
  empleadoId    Int
  fecha         Date          // calendar day
  jornadaAm     Boolean @default(false)
  jornadaPm     Boolean @default(false)
  // derived: mediasJornadas = (am?1:0)+(pm?1:0); horas = medias*4
  notas         String?
  registradoPor Int           // usuario id
  createdAt / updatedAt

  @@unique([empleadoId, fecha])
  @@index([fecha])
  @@index([empleadoId, fecha])
```

No rate fields on asistencia (QA hard rule).

### 2.4 NominaPeriodo — settlement enrichment

```
NominaPeriodo
  // existing: empleadoId, contratoId, periodo, tipoContrato, salario, notas, archivos
  + mediasJornadas      Decimal?   // snapshot count for month (from asistencia, editable)
  + valorJornada        Decimal?   // snapshot from contract at save time
  + subtotalCalculado   Decimal?   // medias * valorJornada
  + aportesSociales     Decimal?   // only meaningful for FIJO/INDEFINIDO; else null
  + totalPagado         Decimal?   // final amount (default = subtotal + aportes; user override allowed)
  // keep `salario` for backward compat: either map salario = totalPagado, or migrate UI to totalPagado and dual-write during transition
```

**Proposal (needs approval in this draft)**: dual-write `salario = totalPagado` for one release so old list columns keep working; UI labels use “Total a pagar”.

### 2.5 Enums

```
enum MedioPagoNomina { NEQUI, TRANSFERENCIA_BANCARIA }
enum TipoCuentaBanco { AHORRO, CORRIENTE }
```

---

## 3. Backend surface

### 3.1 Empleados

| Method | Path | Change |
|---|---|---|
| POST | `/employees` | Accept medio pago fields; create pendiente if missing |
| PATCH | `/employees/:id` | Same fields; resolve pendiente when completed |
| GET | `/employees/:id` | Return medio pago |

### 3.2 Contratos (via existing employee contract endpoints)

| Method | Path | Change |
|---|---|---|
| POST/PATCH | contract endpoints on employee | `valorJornada` required on new contracts (or 400 if missing when tipo needs pay) |

### 3.3 Asistencia (NEW)

| Method | Path | Purpose |
|---|---|---|
| GET | `/asistencia?fecha=YYYY-MM-DD` | Day board: active employees + that day’s AM/PM |
| GET | `/asistencia?desde=&hasta=&empleadoId=` | Range / employee history |
| GET | `/asistencia/resumen?periodo=YYYY-MM&empleadoId?` | Sum medias per employee for month (nómina) |
| PUT | `/asistencia/dia` | Upsert batch: `{ fecha, items: [{ empleadoId, jornadaAm, jornadaPm, notas? }] }` |
| PUT | `/asistencia/:empleadoId/:fecha` | Single upsert |

Domain middleware: `empleados` or new domain `asistencia` aliased to same matrix as empleados/nómina for CONTRATOS.

### 3.4 Nómina

| Method | Path | Change |
|---|---|---|
| GET | `/nomina?periodo=` | Enrich each row: medio pago, medias del mes, valorJornada contrato, suggested totals |
| POST/PATCH | `/nomina/periodos` | Accept mediasJornadas, valorJornada, aportesSociales, totalPagado; enforce aportes only FIJO/INDEFINIDO; snapshot payment method optional in response only |

Calc helper (server authoritative on create if client omits totals):

```
medias = input.mediasJornadas ?? sumAsistencia(empleado, mes)
valor  = input.valorJornada ?? activeContrato.valorJornada
subtotal = medias * valor
aportes = allowed ? (input.aportesSociales ?? 0) : 0
total = input.totalPagado ?? (subtotal + aportes)
```

Existing OPS/OBRA cuenta-de-cobro file rules **unchanged**.

---

## 4. Screen / flow drafts

### 4.1 Empleado → Crear / Editar

**Section “Medio de pago de nómina”** (after contact or before submit):

```
[ ] Tipo: ( ) Nequi  ( ) Transferencia bancaria  ( ) Sin definir

If Nequi:
  Número Nequi [____________]

If Transferencia:
  Banco [____________]
  Tipo cuenta [Ahorro ▾ / Corriente]
  Número de cuenta [____________]
```

- Not required to save employee.
- If “Sin definir” / empty → toast soft info + backend creates pendiente.
- Edit page: same section; clearing method re-opens pendiente.

**Contrato form** (create flow if multi-step, and edit contratos dialog):

```
Tipo contrato [OPS ▾]
Cargo empresa [____]
Valor media jornada (4h) [$________]   ← NEW
Fechas / archivos … (existing)
```

### 4.2 NEW page: Asistencia de empleados

**Route**: `/asistencia`  
**Sidebar**: icon calendar/clock, label **Asistencia**, order after Empleados.

#### View A — “Registrar hoy” (default)

```
┌ Asistencia ──────────────────────────────────────────┐
│ Fecha: [2026-07-18]  [Hoy]     Buscar empleado [🔍]  │
│                                                      │
│ Empleado          Cargo/Profesión    AM   PM   Notas │
│ ─────────────────────────────────────────────────── │
│ Ana Pérez         Aux. enfermería   [x]  [ ]  [   ] │
│ Luis Gómez        Serv. generales   [x]  [x]  [   ] │
│ …                                                    │
│                              [Guardar asistencia]    │
└──────────────────────────────────────────────────────┘
```

- Lists **ACTIVE** employees (optional filter by cargo later).
- Pre-checks existing rows for that date.
- Search filters the matrix client-side (and server query if large).
- Changing date reloads day board (any past/future day allowed in v1; no month-lock unless liquidated — see open residual).

#### View B — Calendar strip (same page)

Simple month grid or week strip above table:

- Day cells show aggregate “N medias registradas” or dot if any data.
- Click day → same as changing date.
- Goal: “see month at a glance + jump day” without a heavy Gantt.

#### Empty / edge

- Employee without active contract: still can mark attendance (QA: attendance independent of rate).
- No employees: empty state CTA to empleados.

### 4.3 Nómina → Registrar (dialog redesign)

**Entry**: existing month table → “Registrar” / “Editar” on row.

```
┌ Registrar nómina — Julio 2026 ───────────────────────┐
│ Empleado: Ana Pérez  CC 123…                         │
│ Medio de pago: Nequi 3001234567   (or Banco …)       │
│ Contrato: TERMINO_FIJO · Aux. enfermería             │
│ Valor media jornada: $ 40.000                        │
│                                                      │
│ Asistencia del mes:  22 medias  (88 h)               │
│   [Ver detalle asistencia → /asistencia?periodo=…]   │
│                                                      │
│ Medias jornadas [ 22 ]  ← editable snapshot          │
│ Valor jornada   [40000] ← editable snapshot          │
│ Subtotal        $ 880.000   (read-only calc)         │
│ Aportes sociales [$ 50.000]  ← only FIJO/INDEFINIDO  │
│ Total a pagar   [$ 930.000]  ← editable override     │
│ Notas           [________________]                   │
│                                                      │
│ Archivos (existing slots by tipo contrato)           │
│ … cuenta cobro / informe / comprobante aportes …     │
│                                    [Cancelar][Guardar]│
└──────────────────────────────────────────────────────┘
```

**Rules in UI**:
- Aportes field **hidden** for OPS / OBRA_O_LABOR.
- If medio pago missing: warning banner + link to editar empleado (does not block save in v1, matches optional rule).
- If no valorJornada on contract: warning; medias still shown; total may require manual override.
- List columns (enhancement): show medias + total when entrada exists.

### 4.4 Pendientes

On employee create/update without medio pago → ensure open `PendienteEmpleado`:

- descripcion: `Falta medio de pago de nómina`
- estado PENDIENTE  
When medio completed → mark that pendiente RESUELTO (match by description prefix or a stable `codigo` if we add one — prefer description match first to avoid schema churn; optional `codigo` field if already exists).

---

## 5. UX principles (Emkasa)

1. **Registrar hoy is one screen, one save** — bulk matrix, not per-employee navigations.
2. **Payroll never invents attendance** — it reads summary; user can still tweak snapshot.
3. **Spanish UI labels**; English code.
4. **Mobile-tolerant**: AM/PM checkboxes large touch targets; date picker primary control.
5. **Search first** when > ~15 employees.

---

## 6. Test plan (acceptance-level)

### Backend Playwright / API specs

- `tests/employees/medio-pago.spec.ts` — create with Nequi; create with transfer; create without → pendiente; patch completes pendiente.
- `tests/employees/contrato-valor-jornada.spec.ts` — contract CRUD with valorJornada.
- `tests/asistencia/asistencia-dia.spec.ts` — PUT day batch, unique employee+day, GET day board, GET resumen month.
- `tests/nomina/nomina-calc-asistencia.spec.ts` — month with 3 medias × rate; aportes rejected on OPS; allowed on FIJO; override total.

### Frontend Playwright

- `tests/asistencia/registrar-hoy.spec.ts` — open /asistencia, toggle AM/PM, save, reload persists.
- `tests/nomina/registrar-dialog-enrichment.spec.ts` — dialog shows medio, medias, valor, total.
- `tests/empleados/medio-pago-form.spec.ts` — form fields + optional submit.

---

## 7. Implementation waves (preview only — not started)

| Wave | Owner role | Deliverable |
|---|---|---|
| W1 | data/backend | Migration + contract doc (schema/API shapes) |
| W2 | backend | Asistencia + employee/contrato/nomina API |
| W3 | frontend | Empleado medio pago + contrato valorJornada |
| W4 | frontend | Asistencia page + sidebar |
| W5 | frontend | Nómina dialog enrichment |
| W6 | test-quality | Full suite vs contract |

Contract-first: W1 writes `orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`.

---

## 8. Explicitly out of scope (v1)

- Banco de Colombia batch / planilla export.
- Legal % auto-calc of security aportes.
- Hourly-mode company UI (data model keeps door open via horas = medias×4 only).
- Locking month after liquidación (can be v1.1).
- Per-hour registration UI (hours are derived).

---

## 9. Residual questions (non-blocking defaults if you approve as-is)

| # | Topic | Default if silent |
|---|---|---|
| R1 | Dual-write `salario = totalPagado`? | **Yes** |
| R2 | valorJornada required on new contracts? | **Yes** (400 if missing) |
| R3 | Edit attendance after nómina exists for month? | **Allowed** with warning; does not auto-update saved NominaPeriodo |
| R4 | Domain key name for middleware | Reuse `empleados` + `nomina` on routes; sidebar item gated by `empleados` |

---

## Approval gate

Reply with one of:

1. **Approve draft** — proceed to formal requirements + feature plan + orchestration team plan (still no code until you approve the execution plan).
2. **Approve with changes** — list deltas (I’ll revise this file).
3. **Reject / pause**.

No workers will be spawned and no source code will be modified until you approve both this draft and the later execution plan.
