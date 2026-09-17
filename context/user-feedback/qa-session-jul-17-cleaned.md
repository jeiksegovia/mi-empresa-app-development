# QA Session Jul 17 — Cleaned insights

Source: `qa-session-jul-17-raw.md` (voice transcript; filler/repetition removed).

## Core product intent

Separate **attendance tracking** from **payroll settlement**.

1. **Asistencia de empleados** (new): mark who worked which days/jornadas/hours.
2. **Nómina liquidación**: consume attendance totals + contract rates → amount to pay + payment docs.

## Rules spoken in session

1. Do **not** store pay rate on attendance — rate lives on the **employee contract**.
2. Same jornadas can pay different amounts across employees.
3. Emkasa pays by **media jornada (4 hours)**; platform should still support **hourly** companies.
4. Jornada = group of 4 hours (AM/PM medias).
5. On employee create, capture **payment method**: Nequi or bank transfer + number. Prefer optional create with **pendiente** if missing.
6. Liquidation UI needs: worked jornadas/hours for period, valor jornada, subtotal, then comprobantes/transfer.
7. Attendance UI needs: employee name, profession/cargo, calendar, counts that feed payroll.

## Explicit “build this” list (user command + transcript)

- Empleado create: medio de pago nómina.
- Contrato: valor de jornada.
- Asistencia module (calendar + registrar hoy + search + other day).
- Nómina registrar dialog: nequi/cuenta, name, medias jornadas, valor jornada, total.
- Aportes sociales only for término fijo / indefinido when registering monthly nómina.

## Out of session (not in transcript, not assumed)

- Bank batch file export / Banco de Colombia planilla automation (mentioned as future desire).
- Legal auto-calculation of social security percentages.
