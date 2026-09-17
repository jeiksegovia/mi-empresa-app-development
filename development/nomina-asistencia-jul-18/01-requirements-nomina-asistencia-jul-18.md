# Requirements: nomina-asistencia-jul-18

**Status**: Approved product draft (2026-07-18). Formal requirements for feature plan.  
**Source**: `00-intake-…`, `01-feature-draft-…`, QA Jul-17 cleaned.

---

## Functional Requirements

| ID | Requirement | Acceptance Criterion | Research? |
|---|---|---|---|
| R1 | Empleado can store medio de pago de nómina | Fields: `medioPagoTipo` ∈ {NEQUI, TRANSFERENCIA_BANCARIA, null}; Nequi → número; Transfer → bancoNombre + bancoTipoCuenta (AHORRO\|CORRIENTE) + bancoNumeroCuenta. Zod enforces conditional required fields. | no |
| R2 | Medio de pago optional on create/update | POST/PUT employee succeeds with all medio fields null. | no |
| R3 | Missing medio creates pendiente | After create/update with no medio, open `PendienteEmpleado` exists with description containing `Falta medio de pago de nómina` (idempotent: no duplicates while open). | no |
| R4 | Completing medio resolves pendiente | When medio becomes valid, matching open pendiente → RESUELTO with fechaResuelto. | no |
| R5 | UI empleado crear/editar exposes medio section | Spanish section on `nuevo.vue` + `[id]/editar.vue`; data-testid hooks; optional submit works. | no |
| R6 | Contrato stores valorJornada | `Contrato.valorJornada Decimal?`; POST/PUT `/nomina/employees/:id/contratos` accept `valorJornada` number ≥ 0. | no |
| R7 | New contracts require valorJornada | Missing/null valorJornada on create → 400 field `valorJornada`. Update may set it. Legacy rows may remain null until edited. | no |
| R8 | UI contrato forms include valor jornada | Empleado edit Info Laboral + any create-contract path shows “Valor media jornada (4h)”. | no |
| R9 | Asistencia model per employee+day | Unique (empleadoId, fecha); `jornadaAm`/`jornadaPm` booleans; optional notas; registradoPor; timestamps. medias = (am?1:0)+(pm?1:0); horas = medias×4. No rate fields. | no |
| R10 | PUT batch day attendance | `PUT /asistencia/dia` body `{ fecha, items:[{empleadoId,jornadaAm,jornadaPm,notas?}] }` upserts all; returns saved rows. | no |
| R11 | GET day board | `GET /asistencia?fecha=YYYY-MM-DD` returns active employees + that day’s flags (default false if none). | no |
| R12 | GET month resumen | `GET /asistencia/resumen?periodo=YYYY-MM` returns `[{empleadoId, mediasJornadas, horas}]` sum for month. Optional `empleadoId` filter. | no |
| R13 | Asistencia RBAC | Routes use `requireDomain('empleados')` (or `asistencia` aliased equal to empleados matrix for CONTRATOS=true, GERONTOLOGA=false). ADMIN full access. | no |
| R14 | Page `/asistencia` “Registrar hoy” | Default date=today; matrix employee × AM/PM; search filter; change date reloads; Guardar calls batch PUT; reload persists. | no |
| R15 | Sidebar Asistencia | `app.config.ts` item **Asistencia** immediately after Empleados, same level; icon calendar/clock; gated like empleados for CONTRATOS. | no |
| R16 | Nómina month row enrichment | GET `/nomina?periodo=` each row includes: medio pago snapshot fields, `asistenciaMes.mediasJornadas`, `contratoActivo.valorJornada`, suggested calc when no entrada. | no |
| R17 | Nómina period create/update accepts calc fields | `mediasJornadas`, `valorJornada`, `subtotalCalculado`, `aportesSociales`, `totalPagado`; dual-write `salario = totalPagado` when total provided. | no |
| R18 | Server calc defaults | If medias omitted → sum asistencia for month; if valor omitted → active contract valorJornada; subtotal = medias×valor; total default = subtotal + aportes (0 if disallowed). | no |
| R19 | Aportes only FIJO/INDEFINIDO | If tipoContrato ∈ {OPS, OBRA_O_LABOR} and aportesSociales > 0 → 400. UI hides aportes for those types. FIJO/INDEFINIDO may set aportes ≥ 0. | no |
| R20 | Nómina dialog UX | Shows name, medio, contract type, valor, medias, editable medias/valor/total, aportes when allowed, existing file slots + cuenta-cobro rules unchanged. | no |
| R21 | Total override allowed | Client may send totalPagado ≠ subtotal+aportes; server stores without rejecting (optional notas). | no |
| R22 | Attendance independent of contract | Employees without active contract still appear on day board and can be marked. | no |
| R23 | Backend tests | Specs under `backend/tests/employees/`, `backend/tests/asistencia/`, `backend/tests/nomina/` covering R1–R4, R6–R7, R9–R12, R17–R19. | no |
| R24 | Frontend tests | Specs for medio form, `/asistencia` registrar hoy, nomina dialog enrichment; update RBAC nav tests for Asistencia visibility (CONTRATOS yes, GERONTOLOGA no). | no |
| R25 | Types shared | `frontend/shared/types/api.ts` (and backend Zod) updated for new fields/enums. | no |

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| N1 | Follow existing Prisma migration naming + Spanish DB map snake_case. |
| N2 | No `migrate diff --shadow-database-url`. |
| N3 | UI Spanish; code identifiers English. |
| N4 | Playwright API tests use admin@miempresa.com / <redacted> pattern of existing nomina specs. |
| N5 | Contract-first: schema-contract doc authoritative for workers. |
| N6 | Do not break existing nomina cuenta-cobro / tipoContrato filter tests. |
| N7 | New files kebab-case where project conventions apply. |

---

## Out of Scope (v1)

- Banco Colombia planilla / bank batch export.
- Legal social-security % auto-calculation.
- Pure hourly registration UI (hours derived only).
- Month lock after liquidación.
- Multi-empresa attendance mode switch UI.
- Changing `requireRole('ADMIN')` on contract/nomina write (keep current auth pattern unless already relaxed for CONTRATOS via domain only — do not expand admin-only matrix).

---

## Residual defaults (approved by silence)

- Dual-write `salario = totalPagado`.
- valorJornada required on **new** contracts.
- Editing attendance after nómina exists: allowed; does **not** auto-patch NominaPeriodo.
- Domain middleware: reuse `empleados` for asistencia routes (no new Domain enum value required unless cleaner — prefer **add `asistencia` domain** with same matrix as empleados for clarity + nav gating). **Decision for plan**: add domain key `asistencia` mirrored to empleados matrix (CONTRATOS true, GERONTOLOGA false) so sidebar can gate independently without coupling labels.

---

## Traceability

| User command item | Requirements |
|---|---|
| Medio pago on empleado create | R1–R5 |
| Contrato valor jornada | R6–R8 |
| Asistencia module | R9–R15, R22 |
| Nómina registrar enrichment | R16–R21 |
| Aportes only fijo/indefinido | R19 |
| Tests | R23–R24 |
