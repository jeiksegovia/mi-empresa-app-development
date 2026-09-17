# Progress: W3-qa-tests
**Worker**: test-quality (W3-qa-tests), **Started**: 2026-07-18

## Subtask 12 — completed

### Cwd / env
- Project root `/Users/jeik/ws/mi-empresa-app-development`
- API :3101 + FE :3100 up; never touched :4142
- BE playwright must run from `backend/` (root has dual @playwright installs)
- FE live tests must use host matching `NUXT_PUBLIC_API_BASE` (`100.85.193.33`)

### Smoke matrix (final)

| Suite | Result |
|---|---|
| BE medio-pago | 4/4 pass |
| BE contrato-valor-jornada | 2/2 pass |
| BE asistencia-dia | 3/3 pass |
| BE nomina-calc-asistencia | 3/3 pass |
| BE medio-pago-edge | 6/6 pass |
| BE asistencia-edge | 6/6 pass |
| BE nomina-calc-edge | 4/4 pass |
| FE registrar-hoy (IP) | 1/1 pass |
| FE registrar-dialog-enrichment | 2/2 pass |
| FE nav-gating (Asistencia) | 5/5 pass |
| FE empleados medio-pago | 2/2 pass |
| **Total** | **38 pass / 0 fail** |

### FE localhost note
First FE run with localhost failed registrar-hoy (login page) — **TEST-ENV** cookie host; re-run with `100.85.193.33` green. Documented in gap-report G1.

### Artifacts
- gap-report.md
- completion-report.md

### Production source
Not modified by W3 worker.
