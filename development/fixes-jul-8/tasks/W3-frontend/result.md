# W3-Frontend-A — Result

**Task ID:** 3
**Status:** ✅ Complete
**Scope:** fichas (3 bugs + form-state persistence), nomina (filter + error), 401 UX

---

## What changed

### 1. `frontend/app/composables/useApi.ts` — 401 UX (D1 mitigation)

The old code called `navigateTo('/login')` synchronously inside the $fetch
`onResponseError` callback, which fires async after the caller's setup() has
returned. Calling Nuxt auto-imported composables (`useRoute`, `useAuthStore`,
`useToast`, `navigateTo`) inside that callback raises a Vue
"inject() can only be used inside setup()" warning AND risks re-entrancy
(redirect storm when many 401s land in quick succession).

**Refactor**: the interceptor now does only what is safe in async context:
- Guards via `window.__apiRedirecting401` flag (so a burst collapses to one event).
- Dispatches a single DOM event `app:session-expired`.

All visible side-effects (clear Pinia auth, render toast, navigate) move to
`frontend/app/plugins/session-expired.client.ts`, which runs in proper setup
context and:
- Skips the redirect when `useRoute().path === '/login'` (login's own 401
  case is not a re-entry).
- Shows a PrimeVue toast "Sesión expirada / Por favor inicia sesión
  nuevamente" (with DOM-banner fallback in case no `<Toast />` is mounted).
- Calls `navigateTo('/login', { replace: true })`.

### 2. `frontend/app/plugins/session-expired.client.ts` — NEW plugin

See above. Only registered client-side (`.client.ts` suffix) so SSR — although
the app is `ssr: false` — never runs it. Subscribes a single listener for the
lifetime of the document and avoids duplicate toasts via a DOM-level check.

### 3. `frontend/app/pages/pacientes/[id]/index.vue` — 4 changes

#### 3.1 Bug 1: Instrument name fallback
- TS interface: `RegistroFicha` now has optional nested `instrumento?: { id;
  nombreInstrumento; tipo }` (matches the **new** W2 shape) PLUS the legacy
  flat `instrumentoNombre? / instrumentoTipo?` so backwards compatibility is
  retained.
- The "Instrumento" cell reads `data.instrumento?.nombreInstrumento ??
  data.instrumentoNombre ?? '—'` (and likewise for tipo).

#### 3.2 Bug 2: handleFichaSubmit now sends notas + fechaVencimiento
- New `fichaForm.notasObservaciones` (string) — rendered as a PrimeVue
  `<Textarea>` in the dialog, ALWAYS visible.
- New `fichaForm.fechaVencimiento` (YYYY-MM-DD string) — rendered as PrimeVue
  `<DatePicker>`, optional.
- PATCH body now includes both fields (when non-empty) — the backend already
  supports them per `backend/src/routes/patients.routes.ts:222-269`.

