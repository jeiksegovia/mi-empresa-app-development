# W10 progress report — rbac-instrument-ui (fixes-jul17-2)

Working dir: `frontend/`. Contract: `contract-fixes-jul17-2.md` (§1.2/§1.5/§3.2/§4) + base dynamic-fichas §4.

---

## Task #34 — Domain gating (§1.5) — ✅ COMPLETE

### Files created
- `frontend/app/composables/useDomainAccess.ts` — exports `DOMAIN_ACCESS` (§1.2 matrix, mirrored cell-by-cell, QA-checkable constant), `Domain` type, `DOMAIN_PREFIX_MAP`, `domainForPath()`, and `useDomainAccess()` → `{ profile, access, can, canCreateOnly }`.
  - Resolution (§1.3): `ADMIN` → null profile → full access; non-EMPLEADO (AUDITOR/OPERADOR) → full access; EMPLEADO+null → full access (legacy, zero regression); EMPLEADO+GERONTOLOGA/CONTRATOS → matrix.
  - `can(d)` = access !== false (full OR create-only). `canCreateOnly(d)` = access === 'create-only'.
- `frontend/app/plugins/access-denied.client.ts` — listens for `app:access-denied` DOM event → PrimeVue toast "Acceso no permitido" (fallback in-DOM banner if no `<Toast/>`), mirrors session-expired plugin.
- `frontend/app/middleware/domain-access.global.ts` — global route middleware: `domainForPath(to.path)`; ensures session (fetchUser) for guarded routes; forbidden → dispatch `app:access-denied` + `navigateTo('/')`. Unguarded routes pass through.
- `frontend/tests/rbac/nav-gating.spec.ts` — 5 specs, session MOCKED via route interception.

### Files edited
- `frontend/shared/types/api.ts` — added `TipoEmpleado` type + `tipoEmpleado?: TipoEmpleado | null` to `User` (§1.4 consumption).
- `frontend/app/components/AppSidebar.vue` — `filteredMenuItems` now also hides items whose `domainForPath(item.to)` is forbidden (kept pre-existing empresa admin-only rule).
- `frontend/app/composables/useApi.ts` — `onResponseError` now catches 403 `{code:'DOMAIN_FORBIDDEN'}` → dispatch `app:access-denied` (single robust place; no page silently fails).
- `frontend/app/pages/pacientes/[id]/index.vue` — tabs restructured to `{index,label,icon,domain}` + `visibleTabs` computed (Fichas→'fichas', Notas→'notas'); `watchEffect` resets activeTab if hidden; Fichas/Notas content wrappers gated with `v-if="can('fichas'|'notas')"`; "Editar" button hidden under `canCreateOnly('pacientes')`.

### Test evidence (against running frontend localhost:3100, session mocked)
```
Running 5 tests using 1 worker
  ✓ GERONTOLOGA: pacientes + instrumentos visible; empleados/nomina/certificados/empresa hidden (501ms)
  ✓ CONTRATOS: empleados/nomina/certificados/pacientes visible; instrumentos/empresa hidden (470ms)
  ✓ ADMIN (legacy null): every section visible incl. Empresa (466ms)
  ✓ CONTRATOS: forbidden route /instrumentos redirects to / with access-denied toast (390ms)
  ✓ fichas tab: visible for GERONTOLOGA, hidden for CONTRATOS on pacientes detail (913ms)
  5 passed (3.8s)
```

### Notes / gotchas discovered
- Home `/` fetches unmocked dashboard endpoints → real 401 → session-expired redirect. Spec uses a catch-all `**/api/v1/**` 200 stub registered FIRST (Playwright = last-registered-wins) so specific routes override it.
- NuxtLink `<a>` in dev doesn't reliably expose the implicit `link` role → spec uses `aside nav`.getByText(label,{exact}) instead of getByRole('link').
- MOCKED vs LIVE: all nav-gating assertions run against a route-mocked session (W9 QA users may not be seeded). W11 must re-run against real qa-gerontologa/qa-contratos/qa-admin.

### Deviations W10
- None for #34. Matrix mirrored verbatim from §1.2.

---

## Task #35 — Crear selector + sin-definición — ✅ COMPLETE

