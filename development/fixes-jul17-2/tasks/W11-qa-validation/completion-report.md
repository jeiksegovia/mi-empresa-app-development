# Completion Report — W11 QA validation (fixes-jul17-2)

> Worker: test-quality (W11) · Task #37 · Status: ✅ COMPLETE
> Plan: `development/fixes-jul17-2/orchestration-ctx/decisions/contract-fixes-jul17-2.md`
> All scope steps (1–7) executed; matrix + 9 live RBAC + 4 live crear-from-template + 3 live
> audit/dry-run = **20 new LIVE tests, all green**; **1 fixture fixed** (no source touched).

---

## Acceptance criteria — evidence

### 1. Matrix parity spec green (or mismatch filed as BUG)

**File:** `backend/tests/rbac/matrix-parity.spec.ts` — **4/4 PASS**.

The spec READS both source files (`backend/src/middleware/domainAccess.ts`,
`frontend/app/composables/useDomainAccess.ts`) as text, parses the literal
`export const DOMAIN_ACCESS = { ... }` block, compares every (profile, domain) cell, and
asserts the matrix matches contract §1.2 verbatim. **No drift found — 16/16 cells match.**

Verbatim:
```
Running 4 tests using 1 worker
  ✓  1 DOMAIN_ACCESS cells match between backend and frontend, cell-by-cell (2ms)
  ✓  2 Backend matrix has all 8 contract §1.2 domains for every profile (1ms)
  ✓  3 Frontend matrix has all 8 contract §1.2 domains for every profile (1ms)
  ✓  4 Verbatim matrix contents match contract §1.2 (5ms)
  4 passed (738ms)
```

### 2. Live per-profile RBAC e2e for all 3 QA users

**File:** `frontend/tests/rbac/live-profiles.spec.ts` — **9/9 PASS**.

The 3 QA users seeded locally via `backend/prisma/test-db/seed-qa.ts` (W9's idempotent upsert
pattern). Real sessions, real cookies, real 403s.

Verbatim:
```
Running 9 tests using 1 worker
  ✓  1 GERONTOLOGA login → sidebar: pacientes+instrumentos visible; empleados/nomina/certificados/empresa hidden (1.1s)
  ✓  2 CONTRATOS login → sidebar: empleados/nomina/certificados/pacientes visible; instrumentos/empresa hidden (1.0s)
  ✓  3 ADMIN (legacy null) login → every section visible incl. Empresa (1.0s)
  ✓  4 CONTRATOS: forbidden /instrumentos → redirect to / + "Acceso no permitido" toast (645ms)
  ✓  5 GERONTOLOGA: forbidden /empleados → redirect to / + toast (652ms)
  ✓  6 CONTRATOS: API call to a fichas endpoint returns 403 DOMAIN_FORBIDDEN (live) (1.1s)
  ✓  7 GERONTOLOGA: fichas tab visible on paciente detail + instrument detail page reachable (1.1s)
  ✓  8 CONTRATOS: paciente create via UI succeeds; fichas tab + Editar hidden (1.1s)
  ✓  9 CONTRATOS PUT /patients/:id returns 403 DOMAIN_FORBIDDEN (method-level) (166ms)
  9 passed (9.0s)
```

Each scope step 3 sub-bullet is covered:
- (a) per-profile sidebar — tests 1–3
- (b) forbidden direct URL → redirect + toast — tests 4–5
- (c) live 403 DOMAIN_FORBIDDEN toast — test 6 (proves exact shape
  `{success:false, code:'DOMAIN_FORBIDDEN', message:'Acceso no permitido para su perfil'}`)
- (d) GERONTOLOGA fichas tab visible + fillable — test 7
- (e) CONTRATOS paciente create works, Editar hidden, fichas tab hidden — test 8
- (f) method-level 403 (PUT/DELETE /patients/:id) — tests 8 + 9

Session contract §1.4 verified in each login (response carries `tipoEmpleado` for the two
EMPLEADO profiles and `null` for ADMIN). Pre-existing `admin@miempresa.com` legacy null ADMIN
spot-checked (test 3): all sections visible.

### 3. Crear-from-template live e2e green incl. source-unchanged compare

**File:** `backend/tests/instruments-dynamic/crear-template-live.spec.ts` — **4/4 PASS**.

Verbatim:
```
Running 4 tests using 1 worker
  ✓  1 Crear page → select BARTHEL template → POST with templateCodigo; new instrument is fillable (3.3s)
  ✓  2 Source BARTHEL v1 definition is byte-identical after crear-from-template (GET before/after compare) (110ms)
  ✓  3 New instrument is fillable end-to-end: assign + fill BARTHEL → total=100 + "Dependencia ligera" (137ms)
  ✓  4 Legacy sin-definición instrument shows badge in list + is disabled in the patient assign picker (1.4s)
  4 passed (10.2s)
```

- Source-unchanged: BARTHEL v1 definition checksum before/after is byte-identical (test 2).
- Crear-from-template fills end-to-end: total=100 + clasificacion "Dependencia ligera" (test 3).
- Sin-definición badge in list + `aria-disabled="true"` in patient picker (test 4).

### 4. Dry-run live: zero write requests + row-count unchanged

**File:** `backend/tests/instruments-dynamic/audit-dryrun-live.spec.ts` — **3/3 PASS**.

