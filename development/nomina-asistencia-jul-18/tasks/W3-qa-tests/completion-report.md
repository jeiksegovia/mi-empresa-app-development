# Completion Report — W3-qa-tests

**Slug**: `nomina-asistencia-jul-18`  
**Task ID**: 12  
**Worker**: test-quality  
**Finished**: 2026-07-18  

---

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| All runnable smokes executed; pass/fail matrix | **PASS** | §Matrix below + command outputs |
| gap-report.md exists | **PASS** | `tasks/W3-qa-tests/gap-report.md` |
| No production source diffs from this session | **PASS** | only `backend/tests/**` edge extensions + task reports |
| Deep edges vs contract | **PASS** | 16 edge tests green |

---

## Final matrix

### Backend (from `backend/`, API `http://localhost:3101`)

Command (combined smoke + edge):

```bash
cd backend && npx playwright test \
  tests/employees/medio-pago.spec.ts \
  tests/employees/contrato-valor-jornada.spec.ts \
  tests/asistencia/asistencia-dia.spec.ts \
  tests/nomina/nomina-calc-asistencia.spec.ts \
  tests/employees/medio-pago-edge.spec.ts \
  tests/asistencia/asistencia-edge.spec.ts \
  tests/nomina/nomina-calc-edge.spec.ts \
  --reporter=line
```

| File | Tests | Result |
|---|---|---|
| `employees/medio-pago.spec.ts` | 4 | **pass** |
| `employees/contrato-valor-jornada.spec.ts` | 2 | **pass** |
| `asistencia/asistencia-dia.spec.ts` | 3 | **pass** |
| `nomina/nomina-calc-asistencia.spec.ts` | 3 | **pass** |
| `employees/medio-pago-edge.spec.ts` | 6 | **pass** |
| `asistencia/asistencia-edge.spec.ts` | 6 | **pass** |
| `nomina/nomina-calc-edge.spec.ts` | 4 | **pass** |
| **BE total** | **28** | **28 pass / 0 fail** |

Verbatim tail (`/tmp/be-full-w3.txt`):

```
  28 passed (2.1s)
```

Smoke-only reconfirm (`/tmp/be-smoke-w3.txt`):

```
  12 passed (1.5s)
```

### Frontend (IP origin matching SPA `.env`)

Command:

```bash
cd frontend && \
TEST_FRONTEND_URL=http://100.85.193.33:3100 \
TEST_API_URL=http://100.85.193.33:3101 \
  npx playwright test \
    tests/asistencia/registrar-hoy.spec.ts \
    tests/nomina/registrar-dialog-enrichment.spec.ts \
    tests/rbac/nav-gating.spec.ts \
    tests/empleados/medio-pago.spec.ts \
  --reporter=line
```

| File | Tests | Result |
|---|---|---|
| `asistencia/registrar-hoy.spec.ts` | 1 | **pass** (live) |
| `nomina/registrar-dialog-enrichment.spec.ts` | 2 | **pass** (mocked) |
| `rbac/nav-gating.spec.ts` | 5 | **pass** (mocked; Asistencia gating) |
| `empleados/medio-pago.spec.ts` | 2 | **pass** (mocked) |
| **FE total** | **10** | **10 pass / 0 fail** |

Verbatim tails:

```
# /tmp/fe-smoke-w3.txt (registrar-hoy + dialog + nav = 8)
  8 passed (10.7s)

# /tmp/fe-medio-w3.txt
  2 passed (4.4s)
```

Note: `dialog-enrichment.spec.ts` is an empty alias (0 tests) — not counted.

### Combined

| Scope | Passing | Failing |
|---|---|---|
| Backend | 28 | 0 |
| Frontend | 10 | 0 |
| **Total** | **38** | **0** |

Coverage (Playwright API/E2E — no Istanbul %): **contract scenarios covered**; formal line coverage **NOT-VERIFIED** (project does not emit % for these Playwright suites).

---

## Edge cases added / deepened

| Spec | Contract edges |
|---|---|
| `medio-pago-edge` | TRANSFERENCIA complete; field clearing NEQUI↔bank; pendiente idempotent; re-open on clear; empty NEQUI; missing bancoTipoCuenta |
| `asistencia-edge` | no-contract day board; medias/horas exact (`horas === medias*4`); fecha missing/invalid 400; empty items 400; synthetic `id:null` |
| `nomina-calc-edge` | omitted calc defaults from asistencia+contrato; total override + dual-write; `sugerido`/medio shape; OBRA aportes 400 |

---

## Gaps

See `gap-report.md`:

1. **TEST-ENV** — live FE requires `TEST_*_URL` host = `NUXT_PUBLIC_API_BASE` host (`100.85.193.33`).
2. Residual: BE `domain-access.spec` does not hit `/asistencia` (matrix code present; FE nav covers UI).
3. Residual: `dialog-enrichment.spec.ts` is empty alias → use `registrar-dialog-enrichment.spec.ts`.

**BUG count: 0.**

---

## How to re-run

```bash
# BE (must run from backend/)
cd backend && npx playwright test tests/employees/medio-pago*.spec.ts \
  tests/employees/contrato-valor-jornada.spec.ts \
  tests/asistencia/ \
  tests/nomina/nomina-calc-*.spec.ts --reporter=line

# FE (must match SPA API host + run from frontend/)
cd frontend && \
TEST_FRONTEND_URL=http://100.85.193.33:3100 \
TEST_API_URL=http://100.85.193.33:3101 \
  npx playwright test tests/asistencia/registrar-hoy.spec.ts \
  tests/nomina/registrar-dialog-enrichment.spec.ts \
  tests/rbac/nav-gating.spec.ts \
  tests/empleados/medio-pago.spec.ts --reporter=line
```

---

## Artifacts

- `development/nomina-asistencia-jul-18/tasks/W3-qa-tests/gap-report.md`
- `development/nomina-asistencia-jul-18/tasks/W3-qa-tests/progress-report.md`
- `development/nomina-asistencia-jul-18/tasks/W3-qa-tests/completion-report.md`
- Edge specs: `backend/tests/employees/medio-pago-edge.spec.ts`, `backend/tests/asistencia/asistencia-edge.spec.ts`, `backend/tests/nomina/nomina-calc-edge.spec.ts`
