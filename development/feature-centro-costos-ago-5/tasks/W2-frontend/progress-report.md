# Progress Report — W2 (frontend, worker-2)

## Task 5 — Page + RBAC mirror + nav

### Plan
1. RBAC mirror in `useDomainAccess.ts` (smallest piece, flush env first).
2. Nav entry in `app.config.ts`.
3. Page `frontend/app/pages/centro-costos/index.vue` (consumes contract §1, §2.3, §3).
4. Acceptance: typecheck + page renders + RBAC cell parity.

### Findings
- Confirmed working dir is `/Users/jeik/ws/mi-empresa-app-development` (project root).
- Read contract in full. Wire shapes confirmed. Money fields are `string` server-side, must accept `number | string`.
- Read `nomina/index.vue` exemplar — confirmed pattern for `reactive` dialog form using `:model-value` + `Object.assign`-style with direct field writes on submit (it uses `v-model` on primitive `InputNumber` slots, which is fine — the trap is when the dialog state itself is `const reactive(...)` and you `v-model` a child wrapping that object).
  - Key observation: `nomina/index.vue` writes to `dialogForm.X` directly without an Object.assign helper. The trap is when a child component emits an object/value and you try `v-model="dialogForm"` on the parent — the parent's const wrapper blocks the emit.
  - In our case we'll use direct field writes (`v-model="dialogForm.nombre"`) for individual fields, which is the safe pattern. Will follow the nomina style.
- Read `useDomainAccess.ts` — matrix is per-Domain flat literal. Need to add `'centro-costos'` to Domain union, one cell to each profile, one prefix-map entry.
- Read `app.config.ts` — sidebar items, position after Nomina.
- Read `AppSidebar.vue` — `domainForPath(item.to) + can(domain)` filter. No edit needed there.

### Implemented
1. `useDomainAccess.ts`: added `'centro-costos'` to Domain union; cell `GERONTOLOGA: false`, `CONTRATOS: true`; added `{ prefix: '/centro-costos', domain: 'centro-costos' }` to `DOMAIN_PREFIX_MAP`.
2. `app.config.ts`: added `{ label: 'Centro de Costos', icon: 'pi pi-chart-pie', to: '/centro-costos' }` after Nomina.
3. `frontend/app/pages/centro-costos/index.vue` — full page with month selector, two sections (Ingresos / Egresos), balance summary card, item CRUD dialog with egreso-only invoice fields, 409→deactivate suggestion flow.
4. Smoke spec at `frontend/tests/centro-costos/centro-costos-smoke.spec.ts` (8 tests, mocked endpoints).

### Verifications
- `vue-tsc --noEmit` passes for `useDomainAccess.ts`, `app.config.ts`, `pages/centro-costos/index.vue` — only pre-existing `DynamicSection.vue` errors remain (vue-tsc on TS-as-cast in template, pre-existing, unrelated).
- Live backend reachable on :3101, GET `/centro-costos` returns the 11 seeded centros exactly as the contract §1.3 specifies (5 INGRESOS + 6 EGRESOS, ordered by tipo/orden/nombre).
- By task 6 final run: live backend `/items` and `/balance` endpoints were returning the contract-shaped data (after worker-1 finished task 3 mid-task). Smoke spec verified end-to-end shape parity: `valorTotal: "1001.00"` (2×500.50 server-computed), `periodo: "2026-08-01"` (server-normalized to day 1), Decimal strings throughout.

## Task 6 — Frontend smoke spec

### Plan
1. Mirror the local-qa test pattern (`jul31-qa-frontend.spec.ts` style — `page.route` mock + `data-testid` assertions).
2. Cover AC#1, AC#2, AC#4, AC#5, AC#6, plus the create-ítem happy path (trap #1 DatePicker + trap #6 never-send-valorTotal) and the D8 409 surface.
3. Run, iterate on flake, document each failure.

### Findings
- Vue's `v-model` on `<input type="month">` listens for `input` (not `change`); the page now has both `@change="fetchAll"` (matching nomina's pattern) and a `watch(periodRef)`. The Playwright test dispatches both events to drive the change deterministically — captured inline in the spec.
- The cancel-button locator matched BOTH dialogs' Cancelar buttons (item dialog + delete-centro dialog). Added `data-testid="cc-item-cancelar"` to scope the spec.
- The mock returns one item per centro, so the centro delete button (rendered only when `items.length === 0`) was hidden. Switched the D8 test to a future month with empty items so all centros show the delete button.

### Final results
8 / 8 tests pass. Verbatim output saved in `completion-report.md`.

### Failure classification
- **TEST-ENV** (×2): Playwright month-input + Vue v-model event semantics; mock-data-aware month selection for D8 test.
- **FLAKE** (×1): locator ambiguity on `getByRole('button', { name: 'Cancelar' })` — two dialogs shared the same accessible name. Fixed via `data-testid` scoping.
- 0 unclassified.

### Verifications
- Smoke spec: 8 / 8 pass.
- `vue-tsc --noEmit`: 0 errors in my files (only pre-existing `DynamicSection.vue` parser errors — unrelated).
- Live backend smoke: `POST /centro-costos/17/items` with `valorUnitario: "500.50"` + `cantidad: 2` returned `valorTotal: "1001.00"` (server-computed; client did not send it). All wire shapes match the contract.
