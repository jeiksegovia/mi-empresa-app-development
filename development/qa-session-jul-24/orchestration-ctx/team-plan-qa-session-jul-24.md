# Team Plan: qa-session-jul-24

Feature plan: `../qa-session-jul-24-plan.md`. Requirements: `context/user-feedback/qa-session-jul-24-cleaned.md`.

## Waves
- **Wave 1**: W1 (pt-data-schema) — schema/enum/field changes + cargos delete+recreate migration
  + DEFAULT_CARGOS update + **contract doc** (`orchestration-ctx/decisions/contract-schema-qa-jul-24.md`).
- **Wave 2** (parallel, both blockedBy W1): W2 (pt-backend-eng, backend/**) and W3 (pt-frontend-eng, frontend/**).

## Tasks
| ID | Owner | Title | blockedBy |
|----|-------|-------|-----------|
| 1 | worker-1 | Schema + cargos migration + contract doc | — |
| 2 | worker-2 | Employee partial-edit fix + CONTRATOS RBAC + Nequi validation | 1 |
| 3 | worker-2 | Asistencia RBAC by role/date + note | 2 |
| 4 | worker-2 | Contract valorMensual validation + nómina branch | 3 |
| 5 | worker-3 | Payment UI (efectivo/llave) + remove cargos block + pago preview | 1 |
| 6 | worker-3 | Contract monthly field + asistencia UI date-lock + note | 5 |

## Interface Contract (authoritative source = W1's contract doc)
W1 publishes `orchestration-ctx/decisions/contract-schema-qa-jul-24.md`. W2/W3 read it and
NEVER open `schema.prisma`. Contract must define: enum `MedioPagoNomina` (NEQUI,
TRANSFERENCIA_BANCARIA, EFECTIVO); `Contrato.valorMensual` field; per-tipoContrato salary
rule (OPS=valorJornada, others=valorMensual); asistencia RBAC (CONTRATOS today-only
America/Bogota, ADMIN any date); Nequi llave = alphanumeric/email; target cargo list.

## Boundaries
- W1: `backend/prisma/**`, `backend/src/services/empresaService.ts`, decisions doc.
- W2: `backend/src/**` (routes/services/middleware), `backend/tests/**`. NOT frontend, NOT schema.prisma.
- W3: `frontend/app/**`, `frontend/tests/**`. NOT backend.

## Env
Local: backend :3101, frontend :3100, db :15432. Never touch port 4142 / prod. Staging deploy = gated later.
