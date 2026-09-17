# QA Session — Jul 31, 2026 — Cleaned Requirements

**Source raw**: `context/user-feedback/qa-session-jul-31-raw.md`
**Cleaned**: 2026-08-02
**Context**: Continuation of qa-session-jul-24 (shipped to staging, `d-OJON0UVVK` / Amplify job 12). This is the next QA cycle.

> Filtering note: the raw transcript mixes real app feedback with operational chatter (when to onboard patients, Google Drive / Excel sync problems between two computers, jokes). Those are **not** app requirements and are excluded — see §Excluded.

---

## Requirements (mi-empresa-app only)

### R1 — Rename medio de pago "Nequi" → "Nequi/Bre-B"
- **What**: Change the payment-method label `Nequi` to **`Nequi/Bre-B`** everywhere it appears in the UI.
- **Where**: crear empleado (`empleados/nuevo.vue`), empleado details (`empleados/[id]/index.vue`), empleado editar (`empleados/[id]/editar.vue`), and medio de pago de **nómina** (`nomina/index.vue`).
- **Scope**: UI label only. The stored enum value (`NEQUI`) stays the same — this is a display-string change, not a schema change.
- Raw refs: lines 13–17, 162.

### R2 — Nómina "Registrar" interface must adapt to contract type (Valor Mensual)  **[MAIN ITEM]**
- **Problem**: In the nómina registrar/editar dialog, the interface always shows the jornada calculation (`medias jornadas × valor media jornada`) regardless of contract type. For **Término Fijo** and **Término Indefinido** contracts this is wrong — those contracts use **Valor Mensual**, so the dialog shows a "Sin valor de jornada en el contrato" warning and no usable base value (transcript lines 23–24, 67).
- **Expected**: When registering nómina for a contract of type **TERMINO_FIJO** or **TERMINO_INDEFINIDO**:
  - **Hide** the jornada inputs (Medias jornadas, Valor media jornada) and the "Valor media jornada (contrato)" info + warning.
  - Show **Valor Mensual** (from the contract) as the **default subtotal**.
  - Keep the **Aportes sociales** input (editable, already gated to FIJO/INDEFINIDO).
  - **Total a pagar** = Valor Mensual + Aportes sociales (still manually adjustable).
- **OPS**: unchanged — keeps `medias × valor media jornada` calculation (confirmed working, line 80).
- **OBRA_O_LABOR** (DECIDED 2026-08-02): treat like FIJO/INDEFINIDO for the nómina interface — show **Valor Mensual** as subtotal, hide jornada inputs. But **no aportes sociales** (aportes remain gated to FIJO/INDEFINIDO only, per backend `APORTES_ALLOWED`). Total a pagar = Valor Mensual for OBRA.
- **Mirror**: the "nuevo contrato" interface already switches to Valor Mensual by contract type (backend jul-24 R7 already stores `Contrato.valorMensual` and `resolveCalcFields` branches OPS→valorJornada / others→valorMensual). This item is primarily the **frontend registrar dialog** (`nomina/index.vue`) not reflecting that branch; verify backend suggestion returns `valorMensual` as subtotal base for non-OPS.
- Raw refs: lines 23–35, 67–80, 164–167 (developer clarification).

### R3 — Add optional EPS, Fondo de Pensiones, ARL to crear empleado (datos personales)
- **What**: In crear empleado, "Datos personales" section, add three fields: **EPS**, **Fondo de pensiones**, **ARL**.
- **Optional**: all three are optional (no validation blocking).
- **Where**: `empleados/nuevo.vue` (and mirror in editar + details display). Requires backend + schema fields to persist. **(confirm field type — see Q2)**
- Raw refs: lines 157–158.

---

## Confirmed working (no action — verification items from the session)
- Cargos block removed from empleado create/edit (jul-24 R3) — confirmed OK (lines 150–155).
- Asistencia RBAC: non-admin (contratos) can view but not modify (jul-24 R6) — being re-tested (lines 82–84).
- Contract creation for OPS / OBRA / FIJO / INDEFINIDO with correct valor field — "estos sí están bien" (lines 57–66).
- OPS nómina calc `medias × valor jornada` — confirmed correct (line 80).

## Excluded (not app feedback)
- Google Drive / Excel spreadsheet sync mismatch between two computers (nómina totals looked different) — root-caused as a **Drive-sync / user-side issue, not the app** (lines 106–121).
- Operational planning: when to start entering patients, deadlines (lines 131–139).
- Chit-chat / jokes (asistencia demo names, "mandraque", etc.).

## Needs decision (see confirmation questions)
- **Centros de costos / "cajas" (ingresos & egresos)**: mentioned as the "most important" still-missing feature (lines 140–149), acknowledged as **not yet built** and non-trivial. It is a substantial new feature, not a fix. **Q3: in scope for this cycle or a separate one?**
