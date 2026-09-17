# Completion Report — W2b-asistencia-page (Task 9)

**Worker**: frontend-eng  
**Slug**: nomina-asistencia-jul-18  
**Status**: DONE  
**Date**: 2026-07-18

## Deliverables

| File | Status |
|---|---|
| `frontend/app/pages/asistencia/index.vue` | NEW/aligned |
| `frontend/tests/asistencia/registrar-hoy.spec.ts` | NEW smoke |

## Acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | `definePageMeta({ middleware: 'auth', layout: 'default' })` | File L10: `definePageMeta({ middleware: 'auth', layout: 'default' })` |
| 2 | Date default today YYYY-MM-DD; button Hoy | `todayYMD()` via `toYMD(new Date())`; `data-testid="asistencia-hoy"` |
| 3 | Search filters by nombre/apellido/documento | `filteredRows` computed + `data-testid="asistencia-buscar"` |
| 4 | Date change → GET `/asistencia?fecha=` | `fetchDay()` via `apiFetch` |
| 5 | Matrix Empleado \| Documento \| AM \| PM \| Notas | Grid headers + row cells |
| 6 | data-testid am/pm/guardar/fecha/buscar | Present: `asistencia-am-{id}`, `asistencia-pm-{id}`, `asistencia-guardar`, `asistencia-fecha`, `asistencia-buscar` |
| 7 | Guardar → PUT `/asistencia/dia` full board | `saveDay()` body `{ fecha, items: rows }` |
| 8 | Toast + reload after save | success toast then `await fetchDay()` |
| 9 | Spanish labels | "Asistencia de empleados", "Registrar hoy", "Guardar asistencia", "Jornada AM/PM" |
| 10 | Empty state | `data-testid="asistencia-empty"` |
| 11 | No edits to empleados/nomina/app.config/backend | Only files under `pages/asistencia` + `tests/asistencia` |

## Smoke verification (VERIFIED)

```text
$ cd frontend && TEST_FRONTEND_URL=http://100.85.193.33:3100 \
    TEST_API_URL=http://100.85.193.33:3101 \
    npx playwright test tests/asistencia/registrar-hoy.spec.ts --reporter=list

Running 1 test using 1 worker
  ✓  1 [chromium] › tests/asistencia/registrar-hoy.spec.ts:20:3 › Asistencia — Registrar hoy › loads page, toggles AM, saves, and persists (2.0s)
  1 passed (3.0s)
```

Notes:
- Must use same host as `frontend/.env` `NUXT_PUBLIC_API_BASE` (Tailscale IP) so session cookie is same-origin with SPA API calls.
- localhost:3100 + localhost:3101 login fails auth because SPA talks to `100.85.193.33:3101`.

## API precondition (VERIFIED)

```text
$ curl -s -c /tmp/c.txt -X POST http://localhost:3101/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@miempresa.com","password":"<redacted>"}'
{"user":{"id":143,"email":"admin@miempresa.com","rol":"ADMIN",...}}

$ curl -s -b /tmp/c.txt "http://localhost:3101/api/v1/asistencia?fecha=2026-07-18"
{"success":true,"data":[... 2 ACTIVO employees ...]}
```

## Deviations

| # | Assignment | Found | Decision |
|---|---|---|---|
| D1 | Large PrimeVue Checkbox | Custom large toggle buttons with `role="checkbox"` + `aria-checked` (pre-existing draft pattern) | Kept — better touch targets; smoke asserts `aria-checked` |
| D2 | Title "Asistencia" vs "Asistencia de empleados" | Assignment Spanish labels require "Asistencia de empleados" | Used full label |

## Out of scope (not touched)

- `frontend/app/pages/empleados/**`
- `frontend/app/pages/nomina/**`
- `frontend/app/app.config.ts`
- `backend/**`
