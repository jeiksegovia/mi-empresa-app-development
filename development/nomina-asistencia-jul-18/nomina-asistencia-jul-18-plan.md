# Feature Plan: nomina-asistencia-jul-18

## Objective

Ship QA Jul-17 payroll/attendance feedback: medio de pago on empleados, valor de jornada on contratos, new **Asistencia** module (AM/PM medias), and nómina liquidación dialog driven by attendance × rate with optional aportes for FIJO/INDEFINIDO.

## Assumptions & Constraints

- Product draft approved 2026-07-18 (`01-feature-draft-nomina-asistencia-jul-18.md`).
- Residual defaults: dual-write `salario=totalPagado`; valorJornada required on new contracts; no auto-sync NominaPeriodo when attendance later changes.
- Large uncommitted tree already exists — **do not commit** unless user asks.
- Keep existing ADMIN `requireRole` on contract/nomina writes; add domain middleware as today.
- Local: backend :3101, frontend :3100, db :15432. Never kill prod bun on 4142.
- Orchestration: contract-first; max 2–3 workers; FRESH workers preferred per prior session convention unless plan says REUSE.

## Existing Patterns Used

| Pattern | Exemplar | How this feature extends it |
|---|---|---|
| Prisma models + snake map | `backend/prisma/schema.prisma` Empleado/Contrato/NominaPeriodo | Add columns + new `AsistenciaEmpleado` + enums |
| Migration timestamp folders | `20260717120000_jul17_tipo_empleado_contratos` | New `20260718…_nomina_asistencia` |
| Service + routes + Zod | `employeeService.ts`, `nominaService.ts`, `*.routes.ts` | Extend + new `asistenciaService` / `asistencia.routes` |
| Domain RBAC matrix | `domainAccess.ts` + `useDomainAccess.ts` | Add domain `asistencia` (same matrix as empleados) |
| Pendientes | `createPendiente` / list derived | Auto open/resolve medio-pago pendiente |
| Nomina month table + Dialog | `frontend/app/pages/nomina/index.vue` | Enrich dialog + GET payload |
| Employee forms | `empleados/nuevo.vue`, `[id]/editar.vue` | Medio section + contrato valor |
| Sidebar | `frontend/app/app.config.ts` | Insert Asistencia after Empleados |
| API types | `frontend/shared/types/api.ts` | New fields/enums |
| Playwright API serial specs | `backend/tests/nomina/cuenta-cobro-required.spec.ts` | Same login/cookie + future period pattern |
| Frontend e2e | `frontend/tests/e2e/empleado-*.spec.ts`, `tests/rbac/*` | New asistencia + form + nav |
| Route mount | `backend/src/routes/index.ts` | `router.use('/asistencia', …)` |

## Requirements

R1–R25 from `01-requirements-nomina-asistencia-jul-18.md` (medio pago, valorJornada, asistencia CRUD/board/resumen, nómina calc, tests, RBAC nav).

## Technical Approach

### 1. Schema (single migration)

```prisma
enum MedioPagoNomina { NEQUI  TRANSFERENCIA_BANCARIA }
enum TipoCuentaBanco { AHORRO  CORRIENTE }

// Empleado +
medioPagoTipo     MedioPagoNomina?
medioPagoNequi    String?  @map("medio_pago_nequi") @db.VarChar(50)
bancoNombre       String?  @map("banco_nombre") @db.VarChar(100)
bancoTipoCuenta   TipoCuentaBanco? @map("banco_tipo_cuenta")
bancoNumeroCuenta String?  @map("banco_numero_cuenta") @db.VarChar(50)

// Contrato +
valorJornada      Decimal? @map("valor_jornada") @db.Decimal(12, 2)

// NominaPeriodo +
mediasJornadas    Decimal? @map("medias_jornadas") @db.Decimal(8, 2)
valorJornada      Decimal? @map("valor_jornada") @db.Decimal(12, 2)
subtotalCalculado Decimal? @map("subtotal_calculado") @db.Decimal(12, 2)
aportesSociales   Decimal? @map("aportes_sociales") @db.Decimal(12, 2)
totalPagado       Decimal? @map("total_pagado") @db.Decimal(12, 2)
// salario remains; dual-write totalPagado → salario

model AsistenciaEmpleado {
  id            Int      @id @default(autoincrement()) @map("asistencia_id")
  empleadoId    Int      @map("empleado_id")
  fecha         DateTime @db.Date
  jornadaAm     Boolean  @default(false) @map("jornada_am")
  jornadaPm     Boolean  @default(false) @map("jornada_pm")
  notas         String?  @db.VarChar(500)
  registradoPor Int      @map("registrado_por")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  empleado      Empleado @relation(...)
  registrador   Usuario  @relation(...)
  @@unique([empleadoId, fecha])
  @@index([fecha])
  @@map("asistencia_empleados")
}
```

### 2. API contracts (summary — full doc in wave-1 decision file)

