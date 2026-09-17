# Team Plan: qa-session-jul-31

**Pattern**: contract-first, 2 workers, 2 waves. W1 owns the shared interface (contract + schema + backend); W2 implements frontend against the published contract. Workers implement to `decisions/contract-schema-qa-jul-31.md` — NOT by reading schema.prisma directly.

## Requirements
- **R1** — label `Nequi` → `Nequi/Bre-B` (display only; enum value stays `NEQUI`).
- **R2** — nómina Registrar dialog: Valor Mensual base for FIJO/INDEF/OBRA; OPS keeps jornada.
- **R2b** — backend nómina suggestion surfaces valorMensual base for non-OPS.
- **R3** — optional `eps`/`fondoPensiones`/`arl` VARCHAR(100) on Empleado, through BE + FE.

## Locked decisions (do not re-litigate)
- D1: OBRA_O_LABOR uses Valor Mensual in nómina dialog but has **no aportes** (aportes gated to FIJO/INDEF only).
- D2: EPS/Fondo/ARL = free-text VARCHAR(100), optional, no catalog.
- D3: R1 is display-only; stored enum value `NEQUI` unchanged.
- D4: no new routes/services/tables; extend existing. Migration additive nullable.
- D5: centros de costos OUT of scope.

## Workers
| Worker | Role | Tasks | Wave |
|---|---|---|---|
| worker-1 | pt-fullstack-impl | T1 contract → T2 schema/migration → T3 R3 backend, T4 R2b backend → T5 BE tests | 1 (contract) then continues |
| worker-2 | pt-frontend-eng | T6 R1, T7 R2 dialog, T8 R3 FE → T9 FE tests | 2 (spawned after T1 published) |

## Dependency graph
```
T1 (contract) ──┬─► T2 ─► T3 ─┐
                ├─► T4 ────────┼─► T5 (BE tests)
                ├─► T6 ────────┐
                ├─► T7 ────────┼─► T9 (FE tests)
                └─► T8 ────────┘
```

## Interface contract
Authoritative: `orchestration-ctx/decisions/contract-schema-qa-jul-31.md` (W1 publishes at T1). All field names, the nómina interface matrix, and the R1 label mapping live there.

## Boundaries
- worker-1: `backend/**`, `backend/prisma/**`, contract doc. NOT frontend.
- worker-2: `frontend/**`. NOT backend/schema.
- Both: reports under own `tasks/W{N}-*/`.

## References
- Plan: `../qa-session-jul-31-plan.md` · Requirements: `../01-requirements-qa-session-jul-31.md`
- Template contract: `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`
- Cleaned feedback: `context/user-feedback/qa-session-jul-31-cleaned.md`
