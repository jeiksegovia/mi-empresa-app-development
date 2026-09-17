# Team Plan addendum — Aug-17 QA feedback

Internal. Extends `team-plan-feature-centro-costos-ago-5.md`. Does not replace it.

**Decisions**: [`decisions/aug17-qa-feedback-decisions.md`](decisions/aug17-qa-feedback-decisions.md)
**Requirements**: [`../01-requirements-aug17-feedback.md`](../01-requirements-aug17-feedback.md)
**Cleaned feedback**: `context/user-feedback/qa-centro-de-costos-aug-17-cleaned.md`

---

## Historical vs this namespace

T1–T6 (ago-5 schema/API/UI) **landed on disk**. Their TaskList rows died in a namespace reset. They are **not** re-created.

Original T7/T8 (QA against the ago-5 contract) are **superseded** by D9: QA runs once, after this addendum.

This namespace’s TaskList:

| TaskList ID | Plan ID | Owner | blockedBy |
|---|---|---|---|
| 1 | T9 schema+seed+contract update | worker-4 | — |
| 2 | T10 backend API + smoke | worker-4 | 1 |
| 3 | T11 frontend + smoke | worker-5 | 1 |
| 4 | T12 QA backend | worker-6 | 2 |
| 5 | T13 QA frontend + regression | worker-6 | 3, 4 |

---

## Waves

```
T9  W4 pt-backend-eng   additive migration + seed D12 + contract update   [GATED]
     │
     ├──────────────────────────┐
     ▼                          ▼
T10 W4 (reused)  API/RBAC     T11 W5 pt-frontend-eng  UI+recibo   ← parallel
     │                          │
     ▼                          │
T12 W6 pt-test-quality  BE QA   │
     │                          │
     └──────────┬───────────────┘
                ▼
        T13 W6  FE QA + regression
```

Reuse: W4 across T9→T10 (context IS the spec). W5 fresh. W6 fresh, no source edits.

---

## File ownership

| Owner | May modify |
|---|---|
| **W4** | `schema.prisma`, new migration dir only, `empresaService.ts` (seed), `centroCostosService.ts`, `centroCostos.routes.ts`, `domainAccess.ts` only if needed (prefer route-level checks), `backend/tests/centro-costos/**`, the contract md |
| **W5** | `pages/centro-costos/**`, `useDomainAccess.ts` only if a helper is required (prefer not), `app.config.ts` only if needed, `frontend/tests/centro-costos/**` |
| **W6** | test files only + gap report. **No source.** |

Nobody touches nómina/empleado services or the original `20260805000000_centro_costos_ago5` SQL.

---

## Gates

| Gate | Where |
|---|---|
| **G4** additive migration | T9, before `migrate deploy`. Row counts + SQL in `proposed-plan.md`, wait for `APPROVED`. |
| **G5** contract freeze | end of T9. Orchestrator reads updated contract before unblocking T10/T11. |
| **G3** QA no source edits | T12/T13 |

---

## New artifacts (approved with D10–D13)

- Additive migration (fecha, precioUnitario, habilitarRecibo, pagador, beneficiarioClienteId, medioPago, enum)
- `pages/centro-costos/recibo/[itemId].vue`
- `GET /centro-costos/items/:itemId`

No new libraries.
