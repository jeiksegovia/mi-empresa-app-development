# Team Plan: fixes-features-aug-6

**Pattern**: contract-first, 3 workers. W1 owns shared interface (contract + enum + templates); W2 backend + W3 frontend implement to the published contract (do NOT read schema/service directly for facts — the contract is authoritative).

## Locked decisions
- D1 PROFESORES+AUXILIARES = 2 TipoEmpleado enum values, identical DOMAIN_ACCESS.
- D2 fill-gating reuses existing `Instrumento.rolesPermitidos` (NO new column) — fix ADMIN bypass + token match + create default.
- D3 notes privacy = RBAC filter by autor for new roles + block PUT/DELETE; admin+geronto see all.
- D4 both instruments informational; applied via instruments:upgrade.
- D5 pacientes access for new roles = new `read-only` matrix value.
- D6 GERONTOLOGA certificados false→true.

## Workers & tasks
| Worker | Role | Tasks |
|---|---|---|
| worker-1 | pt-data-schema | T1 contract → T2 enum migration, T3 2 templates |
| worker-2 | pt-backend-eng | T4 matrix+read-only+certificados, T5 rolesPermitidos+geronto bug, T6 notes privacy → T7 BE tests |
| worker-3 | pt-frontend-eng | T8 useDomainAccess mirror, T9 instrument+notes UI → T10 FE tests |

## Dependency graph
```
T1 (contract) ─┬─► T2, T3 ───────────────┐
               ├─► T4, T5, T6 ───────────►T7 (BE tests)
               └─► T8, T9 ───────────────►T10 (FE tests)
```

## Boundaries
- worker-1: schema.prisma, prisma/migrations, prisma/instrument-templates, contract doc.
- worker-2: backend/src/** (middleware/domainAccess, services/instrumentService, routes/{instruments,patients}), backend/tests/**. NOT frontend.
- worker-3: frontend/**. NOT backend/schema.

## Interface contract
Authoritative: `orchestration-ctx/decisions/contract-fixes-features-aug-6.md` (W1 publishes at T1).

## References
Plan `../fixes-features-aug-6-plan.md` · intake `../00-intake-fixes-features-aug-6.md` · PDFs `context/instrumentos-raw/`.
