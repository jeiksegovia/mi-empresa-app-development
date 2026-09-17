# QA feedback — Centro de Costos (aug-17) · cleaned

**Source**: `context/user-feedback/qa-centro-de-costos-aug-17-raw.md`
**Filter rule**: keep only centro-de-costos UX / product / schema feedback. Drop personal chatter (health, lunch, printer), process asides, and the deferred prefactura/invoicing product discussion except where it *changes the ingreso ítem shape now*.
**Current code (ago-5 landed)**: `CentroCostos` + `CentroCostosItem`, API `/api/v1/centro-costos`, page `/centro-costos`. T1–T6 implemented; T7–T8 QA not started.

---

## Filtered out (not requirements)

| Lines | Why dropped |
|---|---|
| 5, 40–47 | Meta / “we extracted this from conversation” / unused-features rant |
| 54–76 | Personal (pain, vest, chair, thermal paper) |
| 114–116, 122–123, 148–155 | Lunch / goodbye |
| 117–161, 176–186 | Full **prefactura / facturación / inventario / conciliación bancaria** module — they defer it: *“ese desarrollo lo pensamos después”*, *“no integremos nada”*. Keep only the ingreso-ítem fields they still want *now* so a recibo can be printed. |
| 18, 51 | Reportes tab — still out of scope (ago-5 D2) |
| 228–243 | Payment-split / orders system — rejected in favor of **notas** |

---

## What they confirmed is already right

- Centros as “bolsitos”: create as many as needed (event this month, Navidad, precio fundadoras).
- Seeded EGRESOS (Refrigerios, Aseo, Papelería, Eventos, Nómina, Mantenimiento) are correct.
- Seeded INGRESOS base idea is correct, but the **catalog is incomplete** (F1).
- Ítem is the unit of work; the centro is just the bucket.
- Only **paid** ingresos are recorded. Entering an ítem means the money is in (cash in hand or transfer reported). No “unpaid” state.
- Split payments (efectivo + transferencia) live in **notas**, not a payment-line subsystem.

---

## Feedback items (atomic)

### F1 — Seed catalog gaps (content, not schema)

**Missing INGRESOS centros** (said three times: L4, L10, L35–37, L100–106):

| Current seed | Needed |
|---|---|
| Mensualidades completas | keep |
| Mensualidades por día | keep (día suelto) |
| — | **Mensualidad por 3 días** (new) |
| Transporte (single) | split → **Transporte completo** + **Transporte por 3 días** |
| Ingresos adicionales | keep |
| Valoraciones | keep |

L216 also names **Mensualidad por 4 días** once, in the “fixed price → more centros” discussion. Treat as optional unless confirmed.

EGRESOS: no change.

**Touch**: `DEFAULT_CENTROS_COSTOS` in `empresaService.ts` + idempotent seed. Existing `Transporte` row: rename vs. deactivate+insert is a design question.

### F2 — Accordion / collapsed centros (UI)

L11–13: once many mensualidades are entered the page is too long. Centros must start **collapsed**; expand to see/add ítems. Also makes it easier to decide “this egreso is papelería, not mantenimiento.”

**Touch**: `frontend/app/pages/centro-costos/index.vue` only. No API change.

### F3 — Admin can create centros; CONTRATOS cannot (UI + RBAC)

L107–113: there is **no “crear centro de costos” button**. API `POST /centro-costos` already exists. Admin creates custom centros (Navidad, mensualidad con descuento, precio fundadoras). CONTRATOS asks admin, then fills ítems.

**Touch**: FE dialog + hide create for CONTRATOS. Backend already allows CONTRATOS full write (D4) — tighten `POST /` and `PUT/DELETE /:id` to ADMIN if we adopt F4’s limited CONTRATOS role.

### F4 — CONTRATOS (Carolina) limited visual

L13–17, L77–89: Carolina enters the data but must **not** see:

- the **balance summary** (“este resumencito”)
- **histórico** / past months
- any month other than the **current** one (*“el mes pasado. No, no la dejamos.”*)

She only **añadir, añadir**. ADMIN keeps the full visual.

They also said “primero mejorémoslo y después ponemos los permisos” (L15) and then specified this split in detail — treat F4 as **in this cycle**, not deferred.

**Touch**:
- BE: `GET /balance` → 403 for CONTRATOS; `GET /items?periodo=` reject non-current month for CONTRATOS; `POST /` + mutate centro → ADMIN only.
- FE: hide month selector + balance card for CONTRATOS; lock period to current month.

### F5 — Day-level fecha on every ítem; hide month “periodo” in the daily visual

