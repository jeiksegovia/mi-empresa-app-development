# task-assignment-jul4-improvements

## Plan File
`/Users/jeik/ws/mi-empresa-app-development/development/jul4-improvements/orchestration-ctx/team-plan-jul4-improvements.md`
— contains the FULL per-phase approach with code examples, migration SQL, endpoint shapes, and file:line references. Read it in full before writing any code. This assignment only summarizes.

## Task Type
IMPLEMENTATION

## Your Task
Implement phases P0→P7 of the July-4 milestone: genero-OTRO input (pacientes), empresa certificados recurrentes (periodicidad + comprobante + missing-month alert + DRIFT-1 fix), archivo on empleado certs, hoja de vida upload, Pendientes section, Novedades module, Nómina foundation (Contrato + NominaPeriodo + /nomina page), full local regression. Sequential, one phase at a time, each gated by a green Playwright spec in `frontend/tests/local-qa/`.

## Implementation Location
- Backend: `/Users/jeik/ws/mi-empresa-app-development/backend/`
- Frontend: `/Users/jeik/ws/mi-empresa-app-development/frontend/`

## Source Files to Modify
**Backend**: `prisma/schema.prisma` (+6 additive migrations: `jul4_cert_empresa_recurrencia`, `jul4_cert_empleado_archivo`, `jul4_hoja_vida`, `jul4_pendientes`, `jul4_novedades`, `jul4_nomina_foundation`) · `src/routes/certificates.routes.ts` · `src/routes/employees.routes.ts` · `src/routes/index.ts` · `src/services/certificateService.ts` · `src/services/employeeService.ts` · NEW `src/routes/nomina.routes.ts` + `src/services/nominaService.ts`
**Frontend**: `app/pages/pacientes/crear.vue` + `app/pages/pacientes/[id]/editar.vue` (P0) · `app/pages/certificados/crear.vue` + `index.vue` + `[id].vue` (P1) · `app/components/EmpleadoCertificadosEditor.vue` (P2) · `app/pages/empleados/[id]/editar.vue` + `index.vue` (P3–P6) · NEW `app/pages/nomina/index.vue` + `app/app.config.ts` (P6)
**Specs**: extend `tests/local-qa/p5-clientes-selects.spec.ts` (P0) · NEW `tests/local-qa/jul4-p1-cert-recurrente.spec.ts`, `jul4-p2-cert-empleado-archivo.spec.ts`, `jul4-p3-hoja-vida.spec.ts`, `jul4-p4-pendientes.spec.ts`, `jul4-p5-novedades.spec.ts`, `jul4-p6-nomina.spec.ts`
**Docs**: `context/plan-implemented/jul-4-improvements-plan-implemented.md` (P7)

## Worker Self-Check
- Task type IMPLEMENTATION + Source Files list non-empty → proceed
- Do NOT create a plan document — implement from the Plan File above

## Recommended Approach
Follow the plan file phase by phase — it contains verbatim-ready snippets. Summary:
0. **Read first**: plan file → `context/implementation-plan/jul-4-improvements-plan.md` → `context/implementation-plan/jul-4-improvements-db-schema.md` (**§2.3 = Prisma models to copy verbatim, §2.4 = migration DDL sequence**) → the Key Files listed in the plan.
1. **Verify stack**: `curl -s http://localhost:3101/api/v1/health` and `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100`. Restart instructions in plan Constraints (PID-targeted only).
2. **P0**: clone the parentesco Select+OTRO pattern (pacientes/crear.vue:32-45, 98-101) for genero in crear + editar; `maxlength="20"`; backend untouched (Zod already free-text at patients.routes.ts:20). Gate: extended p5 spec green.
3. **P1**: migration `jul4_cert_empresa_recurrencia` (SQL in plan — includes `tipo_certificado SET NOT NULL` DRIFT-1 fix); extend Zod + service (`duplicateFromId`, `getMissingMonthlyAlerts` into `/stats`); crear.vue periodicidad+month picker+comprobante upload; index.vue alert banner + "Duplicar para este mes"; [id].vue new fields. Gate: jul4-p1 spec.
4. **P2**: migration `jul4_cert_empleado_archivo`; PUT certificados row shape +archivoUrl; per-row upload inside EmpleadoCertificadosEditor.vue (self-contained — both pages inherit). Gate: jul4-p2 spec incl. parity assert.
5. **P3**: migration `jul4_hoja_vida`; Zod+service; upload card in editar Info Laboral tab; link in detail tab 2. Gate: jul4-p3 spec.
6. **P4**: migration `jul4_pendientes` (model verbatim db-schema §2.3); GET (manuales+derivados)/POST/PATCH/DELETE under /employees/:id/pendientes; derived rules in plan (cert vencido/por-vencer, hoja de vida faltante, contrato guard pre-P6-safe); new detail tab index 3 with badge. Gate: jul4-p4 spec.
7. **P5**: migration `jul4_novedades`; CRUD under /employees/:id/novedades with nested archivos replace; detail tab index 4 — timeline + dialog with multi-file. Gate: jul4-p5 spec.
8. **P6**: migration `jul4_nomina_foundation` + raw partial index `contratos_empleado_activo_uq`; new nomina.routes/nominaService (rules: single activo via transaction, fechaFin vs TERMINO_INDEFINIDO, snapshot contratoId+tipoContrato, P2002→409); Contrato card in editar Info Laboral; NEW /nomina page (month view, typed upload slots by tipo); enable sidebar item. Gate: jul4-p6 spec.
9. **P7**: full `tests/local-qa/` run + existing e2e; fix regressions (≤2 attempts each); write plan-implemented doc. Gate: ALL green.

