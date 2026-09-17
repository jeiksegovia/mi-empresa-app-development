# Task Assignment — W5 `pt-frontend-eng` · Aug-17 centro-costos UI

**Task type**: IMPLEMENTATION  
**Your TaskList ID**: `3` (T11)  
**Your worker name**: `worker-5`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address orchestrator as `team-lead`, never `main`.**

---

## FIRST ACTION

```bash
pwd   # MUST be the project root. Else BLOCKED: spawned with cwd=<path> and STOP.
ls frontend/app/pages/centro-costos/index.vue
```
`TaskUpdate` task `3` → `in_progress`. Then read **in this order**:

1. `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` — **SSOT, LIVE Wave 4**
2. `development/feature-centro-costos-ago-5/01-requirements-aug17-feedback.md` — R19–R30
3. Existing page `frontend/app/pages/centro-costos/index.vue` (you extend it)
4. Exemplar money typing: first ~60 lines of `frontend/app/pages/nomina/index.vue`

**Do NOT open** `schema.prisma`, `centroCostosService.ts`, `centroCostos.routes.ts`, or `domainAccess.ts`. If the contract does not answer a question, ask `team-lead`.

---

## Locked decisions

D2 no reports · D5 cantidad Int · D8 409 on centro delete  
D10 `fecha` required; hide month-only periodo in the daily visual  
D11 pagador + beneficiario + medioPago on INGRESOS; precio on centro  
D13 recibo if `habilitarRecibo`; print page label-left / value-right  
D14 CONTRATOS: current month ítems only; **no** balance card; **no** month picker; **no** create/edit/delete centro

---

## Source Files to Modify

- `frontend/app/pages/centro-costos/index.vue`
- `frontend/app/pages/centro-costos/recibo/[itemId].vue` (new)
- `frontend/tests/centro-costos/**`
- `frontend/app/composables/useDomainAccess.ts` — **only** if you need a helper; domain key already exists (`centro-costos` true for CONTRATOS). Prefer `authStore.role` + `tipoEmpleado` for the D14 visual split.

## Non-goals

- ❌ `backend/` (do not read it)
- ❌ Prefactura, IVA, payment splits, reports
- ❌ Changing the DOMAIN_ACCESS matrix cells (GERONTOLOGA false / CONTRATOS true stays)

---

## What to build (R19–R30)

1. **Accordion (R19)** — every centro starts **collapsed**. Click header to expand. Add-ítem only when expanded. Expanding one does not force-expand others.
2. **ADMIN create/edit centro (R20)** — button visible only for ADMIN. Fields: nombre, tipo, descripcion, orden, `precioUnitario` (INGRESOS), `habilitarRecibo` (INGRESOS only). PUT for edit (incl. deactivate).
3. **CONTRATOS visual (R21–R22)** — hide create-centro, hide balance card, hide month `<input>`. Lock `periodo` to current `YYYY-MM` (derive from today; do not let them change it). Still list centros and add/edit/delete **ítems**.
4. **Item dialog**
   - Required **fecha** (`YYYY-MM-DD`). Do **not** send `periodo` (server derives it). Do **not** show a month-only periodo field.
   - **INGRESOS**: pagador (text, required), beneficiario (patient dropdown from `GET /patients`, required), medioPago `EFECTIVO|TRANSFERENCIA` optional, **valorUnitario hidden / read-only from `centro.precioUnitario`**. Never send `valorTotal`. If `precioUnitario` is null, block save and tell ADMIN to set the centro price (most seeded centros are still null except ones already priced in QA).
   - **EGRESOS**: typed valorUnitario + optional factura fields; ingreso fields not shown.
5. **Recibo (R29–R30)** — after successful INGRESOS create, if `centro.habilitarRecibo === true`, offer print → navigate or window-open `/centro-costos/recibo/:itemId`.
   - New page: `definePageMeta` auth, **no sidebar** (or print CSS hides it).
   - `GET /centro-costos/items/:itemId` → rows, **label left / value right**: Recibo #id, Fecha, Pagador, Beneficiario, Concepto (`centro.nombre`), Cantidad, Valor unitario, Valor total, Medio de pago, Notas.
   - `window.print()` + `@media print` hide chrome. Text only — no PDF lib.

**Traps**: `v-model` on `const reactive()` drops emits — `:model-value` + `Object.assign`. Money is a **string** — `Number()` only at render. Drive DatePicker in the spec.

---

## Acceptance (demonstrate each)

1. ADMIN: 8 INGRESOS centros listed; all start collapsed; expand one to see ítems / add.
2. ADMIN: create-centro dialog persists a custom INGRESOS centro with precio + habilitarRecibo.
3. CONTRATOS: no balance card, no month input, no create-centro button (inspect DOM testids).
4. INGRESOS dialog requires fecha + pagador + patient; does not let user type unit price.
5. EGRESOS dialog has typed price; no pagador.
6. After INGRESOS save on a `habilitarRecibo` centro, print CTA appears; recibo page shows the F6 rows.
7. Smoke spec updated/green (`frontend/tests/centro-costos`).
8. Typecheck (`npx vue-tsc --noEmit` or project script) exits 0.

---

## Reporting

Progress: `tasks/W5-frontend-aug17/progress-report.md`  
Final: `tasks/W5-frontend-aug17/completion-report.md` with verbatim AC.  
To `team-lead`: `COMPLETE:`, `BLOCKED:`, `TURNING-POINT-*` only.  
If the running API disagrees with the **contract**, `TURNING-POINT-BREAKING` and WAIT — do not reshape UI to match a bug.  
MAX 2 self-repairs then `TURNING-POINT-STRATEGY:`.