#### 3.3 Bug 3: VENCIDO → COMPLETADO transition is now allowed (D3)
- `validTransitions[VENCIDO] = ['COMPLETADO']` (matches backend W2 task #9).
- Pencil button disabled condition swapped from
  `:disabled="data.estado === 'VENCIDO'"` to
  `:disabled="!validTransitions[data.estado]?.length"`.
- Tooltip text updated to reflect availability.

#### 3.4 Form-state sessionStorage persistence (D1 mitigation)
- New `fichaDraftKey` computed: scoped per patient id + ficha id so multiple
  fichas never collide.
- `openFichaDialog()` restores `notasObservaciones`, `fechaVencimiento`,
  `newEstado`, and `uploadedFileName` from `sessionStorage` if present.
- File-input shows the persisted name with an amber hint "Vuelve a seleccionar
  «<name>» para continuar." (we deliberately do NOT persist the File object —
  that's IndexedDB territory).
- A `watch` writes the draft on every field/file change while the dialog is
  open.
- Successful save → `clearFichaDraft()` removes the entry.
- User Cancel keeps the draft (so a stray reload mid-edit doesn't wipe
  work — D1's whole point).

### 4. `frontend/app/pages/nomina/index.vue` — 2 changes

#### 4.1 D5: tipoContrato filter
- New `<MultiSelect>` at the top of the page, options include all 5 options
  (`OPS`, `OBRA_O_LABOR`, `TERMINO_FIJO`, `TERMINO_INDEFINIDO`, `SIN_CONTRATO`).
- Default value = 4 active contract types; `SIN_CONTRATO` is opt-in.
- The UI uses `SIN_CONTRATO` as the value; on the wire it serializes to
  `NONE` (per W2 task #10). Mapping happens in `buildTipoContratoQuery()`.
- `fetchRows()` appends `&tipoContrato=OPS,OBRA_O_LABOR,...` to the URL
  (URL-encoded).
- A `watch(selectedTipoFilter)` refetches the rows on change.
- A small "Incluir sin contrato" button appears if the user empties the
  filter entirely, to make 1-click reset easy.

#### 4.2 D4: cuenta-de-cobro inline error
- New `cuentaCobroError: ref<string | null>(null)` reactive state.
- `saveEntrada()` catch now branches: if `e?.data?.field === 'archivos.CUENTA_COBRO'`
  it sets the ref to `e.data.message` (with fallback text).
- The catch still also fires the global toast so users see something either
  way.
- A PrimeVue `<Message severity="error" :closable="true">` renders under
  the `Cuenta de cobro` slot whenever `cuentaCobroError` is set, with a
  `data-testid="nomina-cuenta-cobro-error"` hook for tests.
- `openDialog()` and `closeDialog()` clear the error so retries start fresh.

---

## Manual verification

| Check | Result |
|---|---|
| `npx nuxt prepare` regenerates types | ✅ Types generated in .nuxt |
| `curl http://localhost:3100/nomina` | ✅ HTTP 200, 623KB |
| `curl http://localhost:3100/pacientes/72` | ✅ HTTP 200 |
| `curl http://localhost:3100/login` | ✅ HTTP 200 |
| Playwright: navigation to `/pacientes/72` (no auth) | ✅ redirects to `/login`, only 1 console error (the expected `/auth/me` probe), no `inject()` warnings from my code |
| Playwright: re-nav to `/nomina` (no auth) | ✅ same — no error storm, no re-entrancy |
| Backend `GET /nomina?periodo=2026-07&tipoContrato=OPS,...` | ✅ returns OPS contratos |
| Backend `GET /nomina?periodo=2026-07&tipoContrato=NONE` | ✅ returns empleados sin contrato |
| Backend `GET /patients/72` returns nested `instrumento.{nombreInstrumento,tipo}` | ✅ confirms W2 shape change |

**Note on full end-to-end testing**: I could not log in via the Playwright browser
because the backend's session cookie is `HttpOnly` and the browser resolves
`localhost` to `100.85.193.33` while my curl cookie was scoped to `localhost` —
different cookie domains, so JS-set cookies are out, and curl-set cookies don't
reach the browser. The W2 shape change was verified via curl instead.

---

## Cross-coupling with W2

| W2 commit | My frontend readiness |
|---|---|
| VENCIDO → COMPLETADO allow | ✅ Map updated; pencil will enable on VENCIDO when W2 ships (rollback-safe: currently `validTransitions[VENCIDO] = ['COMPLETADO']` matches expected backend behavior) |
| nomina tipoContrato filter | ✅ URL building handles 4 active tipos + NONE; default includes 4 active tipos only |
| nomina cuenta-de-cobro 400 + `{field,message}` | ✅ Catch branches on `e?.data?.field === 'archivos.CUENTA_COBRO'`; falls back to toast gracefully if W2 hasn't shipped the field |
| fichas PATCH accepts `notasObservaciones`/`fechaVencimiento` | ✅ PATCH body sends them when non-empty (zero new work needed from W2) |
| fichas nested `instrumento` shape | ✅ Template reads nested shape with flat fallback — works either way |

## Files modified

```
frontend/app/composables/useApi.ts                          (modified — 401 dispatch)
frontend/app/plugins/session-expired.client.ts              (NEW — toast + nav)
frontend/app/pages/pacientes/[id]/index.vue                 (modified — 4 changes)
frontend/app/pages/nomina/index.vue                          (modified — filter + error)
```

## Files NOT modified (per orchestrator instructions)

- ❌ `frontend/app/composables/useFileUpload.ts`
- ❌ `frontend/nuxt.config.ts`
- ❌ Any `frontend/app/pages/certificados/**` (W4 owns)
- ❌ Any `frontend/app/pages/instrumentos/**` (W4 owns)
- ❌ Any backend file (W2 owns)
