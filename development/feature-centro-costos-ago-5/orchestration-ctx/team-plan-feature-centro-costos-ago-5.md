# Team Plan — feature-centro-costos-ago-5

**Internal orchestration document.** Workers read FROM it; workers never re-create or extend it.
Feature plan: [`../feature-centro-costos-ago-5-plan.md`](../feature-centro-costos-ago-5-plan.md)

---

## Strategy

Contract-first (P1). W1 owns the shared interface end-to-end (schema → contract → API) so the
contract has **one author**. W2 builds the UI against the contract alone and never opens backend
source. W3 arrives fresh, with no implementer context, and tests the contract rather than the
implementation (P5).

Reuse decisions pre-committed at planning time (P2):

| Worker | Wave(s) | Reuse? | Rationale |
|---|---|---|---|
| W1 `pt-backend-eng` | 1 + 2 | **REUSE** across T1→T4 | Each task consumes what the previous produced; its context IS the spec. Role chosen as `backend-eng` (not `data-schema`) precisely so the API wave passes the role gate without a respawn. |
| W2 `pt-frontend-eng` | 2 | FRESH | Different layer; must not be anchored by backend internals — it is required to read only the contract. |
| W3 `pt-test-quality` | 3 | FRESH | Verification role. A QA worker carrying implementer context writes tests that mirror the implementation. |

---

## Dependency graph

```
T1 schema+migration+seed  (W1, GATED: PLAN-APPROVAL before the drop)
     │
     ▼
T2 contract doc           (W1)  ◄── the SSOT everything downstream reads
     │
     ├──────────────────────────────┐
     ▼                              ▼
T3 service+routes+RBAC    (W1)    T5 FE page+mirror+nav   (W2)   ← parallel
     │                              │
     ▼                              ▼
T4 BE smoke spec          (W1)    T6 FE smoke spec        (W2)
     │                              │
     ▼                              │
T7 QA backend+RBAC+parity (W3)      │
     │                              │
     └──────────────┬───────────────┘
                    ▼
        T8 QA frontend + regression sweep + gap report (W3)
```

| Task | Owner | Points | blockedBy |
|---|---|---|---|
| 1 — schema/migration/seed | worker-1 | 5 | — |
| 2 — contract doc | worker-1 | 2 | 1 |
| 3 — service/routes/RBAC | worker-1 | 5 | 2 |
| 4 — BE smoke spec | worker-1 | 2 | 3 |
| 5 — FE page/mirror/nav | worker-2 | 6 | 2 |
| 6 — FE smoke spec | worker-2 | 2 | 5 |
| 7 — QA backend + parity | worker-3 | 6 | 4 |
| 8 — QA frontend + regression | worker-3 | 4 | 6, 7 |

**Load**: W1 = 14 pts across 4 sequential tasks · W2 = 8 · W3 = 10. W1 exceeds the 13-pt guidance by
one point; accepted deliberately because splitting T1/T2 from T3/T4 across two workers would hand the
contract to a second author — the exact failure mode P1 exists to prevent. Mitigation: `/compact`
note in the W1 assignment before T3.

---

## File ownership (P10 — strict, disjoint)

| Owner | May modify |
|---|---|
| **W1** | `backend/prisma/schema.prisma`, `backend/prisma/migrations/**`, `backend/src/services/centroCostosService.ts`, `backend/src/routes/centroCostos.routes.ts`, `backend/src/routes/index.ts`, `backend/src/middleware/domainAccess.ts`, `backend/src/services/empresaService.ts` (seed constant only), `backend/tests/centro-costos/**` |
| **W2** | `frontend/app/pages/centro-costos/**`, `frontend/app/composables/useDomainAccess.ts`, `frontend/app/app.config.ts`, `frontend/tests/centro-costos/**` |
| **W3** | `backend/tests/centro-costos/**` (adds files; must not weaken W1's spec), `frontend/tests/centro-costos/**`, gap report. **No source edits at all.** |

Cross-cutting: nobody but W1 touches backend source; nobody but W2 touches frontend source.
**No worker touches** anything under `backend/src/services/nominaService.ts`,
`asistenciaService.ts`, `employeeService.ts`, or any nómina/empleado model — hard non-goal.

---

## Interface contracts (defined upfront)

The contract document `orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` is
authoritative from T2 onward. Until it exists, the API surface table and Prisma models in the feature
plan §Technical Approach stand in. Downstream workers are told: *the contract is authoritative — do
not open `schema.prisma` or the service to answer a question; ask the orchestrator instead.*

---

## Gates

| Gate | Where | Condition |
|---|---|---|
| **G1 — destructive migration** | T1, before any SQL | W1 posts real row counts for the 4 finance tables + the exact migration SQL, sends `PLAN-APPROVAL:`, and WAITS. Orchestrator approves in writing → `decisions/`. |
| **G2 — contract freeze** | end of T2 | Orchestrator reads the contract before unblocking T3/T5. A contract change after this point is a `TURNING-POINT-BREAKING`. |
| **G3 — no source edits by QA** | T7/T8 | Orchestrator verifies `git status` shows no W3 changes outside test dirs. |

---

## Watch items (P7 — cross-worker signal routing)

| # | Raised by | To verify at | What |
|---|---|---|---|
| WI-1 | orchestrator (K4) | T5 completion | Prisma serializes `Decimal` as **string** over JSON. FE interfaces must accept `number \| string` (as `nomina/index.vue` already does) and the balance card must not do string concatenation. |
| WI-2 | orchestrator (K5) | T4 + T7 | `/items/:itemId` must be registered BEFORE `/:id` so it is not shadowed. A spec asserts `PUT /centro-costos/items/{id}` hits the item handler. |
| WI-3 | orchestrator (K6) | T7 | `periodo` normalization must be pure string math (`YYYY-MM` → `YYYY-MM-01`), never `new Date()` local parsing. Assert a month-boundary case (e.g. `2026-08-31`). |
| WI-4 | orchestrator (K2) | T1 | `Cliente.prefacturas` at `schema.prisma:593` must be removed or `prisma validate` fails. |
| WI-5 | memory | T5/T6 | `v-model` on a `const reactive()` object drops child emits — use `:model-value` + `Object.assign`; UI specs must drive DatePickers and fill optional fields. |

---

## Locked decisions (workers must NOT re-litigate)

| ID | Decision |
|---|---|
| D1 | Drop the unused finance tables; replace with the new schema. Never touch nómina/empleado tables. |
| D2 | Scope = schema + API + minimal CRUD UI. No reporting module, no export, no month-over-month. |
| D3 | Nómina is a manual EGRESOS centro. Centro-costos and nómina stay independent modules. |
| D4 | RBAC = ADMIN + CONTRATOS via the existing `DOMAIN_ACCESS` matrix; GERONTOLOGA denied. |
| D5 | `cantidad` is a positive **Int**, default 1. Not Decimal. |
| D6 | `valorTotal` is persisted and server-computed; a client-sent value is ignored. |
| D7 | `periodo` is a DATE normalized to day 1 of the month. No `(anio, mes)` columns. |
| D8 | Centro delete is `Restrict` (409 when it has ítems); retire via `activo=false`. |

---

## Escalation

`TURNING-POINT-BREAKING` → orchestrator decides, writes `decisions/{name}.md`.
`TURNING-POINT-STRATEGY` → max 2 per task, then escalate to the developer.
Max 2 revision cycles per task, each citing a specific failed acceptance criterion.
