# Team Plan: qa-session-aug-17

## Context
- `qa-session-aug-17-plan.md` — R1 tabs, R2 GET cargos, R3 bonos+total, R4 periodos, R6 actividades
- `00-intake-qa-session-aug-17.md` — decisions locked 2026-08-18
- `01-requirements-qa-session-aug-17.md` — 5 in-scope items + R6 ACL
- No research phase

## Objective
Implement the aug-17 QA cycle against the contract W1 publishes. Then (orchestrator) run tests and staging deploy.

## Implementation Location
- Source: repo root `backend/`, `frontend/`
- Orchestration: `development/qa-session-aug-17/`

## Work Streams
| ID | Stream | Worker | Role | Points | Dependencies |
|----|--------|--------|------|--------|--------------|
| T1 | Contract SSOT | W1 | data-schema | 5 | — |
| T2 | Schema + migration | W1 | data-schema | 5 | T1 |
| T3 | Local seed profesor/auxiliar | W1 | data-schema | 3 | T2 |
| T4 | R2 GET cargos exception | W2 | backend-eng | 3 | T1 |
| T5 | R3+R4 nomina BE | W2 | backend-eng | 5 | T1, T2 |
| T6 | R6 actividades BE | W2 | backend-eng | 5 | T1, T2, T3 |
| T7 | R1 empleados tabs | W3 | frontend-eng | 3 | T1 |
| T8 | R3 nomina dialog | W3 | frontend-eng | 5 | T1 |
| T9 | R6 page + nav + matrix mirror | W3 | frontend-eng | 5 | T1 |
| T10 | Staging deploy | orchestrator | devops | 5 | T4–T9 |

## Dependency Graph
```
T1 contract (W1)     → blocks T2, T4, T7, T8, T9
T2 schema (W1)       → blocks T3, T5, T6
T3 seed (W1)         → blocks T6 (own-item users)
T4 cargos (W2)       → independent after T1
T5 nomina (W2)       → after T1+T2
T6 actividades (W2)  → after T1+T2+T3
T7 tabs (W3)         → after T1
T8 nomina FE (W3)    → after T1 (may mock until T5)
T9 actividades FE    → after T1 (may mock until T6)
T10 deploy           → after T4–T9 + orchestrator verify
```

## Reuse decisions (P2)
- W1: one worker for contract → schema → seed (context IS the spec).
- W2: fresh after T1; owns all BE mutations + smoke specs.
- W3: fresh after T1; owns all FE; must not open schema.prisma.
- Deploy: orchestrator after PARK, not a fourth worker.

## Interface Contracts
Authoritative file (W1 writes, everyone else reads, **never** invent names from source):
`development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md`

Must include:
- Domain `actividades` matrix cells (4 tipos)
- Route-level exception: CONTRATOS GET `/empresa/cargos` (matrix.empresa stays false)
- `NominaPeriodo.bonos` field, `BONOS_ALLOWED`, total/subtotal formulas
- Periodos POST/PUT auth: `requireEmployeeUnlocked` not ADMIN
- `RegistroActividad` model + unique (empleadoId, fecha)
- API shapes GET/POST/PUT/DELETE `/actividades`
- Error codes: `DOMAIN_FORBIDDEN`, `EMPLOYEE_LOCKED`, `EMPLEADO_REQUIRED`, `409` duplicate day
- FE field ids / testids
- Local users: `profesor@miempresa.com`, `auxiliar@miempresa.com` / `password123` + linked Empleado
- Deviations table

## Communication Plan
- W1 COMPLETE T1 → orchestrator relays contract path to W2 and W3, then they start.
- No worker-to-worker messages.
- W3 must not wait for T5/T6 source; implement to contract; if live API missing, specs still compile.

## File ownership (P10)
- W1: `schema.prisma`, new migration dir, `seed.ts` (users only), contract md. NOT routes/services/vue.
- W2: `domainAccess.ts`, `empresa.routes.ts`, `nomina.*`, new `actividades.routes.ts` + `actividadService.ts`, `routes/index.ts`, BE tests. NOT vue/sidebar.
- W3: `empleados/index.vue`, `nomina/index.vue`, `actividades/index.vue`, `app.config.ts`, `useDomainAccess.ts`, `shared/types/api.ts`, FE tests. NOT prisma/routes.
- Shared `useDomainAccess.ts` + `domainAccess.ts`: W2 owns BE matrix cell; W3 owns FE mirror — both copy **from contract**, not from each other.

## Hard rules
- Never `git commit`. Never prod AWS. Never `migrate diff --shadow-database-url`.
- Restart local BE via `lsof -ti :3101` after route changes — not `pkill`.
- Tests: Playwright. Classify failures BUG / TEST-ENV / FLAKE.
- Implementer ships at least one smoke spec per stream.
