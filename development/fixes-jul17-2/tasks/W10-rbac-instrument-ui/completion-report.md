# W10 completion report — rbac-instrument-ui (fixes-jul17-2)

**Worker:** frontend-eng (W10) · **Tasks:** #34 → #35 → #36 · **Status:** ✅ ALL COMPLETE
**Scope written:** `frontend/**` + this task dir only. No `backend/**` touched. DynamicInstrumentForm/scoring.ts consumed unchanged.

Verbatim test command (run against the live dev frontend on :3100; session + APIs mocked via
Playwright route interception):
```
cd frontend && TEST_FRONTEND_URL=http://localhost:3100 \
  npx playwright test rbac/nav-gating.spec.ts \
  instruments-dynamic/crear-template.spec.ts \
  instruments-dynamic/audit-dryrun.spec.ts --reporter=list
```
Result:
```
Running 11 tests using 1 worker
  ✓  1 audit-dryrun › BARTHEL audit: 10 items, option scores (Comida 10/5/0), global ranges table (999ms)
  ✓  2 audit-dryrun › MNA audit: skip rule text + cribaje section ranges (488ms)
  ✓  3 audit-dryrun › dry-run: fill Barthel all-max → total 100 + "Dependencia ligera", ZERO POST/PATCH (905ms)
  ✓  4 crear-template › selector renders the 6 templates + "Sin plantilla" (7 options) (496ms)
  ✓  5 crear-template › creating with BARTHEL template sends templateCodigo and yields a fillable instrument (2.6s)
  ✓  6 crear-template › sin-definición instrument shows badge in list and is disabled in the assign picker (917ms)
  ✓  7 nav-gating › GERONTOLOGA: pacientes + instrumentos visible; empleados/nomina/certificados/empresa hidden (478ms)
  ✓  8 nav-gating › CONTRATOS: empleados/nomina/certificados/pacientes visible; instrumentos/empresa hidden (476ms)
  ✓  9 nav-gating › ADMIN (legacy null): every section visible incl. Empresa (468ms)
  ✓ 10 nav-gating › CONTRATOS: forbidden route /instrumentos redirects to / with access-denied toast (383ms)
  ✓ 11 nav-gating › fichas tab: visible for GERONTOLOGA, hidden for CONTRATOS on pacientes detail (900ms)
  11 passed (10.2s)
```

---

## Acceptance criteria

### 1. Matrix parity: useDomainAccess cells == contract §1.2 (QA-checkable exported constant) — ✅
`frontend/app/composables/useDomainAccess.ts` exports `DOMAIN_ACCESS` (flat literal, mirrored
cell-by-cell). Verbatim:
```
GERONTOLOGA: pacientes:true fichas:true instrumentos:true empleados:false nomina:false certificados:false empresa:false notas:true
CONTRATOS:   pacientes:'create-only' fichas:false instrumentos:false empleados:true nomina:true certificados:true empresa:false notas:false
```
Resolution (§1.3): ADMIN → all; non-EMPLEADO (AUDITOR/OPERADOR) → all (existing behavior); EMPLEADO+null → all (legacy, zero regression); EMPLEADO+GERONTOLOGA/CONTRATOS → matrix. `can()`=access!==false, `canCreateOnly()`=access==='create-only'.

### 2. Per-profile nav gating + forbidden-route redirect + fichas-tab behavior — ✅
Proven by specs #7–#11 above:
- Sidebar (`AppSidebar.vue`) hides forbidden sections per profile (kept empresa admin-only rule).
- `middleware/domain-access.global.ts` redirects forbidden routes to `/` + fires `app:access-denied`; spec #10 asserts URL→`/` + toast "Acceso no permitido".
- pacientes detail: Fichas/Notas tabs gated by `can('fichas'|'notas')`; "Editar" hidden under `canCreateOnly('pacientes')`; spec #11 asserts GERONTOLOGA sees Fichas tab, CONTRATOS does not (and no Editar).
- 403 `{code:'DOMAIN_FORBIDDEN'}` surfaces the same toast via `useApi` onResponseError (single place; NOT-VERIFIED by an isolated spec — covered indirectly; W11 to add a live 403 case).