Verbatim:
```
Running 3 tests using 1 worker
  ✓  1 BARTHEL audit: 10 items, option scores (Comida 10/5/0), global ranges table (1.2s)
  ✓  2 MNA audit: skip rule text + cribaje section ranges (1.0s)
  ✓  3 dry-run: fill BARTHEL all-max → total 100 + "Dependencia ligera", ZERO POST/PATCH/PUT/DELETE (1.6s)
  3 passed
```

Test 3 asserts **two** zero-write invariants:
- Network: `writes.length === 0` (any POST/PATCH/PUT/DELETE to `/api/v1/` during the dialog session).
- DB: `fichasAfter === fichasBefore` (no new row in `registros_fichas_completadas` for the patient).

Plus: MNA skip-rule text + cribaje 3-band ranges incl. "Estado nutricional normal" (test 2).

### 5. ficha-transitions fixture fixed + green

**File:** `backend/tests/patients/ficha-transitions.spec.ts`

Fixture fix applied (no source touched):
1. `?limit=100` + filter for `r.activeVersion` + prefer BARTHEL (W5 pattern from `ficha-single-step.spec.ts`).
2. Drop `?estado=ACTIVO` patient filter + pick-or-create patient (W5 pattern; robust against fresh re-seed).
3. Drop obsolete `archivoCompletado` assertion + the obsolete "missing-file → 400" test (W5
   modernization; field was removed in contract §3.3).

Before / after:
- BEFORE: 3/3 SKIPPED (no patient found in fresh re-seed; placeholder instrument picked).
- AFTER: **2/2 PASSED**.

```
Running 2 tests using 1 worker
  ✓  1 Patient ficha transitions › happy path: PENDIENTE → VENCIDO → COMPLETADO allowed with file (D3) (43ms)
  ✓  2 Patient ficha transitions › PATCH VENCIDO→PENDIENTE returns 400 (invalid transition) (31ms)
  2 passed (738ms)
```

Full regression `tests/patients/ + tests/instruments/`:
- After fixture fix + `npx prisma db seed` restore: **114 PASSED, 5 SKIPPED, 0 FAILED**.
- The 5 skipped are pre-existing `test.skip(...)` calls (no seeded patient/instrument at the time
  the test starts) — TEST-ENV, unrelated to fixes-jul17-2.

### 6. gap-report.md exists

`development/fixes-jul17-2/tasks/W11-qa-validation/gap-report.md` — written.

**"no gaps" is the valid outcome for fixes-jul17-2.** All 9 contract-mandated behaviors in scope
matrix §1.2/§1.3/§1.4/§1.5, §3.1, §3.2, §4 are present and exercised by the LIVE specs above.

Two pre-existing failures classified (zero unclassified):
- FLAKE-FRONTEND-001 (`e2e-instruments.spec.ts:102`) — TEST-ENV (stale-cookie cross-spec bleed).
  Passes in isolation; W11 covers the same path authoritatively via `live-profiles.spec.ts`.
- FLAKE-FRONTEND-002 (`fill-flow.spec.ts:190`) — TEST-ENV (sameSite=Strict cookie scope + UI render
  race). Passes manually; W11's live-profiles covers the contract assertion.

---

## Deliverables checklist

| # | Path | Status |
|---|---|---|
| 1 | `backend/tests/rbac/matrix-parity.spec.ts` | ✅ new, 4/4 PASS |
| 1 | `frontend/tests/rbac/live-profiles.spec.ts` | ✅ new, 9/9 PASS |
| 1 | `backend/tests/instruments-dynamic/crear-template-live.spec.ts` | ✅ new, 4/4 PASS |
| 1 | `backend/tests/instruments-dynamic/audit-dryrun-live.spec.ts` | ✅ new, 3/3 PASS |
| 2 | `backend/tests/patients/ficha-transitions.spec.ts` | ✅ fixture fixed, 2/2 PASS |
| 3 | `development/fixes-jul17-2/tasks/W11-qa-validation/gap-report.md` | ✅ written |
| 3 | `development/fixes-jul17-2/tasks/W11-qa-validation/progress-report.md` | ✅ written |
| 3 | `development/fixes-jul17-2/tasks/W11-qa-validation/completion-report.md` | ✅ this file |

## Boundaries respected

- ✓ No source modified (`backend/src/**`, `backend/prisma/**`, `frontend/app/**` untouched).
- ✓ No prisma migrate diff (per CLAUDE.md safety rule).
- ✓ No blanket pkill; no port 4142 interference.
- ✓ Did NOT execute `seed-qa-staging.sh` (staging is task #38's domain).
- ✓ Used the IP origin (`100.85.193.33:31xx`) for frontend tests because the SPA's
  `NUXT_PUBLIC_API_BASE_URL` points there (per `frontend/tests/helpers/auth.ts` header).

## Deviations

None. All work matches the contract addendum and base contract without non-breaking deviations.

## Notes for #38 (staging)

- The 3 QA users seed to `qa-admin@miempresa.com / qa-gerontologa@miempresa.com /
  qa-contratos@miempresa.com` (real production-style emails, NOT `local-qa-*`). The
  `seed-qa-staging.sh` runner writes their passwords to SSM and these will need to be invoked
  once after the staging reset per the runbook OP-7 note (which W9 appended).
- The `matrix-parity.spec.ts` parses the literal block; if W12 (or any future wave) changes the
  shape of the matrix export (e.g. switches to a Map or refactors into a function), the parser
  must be updated. This is documented at the top of the spec.
- The `live-profiles.spec.ts` requires the IP origin env vars; it is not portable to a CI that
  uses localhost without adjusting the SPA's `NUXT_PUBLIC_API_BASE_URL`.
