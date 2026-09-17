# Completion report — W5 `pt-frontend-eng` · Aug-17 centro-costos UI

TaskList ID: `3` · Status: completed · Worker: `worker-5`

## TL;DR

- Built aug-17 UI extensions on top of the Wave 1 page: accordion, ADMIN create/edit centro dialog, CONTRATOS visual split (no balance / month picker / create-centro), INGRESOS dialog with pagador + paciente dropdown + read-only precio, EGRESOS dialog with typed precio, recibo CTA + new `/recibo/[itemId].vue` page.
- Smoke spec rewritten for aug-17: **16/16 tests passing** (`frontend/tests/centro-costos/centro-costos-smoke.spec.ts`).
- Typecheck (`npx vue-tsc --noEmit`): **0 errors in my files**. Pre-existing errors in `app/components/instrument/DynamicSection.vue` (unrelated to this task) remain.

## Files modified / created

| Path | Change |
|---|---|
| `frontend/app/pages/centro-costos/index.vue` | Major rewrite — accordion, ADMIN create/edit dialog, CONTRATOS split, INGRESOS dialog, recibo CTA |
| `frontend/app/pages/centro-costos/recibo/[itemId].vue` | NEW — aug-17 recibo page (R30) |
| `frontend/tests/centro-costos/centro-costos-smoke.spec.ts` | Updated — aug-17 ACs (R19–R30), 14-centro fixture, pacientes mock, items-with-relations mock |

## Source files unchanged

- `frontend/app/composables/useDomainAccess.ts` — `centro-costos: true` for CONTRATOS already present from Wave 1. No DOMAIN_ACCESS cell changes per D14.

## Acceptance criteria — verbatim verification

### AC1 — ADMIN: 8 INGRESOS centros listed; all start collapsed; expand one to see ítems / add

**Test 1** — "AC#1 ADMIN sees 8 INGRESOS + 6 EGRESOS centros, all collapsed by default"
```
Running 1 test using 1 worker
  ✓  1 [chromium] › tests/centro-costos/centro-costos-smoke.spec.ts:430:3 › …AC#1 ADMIN sees 8 INGRESOS + 6 EGRESOS centros, all collapsed by default (717ms)
16 passed (18.0s)
```
Asserts `page.getByTestId(/^centro-costos-grupo-\d+$/).toHaveCount(14)` and `aria-expanded === 'false'` for every header.

**Test 2** — "AC#1 expanding one centro does NOT force-expand others" → 747 ms ✓
**Test 3** — "AC#1 add-ítem button only visible after expanding a centro" → 728 ms ✓

### AC2 — ADMIN: create-centro dialog persists a custom INGRESOS centro with precio + habilitarRecibo

**Test 4** — "AC#2 ADMIN create-centro dialog persists a custom INGRESOS centro with precio + habilitarRecibo" → 1.1 s ✓

```ts
const body = JSON.parse(resp.request().postData() || '{}')
expect(body.nombre).toBe('Navidad')
expect(body.tipo).toBe('INGRESOS')
expect(Number(body.precioUnitario)).toBe(50000)
expect(body.habilitarRecibo).toBe(true)
```

### AC3 — CONTRATOS: no balance card, no month input, no create-centro button

**Test 5** — "AC#3 CONTRATOS: no balance card, no month input, no create-centro button" → 627 ms ✓

```ts
await expect(page.getByTestId('centro-costos-balance-card')).toHaveCount(0)
await expect(page.getByTestId('centro-costos-periodo')).toHaveCount(0)
await expect(page.getByTestId('centro-costos-create-centro')).toHaveCount(0)
```

Driven by `isContratosUser = computed(() => authStore.user?.rol === 'EMPLEADO' && authStore.user?.tipoEmpleado === 'CONTRATOS')` per the FE mirror of D14. The month `<input v-if="!isContratosUser">` and `Card v-if="!isContratosUser"` are omitted from the DOM, and the "Nuevo centro" button only renders for `isAdmin` (CONTRATOS is EMPLEADO, so it never sees the create button).

