# Handoff: qa-session-jul-31

**Date**: 2026-08-02 · **Status**: Implementation COMPLETE (local). Staging deploy = separate gated step (not done).
**Cycle**: 3 QA items (R1, R2/R2b, R3), contract-first, 2 workers, 0 integration name-mismatches.

## What shipped

| Req | Summary | Layers | Verified |
|---|---|---|---|
| R1 | Medio de pago label `Nequi` → `Nequi/Bre-B` (enum value `NEQUI` unchanged) | FE (4 pages) | 4/4 FE tests |
| R2 | Nómina Registrar dialog Valor-Mensual branch for OBRA/FIJO/INDEF (jornada hidden); OPS unchanged; aportes FIJO/INDEF only | FE (nomina/index.vue) | 5/5 FE tests |
| R2b | BE nómina suggestion surfaces `valorMensual` for non-OPS | BE — **no new code** (jul-24 R7 already did it) | 3/3 BE tests |
| R3 | Optional `eps`/`fondoPensiones`/`arl` VARCHAR(100) on Empleado | DB + BE + FE | 4/4 BE, 4/4 FE tests |

## Deliverables by worker

**worker-1 (pt-fullstack-impl)** — contract + data + backend:
- `orchestration-ctx/decisions/contract-schema-qa-jul-31.md` (SSOT)
- `backend/prisma/schema.prisma` — 3 nullable VARCHAR(100) cols on `empleados`
- `backend/prisma/migrations/20260803022244_add_empleado_eps_fondo_arl/`
- `backend/src/services/employeeService.ts`, `backend/src/routes/employees.routes.ts` (R3)
- `backend/tests/employees/empleado-eps-fondo-arl.spec.ts` (4/4), `backend/tests/nomina/nomina-sugerencia-valormensual.spec.ts` (3/3)

**worker-2 (pt-frontend-eng)** — frontend:
- `frontend/app/pages/empleados/nuevo.vue`, `[id]/editar.vue`, `[id]/index.vue`, `nomina/index.vue`
- `frontend/tests/local-qa/jul31-qa-frontend.spec.ts` (13 mocked E2E, all pass)

## Integration validation (orchestrator, independent)
- Field names consistent FE↔BE: `eps`/`fondoPensiones`/`arl` (grep-confirmed in both layers).
- `value="NEQUI"` preserved on all option selects; only label changed.
- R2 `usaValorMensual` computed drives conditional render in `nomina/index.vue`; `saveEntrada` sends `valorMensual` (null for OPS).
- Both test suites green; no cross-worker file conflicts (BE vs FE dirs).

## Run / test
```bash
# Backend (needs local BE :3101 + db :15432)
cd backend && npx playwright test \
  tests/employees/empleado-eps-fondo-arl.spec.ts \
  tests/nomina/nomina-sugerencia-valormensual.spec.ts --reporter=list
# Frontend (mocked — no live BE needed)
cd frontend && TEST_FRONTEND_URL=http://localhost:3100 \
  npx playwright test tests/local-qa/jul31-qa-frontend.spec.ts --reporter=list
```

## Known issues / deferred (NOT bugs from this wave)
- **Pre-existing FLAKE**: jul-24 `contrato-monthly` FE test ("Saving an OBRA_O_LABOR contrato sends valorMensual") times out on `contrato-valor-mensual` — verified failing on `main` via git stash. Contrato dialog ≠ nómina Registrar dialog; out of scope. Candidate for a future fix.
- **Deferred (add on request)**: R3 fields not shown in wizard step-5 summary; detail-page Seguridad Social card is read-only (edit via `/empleados/[id]/editar`).

## Next steps
1. Manual smoke in local UI if desired (frontend :3100 / backend :3101).
2. **Git commit** — user must explicitly request (working tree is multi-cycle; migrations gitignored, ship in CodeDeploy artifact).
3. **Staging release** — gated: follow `.claude/skills/planify-team/release-protocol.md` (R0 preflight → R1 backup → R4 CodeDeploy `miempresa-staging` + `migrate deploy` → R5 Amplify). New migration `20260803022244_add_empleado_eps_fondo_arl` is additive/safe.
