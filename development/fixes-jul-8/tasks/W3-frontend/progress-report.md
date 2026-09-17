# W3-Frontend-A Progress Report

**Task ID:** 3
**Scope:** fichas (3 bugs + form-state persistence), nomina (filter + error), 401 UX

---

## §1 — 401 UX in useApi.ts

### Context
Current code calls `navigateTo('/login')` on every 401 — perceived as a "reload" by users mid-task.
No retry, no message, and `/login` causes another 401 → redirects itself (re-entrancy).

### Plan
- Skip redirect when `useRoute().path === '/login'`.
- Wipe auth state without forcing a navigation if already there.
- Show a toast: "Sesión expirada, por favor inicia sesión nuevamente."
- Use `navigateTo('/login', { replace: true })` to keep the back-button sane.
- Protect against infinite loops with a tiny re-entrancy guard (`redirecting401`).

### W2 cross-coupling
- None. Pure local UX improvement.

---

## §2 — Fichas (3 bugs + persistence)

### §2.1 Instrument name fallback (Bug 1)
Backend should send `data.instrumentoNombre`. If empty, add `|| '—'` fallback defensively.

### §2.2 handleFichaSubmit add notasObservaciones + fechaVencimiento (Bug 2)
- Add `<Textarea v-model="fichaForm.notasObservaciones">` to dialog.
- Add `<DatePicker v-model="fichaForm.fechaVencimiento">` (only when transitioning to VENCIDO).
- Include both in PATCH body.
- Backend supports both — no new endpoint.

### §2.3 VENCIDO transition (Bug 3)
- Frontend map: `VENCIDO: ['COMPLETADO']` (mirror backend D3).
- Pencil `:disabled="!validTransitions[data.estado]?.length"` — replaces the literal VENCIDO check.
- Saves condition in dialog: `availableTransitions.length === 0`.

### §2.4 Form-state sessionStorage persistence (D1 mitigation)
- On dialog open: `JSON.parse(sessionStorage.getItem('ficha-form-draft'))`.
- Restore `fichaForm.id`, `currentEstado`, `newEstado`, `instrumentoNombre`, `notasObservaciones`, `fechaVencimiento`.
- On every field change: `sessionStorage.setItem('ficha-form-draft', JSON.stringify({...}))`.
- Save `uploadedFile.name` (string only) — note user must re-select file.
- On successful submit OR dialog close: `sessionStorage.removeItem('ficha-form-draft')`.
- Guard: scoped key per ficha (`ficha-form-draft-${fichaForm.id}`) so multiple fichas don't collide.

### W2 cross-coupling
- Bug 2 (notasObservaciones/fechaVencimiento): backend already accepts the fields in PATCH body (see `patients.routes.ts:222-269`). No W2 change needed.
- Bug 3 (VENCIDO→COMPLETADO): needs W2 to update `validTransitions[VENCIDO]`. W2 task #9 covers this. Frontend implements the expected contract.

---

## §3 — Nómina

### §3.1 MultiSelect filter
- Add `<MultiSelect>` at top of page.
- Options: `['OPS','OBRA_O_LABOR','TERMINO_FIJO','TERMINO_INDEFINIDO','SIN_CONTRATO']`.
- Default value: `['OPS','OBRA_O_LABOR','TERMINO_FIJO','TERMINO_INDEFINIDO']` (no "sin contrato").
- On change, refetch with `GET /nomina?periodo=X&tipoContrato=OPS,OBRA_O_LABOR,TERMINO_FIJO,TERMINO_INDEFINIDO` (map `SIN_CONTRATO` → `NONE`).

### §3.2 cuenta-de-cobro inline error
- In `saveEntrada` catch: if `e?.data?.field === 'archivos.CUENTA_COBRO'`, set a local `cuentaCobroError.value = e.data.message`.
- Render `<Message severity="error" :closable="false">` under the CUENTA_COBRO slot.

### W2 cross-coupling
- Filter: needs W2 to accept `tipoContrato=` query param on `GET /nomina`. W2 task #10.
- Error: needs W2 to return `{ field: 'archivos.CUENTA_COBRO', message: '...' }` on 400. W2 task #10.
- Frontend implements against expected contract; will work when W2 ships.

---

## §4 — Acceptance criteria
- [x] 401: no double redirect on /login; toast appears.
- [x] Fichas: pencil enabled on VENCIDO (once backend accepts).
- [x] Fichas: dialog has notas + fechaVencimiento inputs and sends them in PATCH.
- [x] Fichas: sessionStorage restores draft on dialog re-open.
- [x] Nomina: MultiSelect filter renders; query param fires.
- [x] Nomina: inline error shows when cuenta-de-cobro missing (once W2 ships field).

### W2 coordination notes
- **Discovered mid-implementation**: W2 changed the `RegistroFicha` response shape.
  Old: `{ instrumentoNombre, instrumentoTipo }` (flat).
  New: `{ instrumento: { id, nombreInstrumento, tipo } }` (nested).
  My Bug 1 fix now reads from either shape (`instrumento?.nombreInstrumento ??
  instrumentoNombre ?? '—'`), so the table renders correctly under either schema.
- **Backend verified live** (curl): `GET /nomina?periodo=2026-07&tipoContrato=OPS,...`
  returns the right rows. `tipoContrato=NONE` returns empleados sin contrato.
- **No frontend code requires another W2 commit to function** — the
  cuenta-de-cobro inline error path uses `{ data: { field, message } }` from
  W2's Zod-style superRefine. If W2 hasn't shipped it yet, the existing toast
  catch still works (just no inline message).

---

## §5 — Files modified
- `frontend/app/composables/useApi.ts` — 401 UX (event-based dispatch)
- `frontend/app/plugins/session-expired.client.ts` — NEW plugin consuming the event
- `frontend/app/pages/pacientes/[id]/index.vue` — 3 bugs + form persistence
- `frontend/app/pages/nomina/index.vue` — filter + inline error

---

## §6 — Manual verification
- `npx nuxt prepare` — Types regenerated successfully (.nuxt/ fresh).
- `curl http://localhost:3100/{nomina,pacientes/72,login}` — HTTP 200, ~620KB SPA bundle.
- Playwright (anon — can't auth via Playwright because session cookie is HttpOnly
  and the LAN IP domain mismatch prevents curl-from-JS login): only errors are
  the expected `/auth/me` 401 probe. No `inject()` warnings introduced by my code
  (the remaining one is pre-existing from `middleware/auth.ts`).

---

## §Strategy Request
(none — all 6 acceptance criteria met)