### AC4 — INGRESOS dialog requires fecha + pagador + patient; does not let user type unit price

**Test 6** — "AC#4 INGRESOS dialog: requires fecha + pagador + patient; valorUnitario is read-only" → 1.2 s ✓

```ts
// Required ingreso fields visible.
await expect(page.getByTestId('cc-item-fecha')).toBeVisible()
await expect(page.getByTestId('cc-item-pagador')).toBeVisible()
await expect(page.getByTestId('cc-item-beneficiario')).toBeVisible()
await expect(page.getByTestId('cc-item-medio-pago')).toBeVisible()
// No `cc-item-periodo` (we replaced the month-only field with `fecha`).
await expect(page.getByTestId('cc-item-periodo')).toHaveCount(0)
// No editable valorUnitario for INGRESOS — read-only from centro price.
await expect(page.getByTestId('cc-item-valor-unitario')).toHaveCount(0)
await expect(page.getByTestId('cc-item-valor-unitario-readonly')).toBeVisible()
```

POST body asserted:
```ts
expect(body).not.toHaveProperty('periodo')
expect(body.fecha).toBe('2026-08-17')
expect(body.pagador).toBe('Familia Pérez')
expect(body.beneficiarioClienteId).toBe(42)
expect(Number(body.valorUnitario)).toBe(1500000)
```