### Files edited
- `frontend/app/pages/instrumentos/crear.vue` — "Tipo de instrumento (plantilla)" `Select` (`data-testid="template-selector"`): "Sin plantilla" + 6 templates. Summaries computed from `GET /instruments/:codigo/definition` (`summarizeDefinition`: "N ítems · máx M" or "N ítems · informativo"; degrades gracefully on 404). `templateCodigo` added to POST body when a template is chosen.
- `frontend/app/pages/instrumentos/index.vue` — `InstrumentSummary.activeVersion?`; "Sin definición — no llenable" `Tag` (`data-testid="sin-definicion-badge"`) when `!activeVersion`.
- `frontend/app/pages/instrumentos/[id]/index.vue` — loads active definition (`loadDefinition()`, §4.2; 404/403 ⇒ sin definición); `hasDefinition`; header badge when `!hasDefinition`. (Feeds #36 audit/dry-run.)
- `frontend/app/pages/pacientes/[id]/index.vue` — assign picker: `_disabled: !activeVersion` + `option-disabled`; warn `Tag` (`data-testid="picker-sin-definicion"`); not selectable.

### Files created
- `frontend/tests/instruments-dynamic/crear-template.spec.ts` — 3 specs (MOCKED session + API).

### Test evidence
```
Running 3 tests using 1 worker
  ✓ selector renders the 6 templates + "Sin plantilla" (7 options) (1.0s)
  ✓ creating with BARTHEL template sends templateCodigo and yields a fillable instrument (2.6s)
  ✓ sin-definición instrument shows badge in list and is disabled in the assign picker (1.4s)
  3 passed (6.1s)
```

### MOCKED vs LIVE
All assertions run against a route-mocked admin session + mocked instruments/definition/create endpoints. W9 backend (#33) is complete; W11 must re-run create→fillable path + a real legacy sin-definición row against the live backend.

### Deviations W10
None for #35.

## Task #36 — Audit view + dry-run — ✅ COMPLETE

### Files created
- `frontend/app/components/instrument/InstrumentAuditView.vue` — read-only, print-friendly, collapsible (`<details open>`) audit. Per section: título + subtotal máx + skip-rule text ("Se omite (opcional) si \"<sección>\" ≥ N") + section ranges table. Per item: label + tipo + requerido/opcional + options table (etiqueta → puntaje). Global result-evaluation table (or "informativo" for `total:'none'`). Data-driven, zero instrument-specific code.
- `frontend/tests/instruments-dynamic/audit-dryrun.spec.ts` — 3 specs (MOCKED).

### Files edited
- `frontend/app/pages/instrumentos/[id]/index.vue` — imports DynamicInstrumentForm + InstrumentAuditView; "Probar sin guardar" header button (`data-testid="dry-run-button"`, hidden for sin definición); collapsible "Revisión de puntajes y lógica" card (`data-testid="audit-expand"`) rendering AuditView from the active definition; dry-run `Dialog` (`data-testid="dry-run-dialog"`) with banner "Vista de prueba — resultado no oficial, no se guarda" + DynamicInstrumentForm bound to local `dryRunAnswers` (`:model-value` + explicit update handler — v-model pitfall avoided). No apiFetch calls in the dry-run path (definition already GET-loaded).

### Test evidence
```
Running 3 tests using 1 worker
  ✓ BARTHEL audit: 10 items, option scores (Comida 10/5/0), global ranges table (999ms)
  ✓ MNA audit: skip rule text + cribaje section ranges (488ms)
  ✓ dry-run: fill Barthel all-max → total 100 + "Dependencia ligera", ZERO POST/PATCH (905ms)
  3 passed (3.5s)
```
Zero-write proven by intercepting all POST/PATCH/PUT/DELETE to `/api/v1/` during the dialog session (`writes` array length 0).

### MOCKED vs LIVE
Session + detail + definition mocked (BARTHEL & MNA_CUADRO fixtures). The dry-run zero-write assertion is authoritative (request interception). W11 re-runs the audit + dry-run against a live seeded instrument.

### Deviations W10
None for #36.

---

## Full W10 suite — 11/11 PASS
`rbac/nav-gating.spec.ts` (5) + `instruments-dynamic/crear-template.spec.ts` (3) + `instruments-dynamic/audit-dryrun.spec.ts` (3) → **11 passed**.
