# Requirements: qa-session-aug-17

**Locked 2026-08-18** from developer confirmation. Source: `context/user-feedback/qa-session-aug-17-cleaned.md`.

## Functional Requirements

| ID | Requirement | Acceptance Criterion | Research? |
|---|---|---|---|
| R1 | Empleados list uses two tabs **Activos \| Inactivos**. Default = Activos. No "Todos". | Open `/empleados` as ADMIN or CONTRATOS → request `GET /employees?estado=ACTIVO`. Switching to Inactivos requests `estado=INACTIVO`. Inactivos are not shown on first paint. | no |
| R2 | CONTRATOS can **GET** `/empresa/cargos` (read catalog to fill contrato form). Writes stay ADMIN-only. Do **not** flip `DOMAIN_ACCESS.CONTRATOS.empresa` to `true`. | qa-contratos + unlocked empleado: `GET /empresa/cargos` → 200 + array. `POST/PATCH/DELETE /empresa/cargos` → 403. Empleado editar contrato dropdown renders cargos. | no |
| R3 | Nómina registrar for **TERMINO_FIJO** and **TERMINO_INDEFINIDO**: field order Valor mensual → **Bonos** → Subtotal → Aportes sociales → Total a pagar. `subtotal = valorMensual + bonos`. `totalPagado = valorMensual + bonos` (**aportes NOT added**). Bonos persisted on the period row. No bonos on OPS or OBRA. | Dialog shows bonos only for FIJO/INDEF. Save stores `bonos`. GET period returns `bonos` and `totalPagado === valorMensual + bonos`. Aportes stored but excluded from total. OBRA/OPS have no bonos field. | no |
| R4 | `POST/PUT /nomina/periodos` required fields depend on `tipoContrato`. FIJO/INDEF/OBRA must **not** require `valorJornada` / `mediasJornadas`. CONTRATOS may create/update periodos (drop `requireRole('ADMIN')`); lock still applies via `requireEmployeeUnlocked` on `empleadoId`. | FIJO payload without jornada fields → 201/200. OPS still requires `valorJornada` on create. qa-contratos POST unlocked → 201; locked empleado → 403 `EMPLOYEE_LOCKED`. | no |
| R5 | SIGNOS/BOLETIN v2 | **Out of scope** — already shipped. | — |
| R6 | New module **Registro de actividades** (`actividades`), nav **immediately below Asistencia**. v1 = fecha + texto. Today-only write for PROFESORES/AUXILIARES (America/Bogotá). No asistencia-consistency warning. | See R6 ACL table + API rows below. Sidebar item sits under Asistencia and is visible to ADMIN + GERONTOLOGA + CONTRATOS + PROFESORES + AUXILIARES. | no |

### R6 ACL (authoritative)

| Actor | List / get | Create | Update / delete | Date rule |
|---|---|---|---|---|
| ADMIN | all | all employees | all | any date |
| PROFESORES | **own only** | own only (`empleadoId` = self) | **forbidden** | **today only** (Bogotá) |
| AUXILIARES | own only | own only | forbidden | today only |
| GERONTOLOGA | all | forbidden | forbidden | n/a |
| CONTRATOS | all | forbidden | forbidden | n/a |

`create-only` on the domain matrix is **not enough** — own-item filter + today-only live in the service (same pattern as notes `autor` filter + asistencia today-only).

## Non-Functional Requirements
- Extend existing patterns only: `requireDomain`, `requireEmployeeUnlocked`, `serverTodayBogota`, notes autor filter, `NominaPeriodo` decimals, Playwright under `backend/tests/**` and `frontend/tests/**`.
- Mirror `DOMAIN_ACCESS` cell-by-cell in `useDomainAccess.ts`; extend `matrix-parity`.
- Migrations additive, gitignored, named `YYYYMMDDHHMMSS_*`. Never `migrate diff --shadow-database-url`.
- Tests assert new money math and new ACL; do not loosen old assertions.
- Local QA users for PROFESORES/AUXILIARES required to test R6 (seed). Staging seed is **not** this cycle unless a deploy task is added later.
- UI language Spanish; code/identifiers English.

## Out of Scope
- Pendo / design-tool tagging.
- Re-publishing SIGNOS/BOLETIN templates.
- Asistencia ↔ activity consistency warnings.
- Email-admin backfill workflow.
- Centro-costos QA.
- Committing / deploying (gated, explicit ask).
- Flipping `empresa` domain to `true` for CONTRATOS.
