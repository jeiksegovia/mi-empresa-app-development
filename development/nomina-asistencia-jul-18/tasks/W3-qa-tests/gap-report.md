# Gap Report — W3-qa-tests (nomina-asistencia-jul-18)

**Worker**: test-quality  
**Date**: 2026-07-18  
**Contract**: `orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`  
**Rule**: no production source fixes in this wave.

---

## Summary

| Class | Count | Action |
|---|---|---|
| BUG (source vs contract) | **0** | — |
| TEST-ENV | **1** | document run origin for live FE |
| FLAKE | **0** | — |
| Coverage residual (not a failure) | **2** | optional follow-up |

Contract acceptance paths exercised by smoke + edge suites all **pass** against live API `:3101` and FE `:3100` (IP origin).

---

## G1 — TEST-ENV: live FE must use SPA API host (sameSite cookie)

| Field | Value |
|---|---|
| Severity | Medium (local-dev only) |
| Class | **TEST-ENV** |
| Area | `frontend/tests/asistencia/registrar-hoy.spec.ts`, helpers/auth |

### Repro

```bash
# FAILS (lands on login — cookie host mismatch)
cd frontend
TEST_FRONTEND_URL=http://localhost:3100 \
TEST_API_URL=http://localhost:3101 \
  npx playwright test tests/asistencia/registrar-hoy.spec.ts

# PASSES (matches frontend/.env NUXT_PUBLIC_API_BASE host)
TEST_FRONTEND_URL=http://100.85.193.33:3100 \
TEST_API_URL=http://100.85.193.33:3101 \
  npx playwright test tests/asistencia/registrar-hoy.spec.ts
```

### Expected
Live FE specs succeed when FE and API origins share the host used by `NUXT_PUBLIC_API_BASE` (session cookie `sameSite=Strict`).

### Actual
With `localhost:3100` + login to `localhost:3101`, SPA still calls `http://100.85.193.33:3101` → cross-site cookie drop → `/auth/me` 401 → login page.  
Diagnostic: `h1` “Asistencia de empleados” not found; body shows “Inicia sesión en tu cuenta” / “Sesión expirada”.

### Classification rationale
Not a product bug: cookie policy + env alignment. Documented in `frontend/tests/helpers/auth.ts`. Mocked FE suites (nav, dialog, medio UI) pass on either origin once Playwright is invoked from `frontend/`.

---

## G2 — Residual coverage: BE domain-access.spec omits `asistencia`

| Field | Value |
|---|---|
| Severity | Low |
| Class | coverage residual (not a failing run) |
| Area | `backend/tests/rbac/domain-access.spec.ts` |

### Observation
Matrix code includes `asistencia` (`GERONTOLOGA: false`, `CONTRATOS: true`) in domain access.  
`domain-access.spec.ts` still asserts empleados/nomina/… but **does not** call `GET /api/v1/asistencia`.

### Mitigations already green
- FE `nav-gating.spec.ts`: GERONTOLOGA hides Asistencia; CONTRATOS shows Asistencia.
- Route wiring uses `requireDomain('asistencia')`.

### Suggested follow-up (not done in W3)
Add 2 cases to domain-access: GERONTOLOGA → 403 `DOMAIN_FORBIDDEN`; CONTRATOS → 200 on `GET /asistencia?fecha=…`.

---

## G3 — Residual: `dialog-enrichment.spec.ts` is an empty alias

| Field | Value |
|---|---|
| Severity | Info |
| Class | test-hygiene residual |
| Area | `frontend/tests/nomina/dialog-enrichment.spec.ts` |

File only re-exports empty module; authoritative suite is `registrar-dialog-enrichment.spec.ts` (**2/2 pass**). Older run commands that only target `dialog-enrichment.spec.ts` will report **0 tests**. Prefer the `registrar-*` path.

---

## No-gap contract checks (verified green)

| Contract section | Evidence suite | Result |
|---|---|---|
| §2 medio conditional + pendiente | `medio-pago.spec` + `medio-pago-edge` | pass |
| §3 valorJornada required create | `contrato-valor-jornada` | pass |
| §4 day board / resumen / no-contract | `asistencia-dia` + `asistencia-edge` | pass |
| §5 calc defaults / override / dual-write | `nomina-calc-asistencia` + `nomina-calc-edge` | pass |
| §5 OPS/OBRA aportes 400 | smoke OPS + edge OBRA | pass |
| §6 domain matrix FE | `nav-gating` | pass |
| Registrar hoy live | `registrar-hoy` (IP) | pass |
| Dialog enrichment | `registrar-dialog-enrichment` | pass |

---

## Production source

W3 session **did not modify** `backend/src/**`, `backend/prisma/**`, `frontend/app/**`, `frontend/shared/**`.  
Only test files under `backend/tests/**` (edge specs) + this task dir reports.
