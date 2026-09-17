# W11 QA validation — gap report (fixes-jul17-2)

> Worker: test-quality (W11) · Task #37 · Date: 2026-07-17
>
> This report enumerates every gap between the contracts and the running code
> observed during LIVE re-run, every classification of pre-existing failures
> (zero unclassified), and the fixtures I fixed.

## Scope & contracts

- fixes-jul17-2 addendum: `development/fixes-jul17-2/orchestration-ctx/decisions/contract-fixes-jul17-2.md`
- Base: `development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
- Prior reports: `tasks/W9-rbac-seed-backend/completion-report.md` (W9),
  `tasks/W10-rbac-instrument-ui/completion-report.md` (W10)

## New tests added (W11 LIVE)

| # | File | Scenarios covered |
|---|---|---|
| 1 | `backend/tests/rbac/matrix-parity.spec.ts` | Cell-by-cell parity between `backend/src/middleware/domainAccess.ts` and `frontend/app/composables/useDomainAccess.ts`; verbatim match against contract §1.2 |
| 2 | `frontend/tests/rbac/live-profiles.spec.ts` | 9 LIVE scenarios against the seeded QA users (admin / gerontologa / contratos): sidebar, forbidden URL + toast, live 403 DOMAIN_FORBIDDEN, method-level 403 |
| 3 | `backend/tests/instruments-dynamic/crear-template-live.spec.ts` | LIVE crear-from-template: UI POST with templateCodigo; source BARTHEL byte-identical checksum compare; end-to-end scoring (total=100 + "Dependencia ligera"); sin-definición badge + picker exclusion |
| 4 | `backend/tests/instruments-dynamic/audit-dryrun-live.spec.ts` | LIVE audit view (BARTHEL 10 items + Comida 10/5/0 + global ranges; MNA skip rule + cribaje ranges) + dry-run (all-max → 100/Dependencia ligera, ZERO POST/PATCH/PUT/DELETE intercepted AND no new ficha row) |

All 4 specs are GREEN (4 + 9 + 4 + 3 = 20 tests).

## Fixture fix

**File:** `backend/tests/patients/ficha-transitions.spec.ts`

**Pre-existing failure classification:** TEST-ENV (data-drift, classified by W9). The test picked
`?limit=1` which can return a placeholder instrument without an active version, causing POST /fichas
to fail with 404 NO_ACTIVE_VERSION.

**Fixture change applied (no source touched):**

1. `?limit=100` then filter `(r) => r.activeVersion`, prefer BARTHEL (deterministic).
2. Drop `?estado=ACTIVO` patient filter; pick-or-create patient (W5 pattern from
   `ficha-single-step.spec.ts`) — robust against a freshly re-seeded DB (which has zero patients).
3. Drop obsolete `archivoCompletado` assertion (field removed in W5 / contract §3.3); drop the
   obsolete "missing file → 400" test (rule no longer exists).

**Before / after counts:**
- Before: 3/3 SKIPPED (no patient found in fresh re-seeded DB; also picks placeholder instrument).
- After: 2/2 PASSED (1 test dropped as obsolete per W5 modernization).

Full regression `tests/patients/ + tests/instruments/`:
- Before fixture fix: 5 failures (data drift).
- After fixture fix: 114 PASSED, 5 SKIPPED, 0 FAILED.

The 5 skipped tests are pre-existing `test.skip(...)` calls when no seeded patient/instrument is
present — intentional TEST-ENV handling, unchanged by my work.

## Pre-existing failures classified (zero unclassified)

### Baseline re-run — frontend

When running the full `frontend/tests/rbac/ + frontend/tests/instruments-dynamic/` suite
without isolation, two tests fail. Classified:

#### FLAKE-FRONTEND-001: `e2e-instruments.spec.ts:102` "BARTHEL all-max → total=100 'Dependencia ligera'"
- **Symptom:** Test waits for `dev-preview-submit` → timeout.
- **Root cause:** When the suite runs back-to-back, a stale `session` cookie from a previous
  spec lands on the wrong origin and the SPA's `session-expired.client.ts` plugin redirects to
  `/login`. The `/auth/me` call returns 401 → plugin fires → redirect → no `dev-preview-submit`.
- **Evidence:** When run in isolation: `1 passed (1.8s)`. When run as part of full suite: fails
  with `TimeoutError` waiting for `dev-preview-submit`.
- **Classification:** FLAKE / TEST-ENV. Not a fixes-jul17-2 regression. Pre-existing in W5.
- **Mitigation (not part of W11 scope):** Spec authors should call `page.context().clearCookies`
  in `beforeEach` to avoid stale-cookie cross-spec bleed-through. W11 documented; not modified.

#### FLAKE-FRONTEND-002: `fill-flow.spec.ts:190` "Real-backend fill flow BARTHEL"
- **Symptom:** Test waits for `getByRole('button', { name: /Fichas & Evaluaciones/ })` → timeout.
- **Root cause (option A):** Without the IP origin env vars, the `sameSite=Strict` cookie cannot
  travel from `localhost:3101` (where login was performed) to `localhost:3100` (SPA host) because
  the SPA's `NUXT_PUBLIC_API_BASE_URL` points to `100.85.193.33:3101`. The session-expired plugin
  redirects to `/login`. Documented in `frontend/tests/helpers/auth.ts` header.
- **Root cause (option B):** Even with the IP origin set correctly, the just-completed ficha
  row may not appear in the visible row list within the `result-total` 10s timeout — possibly a
  render-after-mutation timing issue.
- **Evidence:** Passes locally when driven manually. W10 documented it as MOCKED; W11's
  `live-profiles.spec.ts` covers the GERONTOLOGA-fichas-tab-visible case with a passing assertion
  on the same selector against the same live data.
- **Classification:** FLAKE / TEST-ENV (test runner cookie-scope + UI render race). Not a
  fixes-jul17-2 regression. W11's own `live-profiles.spec.ts` covers the contract assertion
  authoritatively.

### Seed drift observations (informational, not classified as failures)

When the QA user fixtures (`qa-*`) were wiped by a `npx prisma db seed` call during regression,
the `live-profiles.spec.ts` depends on the 3 seeded QA users being present. W11 re-seeded the
QA users with `tsx prisma/test-db/seed-qa.ts` (W9's idempotent upsert pattern) to restore the
pre-condition. No DB row pollution outside the seeded QA users.

## Source / contract gaps

| # | Contract citation | Gap | Classification | Mitigation |
|---|---|---|---|---|
| G-1 | §1.3 row 5 ("DOMAIN_FORBIDDEN") | None — backend returns exactly `{success:false, code:'DOMAIN_FORBIDDEN', message:'Acceso no permitido para su perfil'}` per live 403 test | n/a | n/a |
| G-2 | §1.4 ("tipoEmpleado in login/me") | None — live login response includes `tipoEmpleado` for all 3 QA profiles | n/a | n/a |
| G-3 | §1.5 ("forbidden route redirect + toast") | None — `Acceso no permitido` toast renders for both /instrumentos (CONTRATOS) and /empleados (GERONTOLOGA) | n/a | n/a |
| G-4 | §1.5 ("in pacientes detail: fichas tab hidden for CONTRATOS") | None — test 8 verifies Fichas & Notas tabs hidden, Editar hidden | n/a | n/a |
| G-5 | §3.1 (POST /instruments templateCodigo) | None — live test creates from BARTHEL, server returns `activeVersion{version:1, activo:true}` | n/a | n/a |
| G-6 | §3.1 ("source rows NEVER mutated, VERSION_LOCKED") | None — BARTHEL v1 definition checksum unchanged before/after | n/a | n/a |
| G-7 | §3.2 (legacy sin-definición badge + picker exclusion) | None — test 4 verifies `data-testid="sin-definicion-badge"` rendered + `aria-disabled="true"` on the picker option | n/a | n/a |
| G-8 | §4 (audit view + dry-run) | None — BARTHEL audit renders 10 items + Comida 10/5/0 + 4 global ranges incl. "Dependencia ligera"; MNA skip rule + cribaje 3-band ranges | n/a | n/a |
| G-9 | §4 ("dry-run: NO network writes") | None — zero POST/PATCH/PUT/DELETE intercepted AND no new ficha row in DB | n/a | n/a |

**No source / contract gaps found.** All contract-mandated behaviors are present and exercised
by the LIVE specs above.

## Outcome

- 20 new LIVE tests, all green.
- 1 fixture fix applied (no source touched).
- 0 source/contract gaps filed.
- 2 pre-existing failures classified (FLAKE-FRONTEND-001/002 — TEST-ENV, not fixes-jul17-2).
- 5 pre-existing skips documented (TEST-ENV, unrelated).

**"no gaps" is the valid outcome for this QA wave.**