**Employees** — extend create/update/detail with medio fields; service `syncMedioPagoPendiente(empleadoId, userId)`.

**Contratos** — `valorJornada` on create required (`z.number().nonnegative()`); update same when provided.

**Asistencia**
- `GET /api/v1/asistencia?fecha=YYYY-MM-DD`
- `PUT /api/v1/asistencia/dia` `{ fecha, items: [...] }`
- `GET /api/v1/asistencia/resumen?periodo=YYYY-MM&empleadoId?`
- `requireDomain('asistencia')`

**Nómina**
- Month list enrichment object per row.
- Period body + response fields for calc; server fills defaults; aportes rule; `salario = totalPagado ?? salario`.

### 3. Frontend

| Surface | Work |
|---|---|
| `app.config.ts` | Asistencia after Empleados |
| `useDomainAccess.ts` + backend matrix | domain `asistencia` |
| `empleados/nuevo.vue`, `[id]/editar.vue` | Medio section |
| Contrato dialogs in editar | valorJornada input |
| `pages/asistencia/index.vue` | NEW day matrix |
| `nomina/index.vue` | Dialog redesign + types |
| `shared/types/api.ts` | Types |

### 4. Pendiente text constant

```ts
export const PENDIENTE_MEDIO_PAGO = 'Falta medio de pago de nómina'
```

Match open pendientes with `descripcion` equals or startsWith this string.

### 5. Testing strategy

Implementers ship smoke specs; final QA wave deepens against contract.

## Risk & Unknowns

| Risk | Mitigation |
|---|---|
| Legacy contracts without valorJornada break payroll UX | Allow null; dialog warns; total override still works |
| Dual-write salario confusion | Document in contract; UI label “Total a pagar”; keep salario column populated |
| RBAC nav tests hardcode item counts | Update `tests/rbac/*` in same FE wave |
| Unique (empleado, periodo) collisions in tests | Use far-future periods like existing `2099-07` |
| Worker file conflicts on `schema.prisma` / `domainAccess` / `api.ts` | Wave 1 owns schema+domain+types contract; later waves only extend assigned files |
| CONTRATOS can see UI but ADMIN-only writes on nomina/contratos | **Do not change** admin write gates in v1 (existing product); document as known constraint |

## Implementation Scope

**In**
- Schema migration + services/routes/UI/tests listed above.
- Contract decision document.

**Out**
- Bank export, legal aportes %, hourly mode UI, month lock, relaxing ADMIN write role.

## New Artifacts Proposed

| Artifact | Why | Alternatives |
|---|---|---|
| `backend/src/services/asistenciaService.ts` | Clean module boundary | Fold into employeeService (rejected — different lifecycle) |
| `backend/src/routes/asistencia.routes.ts` | Mount at `/asistencia` | Nested under `/employees/:id/asistencia` only (rejected — day board is cross-employee) |
| `frontend/app/pages/asistencia/index.vue` | New module page | Tab under empleados (rejected — user asked same-level nav) |
| Domain key `asistencia` | Independent sidebar gating | Reuse `empleados` only (acceptable alt; prefer explicit domain) |
| Migration folder | Required for columns/table | — |
| `orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md` | Contract-first | — |

**N new artifact families requiring approval: 5** (service, routes, page, domain key, migration+contract).

## Open Items

- None blocking. Optional later: month-lock, hour-mode UI, relax ADMIN writes for CONTRATOS.

## References

- `00-intake-nomina-asistencia-jul-18.md`
- `01-feature-draft-nomina-asistencia-jul-18.md` (approved)
- `01-requirements-nomina-asistencia-jul-18.md`
- `context/user-feedback/qa-session-jul-17-cleaned.md`
- `context/resume-session/summary-2026-07-17.md`
- Exemplars: `nominaService.ts`, `nomina/index.vue`, `domainAccess.ts`, `cuenta-cobro-required.spec.ts`

## Suggested execution waves (for Phase 1 team plan after this approval)

| Wave | Role | Points | Deliverables |
|---|---|---|---|
| W1 | pt-backend-eng (contract+schema+API) | 8 | migration, contract doc, employee/contrato/asistencia/nomina API + smoke API tests |
| W2 | pt-frontend-eng | 8 | medio UI, valorJornada UI, /asistencia page, sidebar, domain mirror, nomina dialog |
| W3 | pt-test-quality (FRESH) | 5 | deepen tests vs contract; RBAC nav; gap report |

W2 blockedBy W1. W3 blockedBy W2.  
Max workers: 2 concurrent (W1 then W2∥ partial only after contract; recommend sequential W1→W2→W3 for shared types stability).

---

## Developer confirmation gate

**5 new artifact families proposed — approval required** before Phase 1 team-plan / spawn.

Options:
1. **Approve** → orchestrator writes `team-plan` + TaskList + presents execution plan for final go.
2. **Request improvements** → revise this plan.
3. **Cancel**.
