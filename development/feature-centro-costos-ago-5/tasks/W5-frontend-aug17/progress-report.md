# Progress report — W5 frontend-eng · Aug-17 centro-costos UI

TaskList ID: `3` · Status: in_progress · Worker: `worker-5`

## Context read

- `orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` — SSOT
- `01-requirements-aug17-feedback.md` — R19–R30
- `frontend/app/pages/centro-costos/index.vue` — existing T3 page (will be heavily extended)
- `frontend/app/pages/nomina/index.vue` (first ~80 lines) — money typing exemplar
- `frontend/app/composables/useDomainAccess.ts` — `centro-costos: true` for CONTRATOS; matrix unchanged
- `frontend/app/stores/auth.ts` — `authStore.isAdmin`, `user.tipoEmpleado === 'CONTRATOS'`
- `frontend/tests/centro-costos/centro-costos-smoke.spec.ts` — existing W2 smoke (to be updated)

## Plan (concise, 7 steps)

1. Accordion (R19) — every centro collapsed by default; expand/collapse independent; add-ítem only when expanded.
2. ADMIN create/edit centro dialog (R20) — visible only for ADMIN; fields: nombre, tipo, descripcion, orden, precioUnitario, habilitarRecibo. PUT for edit including deactivate.
3. CONTRATOS visual split (R21–R22) — hide balance card, hide month `<input>`, hide create-centro button. Lock `periodo` to current YYYY-MM derived from today. Still list centros + add/edit/delete ítems.
4. Item dialog — required `fecha` (YYYY-MM-DD, `<input type="date">`), NO month-only periodo field. INGRESOS adds pagador (text), beneficiarioClienteId (patient dropdown from `/patients`), optional medioPago. INGRESOS hides valorUnitario (read-only copy from `centro.precioUnitario`); if null → block save with toast asking ADMIN to set the price. EGRESOS keeps typed valorUnitario + optional factura fields.
5. Recibo CTA + page (R29–R30) — after INGRESOS create, if `habilitarRecibo === true` show "Imprimir recibo" → navigate `/centro-costos/recibo/:itemId`. New page renders `GET /centro-costos/items/:itemId` rows label-left/value-right, with `window.print()` and `@media print` hiding chrome.
6. Smoke spec update — add cases for accordion collapse, CONTRATOS visual absence, INGRESOS dialog blocks unit-price entry, EGRESOS typed price, recibo CTA + page.
7. Typecheck — `npx vue-tsc --noEmit` exits 0.

## Subtasks

- [ ] ST-1: Accordion (R19) + base UI scaffold
- [ ] ST-2: ADMIN create/edit centro dialog (R20)
- [ ] ST-3: CONTRATOS visual split (R21–R22)
- [ ] ST-4: Item dialog — fecha required, INGRESOS/EGRESOS split (R24–R28)
- [ ] ST-5: Recibo CTA + `/recibo/[itemId].vue` page (R29–R30)
- [ ] ST-6: Smoke spec update (`tests/centro-costos/centro-costos-smoke.spec.ts`)
- [ ] ST-7: Typecheck + manual verification (AC1–AC8)

## Implementation log

(filled in as work progresses)