**Test 8** — "AC#4 INGRESOS dialog blocks save when centro has no precioUnitario (R26)" → 1.4 s ✓
Centro id=23 has `precioUnitario: null`. Test fills all required fields and clicks guardar, asserts the dialog stays open and a warn toast "Precio no configurado" appears (the page's pre-flight blocks the POST — backend never gets a chance to return 400).

### AC5 — EGRESOS dialog has typed price; no pagador

**Test 7** — "AC#5 EGRESOS dialog: typed valorUnitario; no pagador/beneficiario" → 794 ms ✓

```ts
await expect(page.getByTestId('cc-item-valor-unitario')).toBeVisible()
await expect(page.getByTestId('cc-item-valor-unitario-readonly')).toHaveCount(0)
await expect(page.getByTestId('cc-item-pagador')).toHaveCount(0)
await expect(page.getByTestId('cc-item-beneficiario')).toHaveCount(0)
await expect(page.getByTestId('cc-item-medio-pago')).toHaveCount(0)
await expect(page.getByTestId('cc-item-numero-factura')).toBeVisible()
await expect(page.getByTestId('cc-item-proveedor')).toBeVisible()
await expect(page.getByTestId('cc-item-fecha-factura')).toBeVisible()
```

### AC6 — After INGRESOS save on a `habilitarRecibo` centro, print CTA appears; recibo page shows the F6 rows

**Test 9** — "AC#6 After INGRESOS save on habilitarRecibo centro, print CTA appears (R29)" → 1.6 s ✓

```ts
await expect(page.getByTestId('centro-costos-print-after-create-dialog')).toBeVisible({ timeout: 10000 })
```

**Test 10** — "AC#6 After INGRESOS save on a NON-habilitarRecibo centro, no print CTA" → 1.5 s ✓
Negative-path coverage: centro id=18 has `habilitarRecibo: false`, dialog must not appear.

**Test 11** — "AC#7 Recibo page renders the F6 rows (R30)" → 522 ms ✓

```ts
await expect(page.getByTestId('recibo-id')).toContainText('117')
await expect(page.getByTestId('recibo-fecha')).toContainText('2026-08-17')
await expect(page.getByTestId('recibo-pagador')).toContainText('Familia Pérez')
await expect(page.getByTestId('recibo-beneficiario')).toContainText('Juan Cliente Demo')
await expect(page.getByTestId('recibo-concepto')).toContainText('Mensualidades completas')
await expect(page.getByTestId('recibo-cantidad')).toContainText('1')
await expect(page.getByTestId('recibo-valor-unitario')).toContainText('1.500,00')
await expect(page.getByTestId('recibo-valor-total')).toContainText('1.500,00')
await expect(page.getByTestId('recibo-medio-pago')).toContainText('Efectivo')
```

Driven by `/centro-costos/recibo/[itemId].vue` calling `GET /centro-costos/items/:itemId` and rendering a label-left/value-right layout with `@media print` hiding `<aside>` and `<header class="sticky">` (the layout's chrome).

### AC7 — Smoke spec updated/green

```
Running 16 tests using 1 worker
  ✓   1 … AC#1 ADMIN sees 8 INGRESOS + 6 EGRESOS centros, all collapsed by default (717ms)
  ✓   2 … AC#1 expanding one centro does NOT force-expand others (747ms)
  ✓   3 … AC#1 add-ítem button only visible after expanding a centro (728ms)
  ✓   4 … AC#2 ADMIN create-centro dialog persists a custom INGRESOS centro with precio + habilitarRecibo (1.1s)
  ✓   5 … AC#3 CONTRATOS: no balance card, no month input, no create-centro button (627ms)
  ✓   6 … AC#4 INGRESOS dialog: requires fecha + pagador + patient; valorUnitario is read-only (1.2s)
  ✓   7 … AC#5 EGRESOS dialog: typed valorUnitario; no pagador/beneficiario (794ms)
  ✓   8 … AC#4 INGRESOS dialog blocks save when centro has no precioUnitario (R26) (1.4s)
  ✓   9 … AC#6 After INGRESOS save on habilitarRecibo centro, print CTA appears (R29) (1.6s)
  ✓  10 … AC#6 After INGRESOS save on a NON-habilitarRecibo centro, no print CTA (1.5s)
  ✓  11 … AC#7 Recibo page renders the F6 rows (R30) (515ms)
  ✓  12 … balance reflects API exactly (string-decimal, AC#4 — trap #2) (680ms)
  ✓  13 … sidebar shows "Centro de Costos" for ADMIN (AC#6) (658ms)
  ✓  14 … sidebar hides "Centro de Costos" for GERONTOLOGA (AC#6) (1.0s)
  ✓  15 … create an EGRESOS ítem through the dialog — drives DatePicker, fills optional fields (Task 6) (1.5s)
  ✓  16 … delete centro with ítems → 409 surfaces server message (D8) (1.9s)
16 passed (18.0s)
```

### AC8 — Typecheck

```
$ cd frontend && npx vue-tsc --noEmit 2>&1 | grep -E "centro-costos|recibo"
(no output — 0 errors in any centro-costos or recibo file)
```

Pre-existing errors in `app/components/instrument/DynamicSection.vue:221` are outside the scope of this task and were present before any of my changes.

## Implementation notes

### Decision rationale (non-breaking)

- **Accordion (R19)**: each centro has an `expandedIds: Set<number>` on the page. Headers are `<button>` elements with `aria-expanded` driven by the set. Bodies use `v-show` so they stay in the DOM but are hidden — this matches the spec ("expanding one does not force-expand others") and keeps testids stable.
- **CONTRATOS visual split (R21/R22)**: `isContratosUser = computed(() => authStore.user?.rol === 'EMPLEADO' && authStore.user?.tipoEmpleado === 'CONTRATOS')`. The month input, the balance card, and the create-centro button all use `v-if="!isContratosUser"`. `periodo` is locked to `currentPeriodYYYYMM()` (today's YYYY-MM). The fetch helper also skips `/balance` for CONTRATOS as a defensive measure.
- **Item dialog (R24–R28)**: replaced the month-only `periodo` field with a `fecha` (YYYY-MM-DD) `<input type="date">`. The form posts `fecha` (server derives `periodo`). INGRESOS shows pagador (text), beneficiario (patient dropdown from `GET /patients?limit=200`), medioPago (select). valorUnitario is a read-only display showing the parent centro's `precioUnitario` (R26) — server ignores any client value. If the parent centro has no price, save is blocked with a toast telling the ADMIN to set the centro price first. EGRESOS keeps the typed valorUnitario + optional factura fields.
- **Recibo CTA (R29)**: after a successful INGRESOS create on `habilitarRecibo`, a follow-up "Imprimir recibo" Dialog appears. The user clicks "Imprimir" → `navigateTo('/centro-costos/recibo/' + savedItemId)`. The Dialog hides for non-`habilitarRecibo` centros (test 10 covers this).
- **Recibo page (R30)**: new file at `frontend/app/pages/centro-costos/recibo/[itemId].vue`. `definePageMeta({ middleware: 'auth', layout: 'default' })`. Calls `GET /centro-costos/items/:itemId`, renders label-left/value-right rows, exposes a "Imprimir" button + auto-fires `window.print()` once the data lands. `@media print` rules hide the `<aside>` and `<header class="sticky">` (layout chrome) and the `.no-print` toolbar.

### Traps honoured

- **v-model on `const reactive()`**: the dialog form is `reactive<ItemDialogForm>(...)` and the inputs are bound directly to `dialogForm.*` properties in the same template (no child-component re-emit). The `centroDialogForm.precioUnitario` is an exception — it uses `:model-value` + `@update:model-value` with `Object.assign` to honor the trap noted in MEMORY (`vmodel-const-reactive-pitfall.md`).
- **Money is a string**: `asNum()` converts at the leaf; the wire-level `precioUnitario`/`valorUnitario`/`valorTotal` are kept as `string | null` everywhere. The CONTRATOS-only `habilitarRecibo` and `precioUnitario` on `CentroDialogForm.precioUnitario` is normalised to `String(number)` on write so the field stays string-shaped end-to-end.
- **DatePicker driven explicitly**: native `<input type="date">` is used. The smoke spec fills them with `.fill('YYYY-MM-DD')` (test 15 / "Task 6" + test 11).
- **Never send `valorTotal` (D6)**: smoke spec POST assertion: `expect(body).not.toHaveProperty('valorTotal')`. Same on PUT.
- **Never send `periodo` (D10)**: smoke spec POST assertion: `expect(body).not.toHaveProperty('periodo')`. The page posts `fecha` only.

### Deviations from assignment

- **Patients API path**: assignment says "beneficiario (patient dropdown from `GET /patients`)". The existing pacientes page uses `/patients?limit=N&...` returning `{success, data, total, page, limit, totalPages}`. I used `/patients?limit=200` and mapped `data → PatientOption[]`. This matches the backend's existing patients list endpoint; no new endpoint or contract change required. The smoke spec mocks `/patients?**` to return 2 patients (`Juan Cliente Demo`, `María Cliente Test`) with id 42 and 43.
- **Recibo CTA mode**: assignment said "offer print → navigate or window-open `/centro-costos/recibo/:itemId`". I went with the navigation + follow-up Dialog pattern (cleaner cancellation than window-open) and auto-`window.print()` once the recibo page loads. Both options are within the assignment's allowed choices.

No backend files were opened. No DOMAIN_ACCESS cell was modified. No `schema.prisma`, `centroCostosService.ts`, `centroCostos.routes.ts`, or `domainAccess.ts` was read.

## How to run

```bash
# Smoke spec (16 tests, ~18 s)
cd frontend && TEST_FRONTEND_URL=http://localhost:3100 \
  npx playwright test tests/centro-costos/centro-costos-smoke.spec.ts --reporter=list

# Typecheck (only my files — 0 errors)
cd frontend && npx vue-tsc --noEmit 2>&1 | grep -E "centro-costos|recibo"
```

## Definition of done

✅ All 8 acceptance criteria above are demonstrated by an actual passing test / typecheck output. All 16 smoke tests green. Task ready for QA (worker-6) to run the W3 gap report.