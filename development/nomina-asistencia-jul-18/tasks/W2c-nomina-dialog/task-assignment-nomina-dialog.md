# task-assignment-nomina-dialog

## Your Role
You are **frontend-eng**. Enrich the nómina **Registrar** dialog only. Spanish UI, match existing PrimeVue Dialog patterns in the same file.

## Project Context
Slug: `nomina-asistencia-jul-18`
CWD: project root `/Users/jeik/ws/mi-empresa-app-development`
You own **Task 10 only**. Do not touch asistencia page or empleado create forms.

## AUTHORITATIVE CONTRACT
`development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`
Types: `NominaSugerido`, `AsistenciaMesSummary`, `NominaCalcFields`, medio fields on empleado — in `frontend/shared/types/api.ts`.

## Task Type
IMPLEMENTATION

## Source Files to Modify
- `frontend/app/pages/nomina/index.vue` — **primary** (interfaces, openDialog, dialog form, template, save payload)
- `frontend/tests/nomina/registrar-dialog-enrichment.spec.ts` or under `frontend/tests/local-qa/` — smoke

## Do NOT touch
- `frontend/app/pages/asistencia/**`
- `frontend/app/pages/empleados/**`
- `backend/**`

## Task ID
**10** — Nómina dialog enrichment  
`TaskUpdate(taskId: "10", status: "in_progress")`

## FIRST ACTION
0. pwd project root
1. TaskUpdate 10 in_progress
2. Read full `nomina/index.vue` + contract §Nómina enrichment/calc

## Requirements
1. Extend `NominaRow` / local interfaces for:
   - empleado medio fields
   - `contratoActivo.valorJornada`
   - `asistenciaMes`, `sugerido`
   - entrada calc fields if present
2. Dialog shows (read-only info):
   - Nombre completo, documento
   - Medio de pago (Nequi number or Banco/tipo/cuenta) or warning "Sin medio de pago"
   - Tipo contrato + valor jornada (warn if null)
   - Asistencia del mes: medias + horas; link text to `/asistencia` optional
3. Editable fields (prefill from `entrada` if exists else `sugerido`):
   - mediasJornadas
   - valorJornada
   - subtotalCalculado (read-only computed client-side medias×valor when either changes, unless you prefer server-only — still show calc)
   - aportesSociales — **only if** tipoContrato is TERMINO_FIJO or TERMINO_INDEFINIDO; hide for OPS/OBRA_O_LABOR
   - totalPagado (editable override); default subtotal+aportes
   - notas (existing)
4. Save POST/PUT body includes: mediasJornadas, valorJornada, subtotalCalculado, aportesSociales, totalPagado, plus existing salario (set salario=totalPagado for dual-write client assist), notas, archivos
5. Keep existing archivo slots + cuenta-cobro error behavior **unchanged**
6. Labels Spanish: Medias jornadas, Valor media jornada, Subtotal, Aportes sociales, Total a pagar
7. data-testid: `nomina-medias`, `nomina-valor-jornada`, `nomina-aportes`, `nomina-total`, `nomina-guardar`

## Smoke
API or UI: open /nomina, open dialog for a row (or API-level assert enriched GET shape if UI hard). Prefer UI if frontend :3100 up.

## Boundaries
Only nomina page + your test + task reports under W2c-nomina-dialog.

## Reporting
- progress-report.md + completion-report.md under `development/nomina-asistencia-jul-18/tasks/W2c-nomina-dialog/`
- On done: TaskUpdate 10 completed + SendMessage main:
  `COMPLETE: W2c-nomina-dialog done. Deliverables: nomina/index.vue dialog enrichment + smoke. See tasks/W2c-nomina-dialog/completion-report.md`

Start now.