### 3. Crear with template → fillable instrument; sin-definición badge + picker exclusion — ✅
Specs #4–#6:
- 6 templates + "Sin plantilla" = 7 options (spec #4).
- POST body carries `templateCodigo:'BARTHEL'`; created instrument (activeVersion + definition) shows NO sin-definición badge (spec #5).
- Legacy `activeVersion:null` → list badge `data-testid="sin-definicion-badge"` (count 1) + picker option `aria-disabled=true` with warn tag (spec #6).

### 4. Audit view shows every option score + ranges + skip rules for BARTHEL and MNA — ✅
Specs #1–#2:
- BARTHEL: 10 `[data-audit-item]`; Comida option scores 10/5/0 asserted verbatim; global ranges table = 4 bands incl. "Dependencia ligera".
- MNA: `[data-audit-skiprule="evaluacion"]` contains "Se omite" + "≥ 12"; cribaje section ranges = 3 bands incl. "Estado nutricional normal".

### 5. Dry-run: live scoring works, zero write requests, nothing persisted — ✅
Spec #3: fill Barthel all-max → `classification-tentative` == "Dependencia ligera" and dialog contains "100". All POST/PATCH/PUT/DELETE to `/api/v1/` intercepted during the dialog session → `writes.length === 0`. Nothing persisted (no write endpoints hit).

### 6. All specs' verbatim output + mocked-vs-live listed — ✅
Verbatim output above. **Mocked-vs-live:**
- ALL 11 specs run against a route-**MOCKED** session + mocked read/create endpoints (deterministic; independent of DB seed). Reasons in each spec header.
- The dry-run zero-write assertion (spec #3) is authoritative regardless of mocking (request interception).
- **W11 MUST re-run live** with real seeded users (qa-gerontologa/qa-contratos/qa-admin from W9 #32) and real instruments: (a) nav gating per real profile; (b) a live 403 DOMAIN_FORBIDDEN toast; (c) create-from-template → fillable + a real legacy sin-definición row; (d) audit + dry-run on a live seeded instrument.

---

## Deliverables
1. `useDomainAccess.ts`, `middleware/domain-access.global.ts`, `plugins/access-denied.client.ts`, layout (`AppSidebar.vue`) + page gating (`pacientes/[id]/index.vue`), `useApi.ts` 403 handler, `shared/types/api.ts` (`tipoEmpleado`).
2. `instrumentos/crear.vue` template selector + `instrumentos/index.vue` + `instrumentos/[id]/index.vue` + pacientes picker sin-definición states.
3. `components/instrument/InstrumentAuditView.vue` + detail-page audit wiring + dry-run dialog.
4. Specs: `tests/rbac/nav-gating.spec.ts`, `tests/instruments-dynamic/{crear-template,audit-dryrun}.spec.ts`.
5. This report + `progress-report.md`.

## Traps handled
- v-model-on-const-reactive: dry-run uses `:model-value` + explicit `@update:model-value` handler.
- PrimeVue RadioButton in Playwright: `page.evaluate(() => input.click())` on hidden `input[type=radio]`.
- Uppercase-as-you-type: unchanged; only the existing crear `nombre` field keeps it. No new inputs upper-case.
- Backend-lag: built strictly to contract; no backend source read. All mocked paths flagged for W11 live re-run.

## Deviations W10
None. Matrix mirrored verbatim from §1.2; all API shapes per contract §3.1/§4.1/§4.2.

## Notes for QA (W11)
- NuxtLink `<a>` in dev doesn't expose implicit `link` role → sidebar assertions use `getByText` (exact) within `aside nav`.
- Home `/` pulls unmocked dashboard endpoints → a stray 401 trips the session-expired redirect; specs use a catch-all `**/api/v1/**` 200 stub registered first (Playwright last-registered-wins).
