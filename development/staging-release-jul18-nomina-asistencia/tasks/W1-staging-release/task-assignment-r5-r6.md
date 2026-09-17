# task-assignment — R5 Amplify + R6 canary (final)

## Role
**devops-infra**. Staging only. `disruptive` + `--region us-east-1`. NEVER prod.

## CWD
`/Users/jeik/ws/mi-empresa-app-development`

## Authorized
Developer authorized **R5 through R6** (auto-chain). Complete both phases. Report CHECKPOINT after each, then COMPLETE at end. Do not wait for further PROCEED.

## Prior state (done)
- R-pre…R4 complete
- Backend: `d-8OHAZOPOK` Succeeded, 23 mig, health 200
- QA users 5/6/7 via seed-qa
- Runbook: `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md`

## R5 — Frontend Amplify
1. Build FE from working tree (nuxt generate / project deploy script — match jul17-2)
2. Deploy to Amplify app `d1nsxjyualdzdu` branch staging
3. Verify job SUCCEED
4. curl custom domain + amplify domain → 200
5. Fill runbook R5 actuals
6. Message main: `CHECKPOINT: R5 complete. Amplify job=… SUCCEED. Domains 200.`

## R6 — Feature canary
Use custom domain + `get-qa-creds.sh` (no passwords in runbook).

### C1 qa-admin
- Login; sidebar Empleados + Asistencia + Nómina
- `/asistencia` load; optional toggle/save if feasible
- Medio pago section visible on empleado forms if quick

### C2 qa-contratos
- Sees empleados/asistencia/nomina
- Asistencia usable; instrumentos hidden/gated

### C3 qa-gerontologa
- Asistencia hidden; direct `/asistencia` blocked
- API GET asistencia → 403 if testable

### C4 regression
- Instruments still load for gerontologa/admin

Fill R6 actuals + completion-report.md.

Message main:
`COMPLETE: W1-staging-release done. R5+R6 complete. See runbook actuals + completion-report.md`

## Hard rules
No prod. No auto-rollback. No passwords in docs. No pkill node.

Start R5 NOW, then R6.
