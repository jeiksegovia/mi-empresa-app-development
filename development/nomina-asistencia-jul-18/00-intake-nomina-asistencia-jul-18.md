# Intake: nomina-asistencia-jul-18

## Objective

Address QA Jul-17 feedback for **empleados / nómina / asistencia**, then implement:

1. **Medio de pago de nómina** on empleado create/edit (Nequi / transferencia bancaria + account or Nequi number).
2. **Contrato: valor de jornada** (and use it in nómina calculation).
3. **Asistencia de empleados** module (calendar + “registrar hoy” + per-day media jornada / hours).
4. **Nómina registrar flow redesign**: pull employee info, contract, attendance count for month × rate → total; optional aportes sociales when contract type allows.

## Input Source

- `context/user-feedback/qa-session-jul-17-raw.md` (voice transcript, Spanish)
- `context/resume-session/summary-2026-07-17.md` (current system state)
- Existing domain: `Empleado`, `Contrato`, `NominaPeriodo`, pages `empleados/*`, `nomina/index.vue`

## Cleaned transcript insights (deduped / de-noised)

| Theme | Insight |
|---|---|
| Separation of concerns | **Asistencia** records presence only (days/jornadas/hours). **Nómina liquidación** multiplies attendance × rate from contract and handles payment docs. |
| Rate ownership | Rate is **on the contract**, not on attendance. Two employees can work the same jornadas and be paid differently. |
| Jornada definition | Emkasa pays by **media jornada = 4h block** (AM/PM). Platform should support **hours OR jornadas** (restaurants pay by hour). |
| Attendance UI needs | Name, profession/cargo, calendar to mark days present/absent; counts feed payroll. |
| Payment method | On empleado create: **Nequi** or **transferencia bancaria** + number. Optional to allow create, but show as **pendiente** if missing. |
| Liquidación inputs | When liquidating: jornadas/hours worked that period (from attendance), valor jornada/hour (from contract), subtotal, then upload comprobantes / transfer proof. |
| Aportes sociales | Only certain contract types (user: **fijo e indefinido**) add aportes in the monthly registro. OPS/obra labor follow existing cuenta-de-cobro path. |

## Mandatory scope (from user command)

| # | Item | Touches |
|---|---|---|
| M1 | Empleado create: medio de pago nómina (Nequi / transferencia + número) | schema Empleado, employees API, `empleados/nuevo.vue` + edit |
| M2 | Contrato: valor de jornada | schema Contrato, employees/contratos API, crear/editar empleado |
| M3 | Asistencia module (calendar, registrar hoy, search, other day) | NEW page + API + schema |
| M4 | Nómina registrar: show name, nequi/cuenta, medias jornadas count, valor por jornada, total calc | `nomina/index.vue` dialog + NominaPeriodo fields |
| M5 | Nómina: amount of media jornadas in registro | NominaPeriodo + UI |
| M6 | Aportes only for TERMINO_FIJO / TERMINO_INDEFINIDO | business rule in createNominaPeriodo + UI |
| M7 | Unit/Playwright tests confirming fixes | backend/tests + frontend/tests |

## Current system gaps (as-is)

- `Empleado`: no payment-method fields.
- `Contrato`: has `tipoContrato`, dates, cargo, files — **no valorJornada / valorHora**.
- `NominaPeriodo`: `salario` free-entry + archivos — **no attendance-driven calc**, no `cantidadMediasJornadas`, no aportes amount field, no snapshot of payment method.
- No asistencia models/routes/pages.
- Pendientes exist (`PendienteEmpleado`) — can host “falta medio de pago” alerts.
- RBAC: CONTRATOS profile owns empleados/nómina — asistencia should follow same domain.

## Assumptions (pending confirmation)

- A1: Media jornada = exactly 4 hours; 1 full day Emkasa default = 1 or 2 medias (AM/PM) — **needs product answer**.
- A2: Payment method lives on **Empleado** (not per contract).
- A3: `valorJornada` on active **Contrato**; optional `valorHora` for hour-mode companies.
- A4: Attendance mode default for Emkasa seed/company = **jornada**; platform supports both modes per empresa or per registration.
- A5: Aportes = user-entered money amount + optional existing `COMPROBANTE_APORTES` file; not auto-calculated legal %.
- A6: Month boundary = calendar month matching current `NominaPeriodo.periodo` (YYYY-MM-01).

## Open Questions

Tagged for user confirmation before feature draft:

1. **[confirm-with-user]** Attendance unit UX: register **medias jornadas AM/PM checkboxes per day**, free **count of medias**, or pure **hours** with jornada=4h conversion?
2. **[confirm-with-user]** One attendance row = employee+day with `mediasJornadas` (0–2?) and/or `horas`?
3. **[confirm-with-user]** Can user **override** calculated total on liquidación, or is total always `jornadas × valorJornada (+ aportes)`?
4. **[confirm-with-user]** Payment method required vs optional+pendiente (transcript says optional + pendiente alert).
5. **[confirm-with-user]** Nequi fields: only number, or also bank name for transferencia (banco, tipo cuenta ahorro/corriente, número)?
6. **[confirm-with-user]** Aportes: only FIJO+INDEFINIDO; confirm OPS/OBRA_O_LABOR never show aportes field (keep cuenta cobro rules).
7. **[confirm-with-user]** Asistencia nav placement: under Empleados, under Nómina, or top-level sidebar item?
8. **[confirm-with-user]** Who can register asistencia? Same as nómina (CONTRATOS + ADMIN)?
9. **[confirm-with-user]** Historical edit: can past days be edited freely? Month lock after nómina liquidated?
10. **[confirm-with-user]** Existing `Nomina.salario` free field: replace with computed breakdown or keep as override?

## Known Constraints

- Do not auto-commit; large uncommitted tree already present.
- Orchestrator does not implement; workers implement after draft approval + plan approval.
- Contract-first for multi-layer work.
- Tests mandatory (Playwright backend + frontend).
- Local: backend :3101, frontend :3100, db :15432.
- UI language Spanish; code English.
- Filename casing: kebab-case for new plan/task files.

## Next gate

1. User answers open questions.
2. Orchestrator publishes **feature draft** (flows + screens + data model sketch) for approval.
3. Only after draft approval → requirements + feature plan + orchestration + implementation.
