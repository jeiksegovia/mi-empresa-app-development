# Decision Record — Aug-17 QA feedback (centro de costos)

**Date**: 2026-08-18 · **Decided by**: developer
**Source**: `context/user-feedback/qa-centro-de-costos-aug-17-cleaned.md`

---

## Locked decisions (do not re-litigate)

| ID | Decision |
|---|---|
| **D9** | Task order: **implement F1–F7 first**, then run T7/T8 QA once against the updated contract. Do not QA the ago-5 surface and then re-QA. |
| **D10** | Add required `fecha DATE` on every ítem. Keep `periodo` as first-of-month **derived from `fecha`**. Month queries unchanged. |
| **D11** | Ingreso fields are **columns on `CentroCostosItem`**: `pagador`, `beneficiarioClienteId`, `medioPago`. `precioUnitario` lives on `CentroCostos`. No child table. No Prefactura module. |
| **D12** | Seed catalog: **rename** `Transporte` → `Transporte completo` (preserve any ítems). **Insert** `Transporte por 3 días`, `Mensualidad por 3 días`, `Mensualidad por 4 días`. Keep existing mensualidad completa / por día / adicionales / valoraciones. EGRESOS unchanged. |
| **D13** | Recibo print is **this cycle**. Enabled per-centro via `habilitarRecibo` (INGRESOS only, set on create/edit). After saving an ingreso on a centro with the flag on, offer print. View is a simple text receipt: labels left, values right. No PDF library. |
| **D14** | CONTRATOS (Carolina): can **add/edit/delete ítems of the current month only**. Cannot see balance, cannot change month, cannot create/edit/delete centros. ADMIN has the full visual. AUDITOR/OPERADOR stay inherited (full, as previously confirmed). |

Amends ago-5: **D4** (CONTRATOS no longer full-parity write), **D6** (INGRESOS `valorUnitario` copied from centro, still server-computed `valorTotal`), **D7** (`periodo` still month bucket; `fecha` is the day).

---

## Schema (additive only — do not edit `20260805000000_centro_costos_ago5`)

```
enum MedioPagoIngreso { EFECTIVO  TRANSFERENCIA }

CentroCostos +=
  precioUnitario   Decimal?  @map("precio_unitario") @db.Decimal(15,2)
  habilitarRecibo  Boolean   @default(false) @map("habilitar_recibo")

CentroCostosItem +=
  fecha                   DateTime  @db.Date
  pagador                 String?   @db.VarChar(200)
  beneficiarioClienteId   Int?      @map("beneficiario_cliente_id")
  medioPago               MedioPagoIngreso? @map("medio_pago")
  beneficiario            Cliente?  @relation(...)

Cliente += itemsComoBeneficiario CentroCostosItem[]
```

Backfill: `fecha = periodo` for existing ítems (they are day-1 of their month).

INGRESOS create/update ítem: require `pagador` + `beneficiarioClienteId`; ignore client `valorUnitario`; copy `centro.precioUnitario` (400 if centro price is null). EGRESOS: ingreso fields stay null; `valorUnitario` still client-sent.

---

## Seed order (INGRESOS)

| orden | nombre |
|---|---|
| 1 | Mensualidades completas |
| 2 | Mensualidad por 4 días |
| 3 | Mensualidad por 3 días |
| 4 | Mensualidades por día |
| 5 | Transporte completo |
| 6 | Transporte por 3 días |
| 7 | Ingresos adicionales |
| 8 | Valoraciones |

EGRESOS keep orden 6–11 in the constant today; worker **resequences EGRESOS to 9–14** so the list sorts cleanly.

---

## Recibo (print)

- Route: `GET /api/v1/centro-costos/items/:itemId` returns the ítem + parent centro + beneficiario `{id,nombre}`.
- Page: `frontend/app/pages/centro-costos/recibo/[itemId].vue` with a print-only layout (no sidebar). `window.print()`. `@media print` hides chrome.
- Rows (label left / value right): Recibo #id, Fecha, Pagador, Beneficiario, Concepto (centro.nombre), Cantidad, Valor unitario, Valor total, Medio de pago, Notas.
- Offer print after successful INGRESOS create **only if** `centro.habilitarRecibo === true`.