L19–34: every ítem (ingreso **and** egreso) has a **calendar day**. Needed to know “estos fueron los pagos del martes” and later weekly breakdown. Month `periodo` stays as the grouping bucket but should be **invisible** in this visual.

Today: `periodo` is DATE normalized to day-1; `fechaFactura` exists only on egresos and is optional.

**Touch**: schema + service + Zod + page. Design question: add `fecha DATE` and keep `periodo` derived, or stop normalizing `periodo` to day-1 and treat it as the item date.

### F6 — Ingreso ítem = mini-recibo fields (NOT the prefactura module)

L187–227, settled on camera. When tipo=INGRESOS, creating an ítem records a payment and can print a recibo.

| Field | Required | Shape | Notes |
|---|---|---|---|
| concepto | yes | the parent centro | mensualidad completa / 3 días / día / transporte / valoración — already implied by which centro you add to |
| pagador | yes | free text | who pays; varies; **not** a patient picker |
| beneficiario | **yes** (L211 reversed optional) | patient dropdown | `Cliente`; if Jacob pays for Jacob, pick Jacob. Empty was rejected. |
| fecha | yes | day | same as F5 |
| valor | yes | from centro, **not editable** | see F7 |
| notas | no | text | split payments, “revisar esta transferencia” |
| medioPago | no, informative | `EFECTIVO \| TRANSFERENCIA` | L213–215 |

After save: option to **imprimir un recibito** with those fields (L203, L226).

Explicitly **not now**: IVA, comprobante screenshot (L171–174, L202), unpaid state, payment-line split, linking to a Prefactura table.

**Touch**: new nullable columns on `CentroCostosItem` (or a 1:1 child table) + Zod branch on parent `tipo` + ingreso dialog + print view.

### F7 — Precio fijo on the centro, not typed per ítem

L215–224: each centro has a **unit price**. Ítem valor is calculated and **not editable**. Discounts / fundadoras / “50% día de la familia” → **create another centro** with that price. Editing price on the ítem was rejected (*“nos exponemos a falta de control”*).

Today: `valorUnitario` is per-ítem and client-sent.

**Touch**: add `precioUnitario Decimal(15,2)` on `CentroCostos` (nullable for EGRESOS? or required for INGRESOS only). `createItem` copies it into `valorUnitario` and ignores client value for INGRESOS. EGRESOS may still type unit price (papelería, aseo are not priced catalogs).

---

## Component / handler map

| Feedback | Layer | Exact artifact |
|---|---|---|
| F1 seed | BE seed | `empresaService.ts` `DEFAULT_CENTROS_COSTOS` + `seedCentrosCostos()` |
| F2 accordion | FE | `pages/centro-costos/index.vue` |
| F3 create-centro button | FE (+ maybe BE RBAC) | new dialog; `POST /centro-costos` already in `centroCostos.routes.ts` |
| F4 CONTRATOS visual | BE + FE | `requireDomain` is not enough — need per-route role checks in `centroCostos.routes.ts`; hide balance + month picker in the page; `useDomainAccess` stays `true` for CONTRATOS (they still enter) |
| F5 fecha | schema + service + FE | `CentroCostosItem`; `normalizePeriodo`; item dialog DatePicker |
| F6 ingreso fields + recibo | schema + service + FE | `CentroCostosItem` + create/update Zod; ingreso dialog; print view |
| F7 precio fijo | schema + service + FE | `CentroCostos.precioUnitario`; `createItem` / `updateItem`; centro create/edit dialog |

**Do not touch**: `nominaService`, empleado models, Prefactura (already dropped), reports.

---

## Locked from ago-5 that still hold

D1 drop unused finance · D2 no reporting module · D3 nómina independent · D5 cantidad Int · D8 Restrict delete.

**D4 is amended by F4**: CONTRATOS still *accesses* the module but with a **restricted visual and write surface**, not full parity with ADMIN.

**D6/D7 are amended by F5/F7**: valor still server-computed; periodo still monthly grouping; but day-fecha is first-class and INGRESOS unit price comes from the centro.

---

## Open design questions (asked to developer before planning tasks)

See the in-chat questions this file accompanies. Short list:

1. Task order vs T7/T8 QA.
2. `fecha` column vs reuse `periodo`.
3. Ingreso fields: columns on `CentroCostosItem` vs child table.
4. `precioUnitario` on centro: INGRESOS-only vs both types.
5. Existing `Transporte` seed row: rename or replace.
6. Recibo print in this cycle vs stub.
7. Include “Mensualidad por 4 días” in the default seed.
