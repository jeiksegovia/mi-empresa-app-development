# Requirements addendum — Aug-17 QA feedback

Trace: F1–F7 in `context/user-feedback/qa-centro-de-costos-aug-17-cleaned.md`. Decisions D9–D14 in `orchestration-ctx/decisions/aug17-qa-feedback-decisions.md`.

| ID | Requirement | Acceptance Criterion |
|----|-------------|----------------------|
| **R18** | Seed INGRESOS catalog is the 8 names in D12, ordered 1–8; EGRESOS resequenced 9–14 | After seed, GET `/centro-costos?tipo=INGRESOS` returns those 8; no row named exactly `Transporte`; any ítems that belonged to Transporte now belong to `Transporte completo` |
| **R19** | Centros start collapsed; click header to expand/collapse ítems | Default: all centros collapsed. Expanding one does not force-expand others. Add-ítem is only available when expanded |
| **R20** | ADMIN can create/edit a centro (nombre, tipo, descripcion, orden, precioUnitario, habilitarRecibo) from the page | Button visible for ADMIN; POST creates; custom centro (e.g. Navidad) appears in the list |
| **R21** | CONTRATOS cannot create/edit/delete centros | Button hidden; POST/PUT/DELETE `/centro-costos` and `/:id` → 403 |
| **R22** | CONTRATOS cannot see the balance card or change month; period locked to current Bogotá month | Balance card + month input absent. GET `/balance` as CONTRATOS → 403. GET `/items?periodo=` for a non-current month → 403 |
| **R23** | ADMIN still sees balance + any month | Unchanged from ago-5 |
| **R24** | Every ítem has required `fecha` (YYYY-MM-DD). Server sets `periodo = YYYY-MM-01` of that fecha | POST with `fecha: "2026-08-17"` stores fecha=2026-08-17 and periodo=2026-08-01. Missing fecha → 400 `field: fecha`. Dialog shows day date, not a month-only periodo field |
| **R25** | INGRESOS ítem requires `pagador` (text) and `beneficiarioClienteId` (existing Cliente) | Omitting either → 400. Round-trip returns pagador + beneficiario `{id,nombre}` |
| **R26** | INGRESOS `valorUnitario` is copied from `centro.precioUnitario`; client value ignored. If centro price is null → 400 `field: precioUnitario` | POST `{valorUnitario: 1}` against a centro priced 700000 → stored 700000.00 |
| **R27** | EGRESOS ítems keep typed `valorUnitario`; ingreso fields stay null | Unchanged money behavior; pagador/beneficiario/medioPago null |
| **R28** | Optional `medioPago` = `EFECTIVO` \| `TRANSFERENCIA` on INGRESOS | Round-trips; omit → null |
| **R29** | `habilitarRecibo` on INGRESOS centros (default false). After create-ítem, if flag true, offer print | Create on flagged centro → print CTA. Create on unflagged → no CTA |
| **R30** | Recibo page prints a simple text receipt (label left / value right) with the F6 fields | `/centro-costos/recibo/:itemId` renders those rows; `@media print` hides app chrome |
| **R31** | GET `/centro-costos/items/:itemId` returns ítem + centro + beneficiario | 200 shape per updated contract; 404 if missing. Registered before `/:id` |

Out of scope still: Prefactura module, IVA, payment-line splits, transfer screenshots, reports, unpaid state, nómina ingest.