## Key Files / Resources to Read First
1. Plan file (above) — full approach + code examples
2. `context/implementation-plan/jul-4-improvements-db-schema.md` — §2.3, §2.4
3. `context/implementation-plan/jul-4-improvements-plan.md` — feature context + acceptance criteria
4. Pattern files: `certificates.routes.ts`, `employees.routes.ts`, `EmpleadoCertificadosEditor.vue`, `certificados/crear.vue` (upload :72-107), `pacientes/crear.vue` (OTRO pattern :32-45), `empleados/[id]/index.vue` (tabs :62), `app.config.ts`

## Deliverables
1. `development/jul4-improvements/tasks/jul4-improvements/result.md` — files changed per phase + playwright output summary
2. `development/jul4-improvements/tasks/jul4-improvements/completion-report.md` — handoff
Implementation output goes to the Implementation Location paths — not tasks/.
No extra `*-report.md`/`*-findings.md` files — intermediate notes go in progress-report.md sections.

## Progress Reporting
`development/jul4-improvements/tasks/jul4-improvements/progress-report.md`
Append after each phase: `## Phase P{N}: {name} — ✅ Done` + brief changes + spec output summary.

## Acceptance Criteria
1. Genero OTRO reveals text input; custom value persisted (crear + editar pacientes)
2. MENSUAL cert: periodo saved, comprobante uploaded, "Duplicar para este mes" works
3. Missing-month alert shows on /certificados and clears after duplicate
4. `tipo_certificado` NOT NULL in DB after P1 (DRIFT-1)
5. Empleado cert rows persist archivoUrl (both nuevo & editar — parity)
6. Hoja de vida uploads from Info Laboral, downloadable from detail
7. Pendientes tab: derived (vencido "hace N días", hoja de vida faltante) + manual add/resolve
8. Novedades tab: 5 tipos, adjuntos, timeline newest-first
9. Contrato: one activo enforced; fechaFin null only for TERMINO_INDEFINIDO
10. /nomina: OPS → 3 typed slots + otros; fijo/indefinido → desprendible + salario; duplicate periodo → 409 handled
11. ALL `tests/local-qa/` specs green including the pre-existing 13
12. `context/plan-implemented/jul-4-improvements-plan-implemented.md` written

## Constraints
- Migrations: `npx prisma migrate dev --create-only --name {n}` → verify SQL is additive-only → `npx prisma migrate deploy` → `npx prisma generate`. **NEVER `--shadow-database-url`**. Unexpected DROP/ALTER in generated SQL → STOP + escalate.
- DATABASE_URL `postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev`; run prisma from `backend/`.
- Backend restart: `kill $(lsof -ti :3101)` then relaunch from backend/ — never blanket pkill (prod service on :4142).
- PrimeVue 4 components only (`<Select>`, `<DatePicker>`, `<Dialog>`, `<Tag>`, `<Message>`); match existing import patterns.
- Tabs use `v-show` → scope Playwright selectors `:visible`; append new tabs after existing indexes.
- genero column varchar(20) → maxlength on custom input.
- Every crear/editar spec includes a happy-path submit.
- Legacy models (Nomina, Ausentismo, GestionTiempoVacaciones) untouched. No staging/AWS. npm not pnpm.
- Self-repair ≤2 attempts per error; then TURNING-POINT-STRATEGY. Max 2 escalations.

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "{TASK_ID}", status: "in_progress")` — actual id via TaskList
2. **During**: append phase sections to progress-report.md
3. **On error**: self-repair ≤2 → append `## Strategy Request` to progress-report.md → `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: {one-line}. See progress-report.md §Strategy Request", summary: "Strategy escalation")` → WAIT
4. **If blocked**: `SendMessage(to: "main", message: "BLOCKED: {problem}. Attempted: {tried}. Need: {unblock}", summary: "Blocked")` → WAIT
5. **On completion**: write result.md + completion-report.md → `TaskUpdate(status: "completed")` → `SendMessage(to: "main", message: "COMPLETE: {summary}. See tasks/jul4-improvements/result.md", summary: "Task complete")`
6. Never TaskCreate. After COMPLETE: ignore idle/echo messages — end turn silently.

## Tools Available
All standard tools (Read, Edit, Write, Bash, sub-agents via Agent). `TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage` are NATIVE tools — call directly like Read/Bash. NOT skills; no ToolSearch needed (doesn't exist in your session). Tool error → include exact text in BLOCKED message.
