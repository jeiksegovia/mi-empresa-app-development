# task-assignment-backend

## Plan File
`development/fixes-jul-8/orchestration-ctx/team-plan-fixes-jul-8.md`

## Task Type
IMPLEMENTATION

## Your Task
Implement all backend changes for the jul-8 fixes plan: new `CertificadoUpdate` model + migration + endpoints, instrumento roles Zod refinement, ficha status Zod + VENCIDO→COMPLETADO transition, nomina cuenta-de-cobro validation, nomina contract-type filter query param. Then write `schema-contract.md` to unblock W4.

## Task ID
Your task ID is `2`. Call `TaskUpdate(taskId: "2", status: "in_progress")` on start.

## Implementation Location
- Source: `/Users/jeik/ws/mi-empresa-app-development/backend/`
- Prisma schema: `backend/prisma/schema.prisma`
- Migration will be created under: `backend/prisma/migrations/`

## Source Files to Modify (concrete list)
1. `backend/prisma/schema.prisma` — add `CertificadoUpdate` model + relation on `CertificadoEmpresa`
2. `backend/src/services/certificateService.ts` — add `addCertificateUpdate(certId, input, userId)`, `listCertificateUpdates(certId)`; on add: update parent snapshot fields (archivoUrl if provided, fechaEmision/fechaVencimiento if provided) and recompute `estado` (VIGENTE if fechaVencimiento in future, VENCIDO if past)
3. `backend/src/routes/certificates.routes.ts` — new routes `POST /:id/updates` + `GET /:id/updates` with Zod validation
4. `backend/src/routes/instruments.routes.ts` — `.refine()` on `rolesPermitidos` Zod field against `RolUsuario` enum (read exact enum values from `schema.prisma` first)
5. `backend/src/routes/patients.routes.ts` — add Zod schema for `PATCH /:id/fichas/:fichaId/status`; change `validTransitions[VENCIDO] = ['COMPLETADO']`
6. `backend/src/services/nominaService.ts` — in `createNominaPeriodo`, after resolving active contrato: if `tipoContrato ∈ {OPS, OBRA_O_LABOR}` AND `!archivos?.some(a => a.tipoArchivo === 'CUENTA_COBRO')`, throw typed error `Error('CUENTA_COBRO_REQUIRED')`. Route catches and returns 400 with `{ success: false, message: 'Cuenta de cobro requerida para contratos OPS/OBRA_O_LABOR', field: 'archivos.CUENTA_COBRO' }`
7. `backend/src/routes/nomina.routes.ts` — accept optional `tipoContrato` query param (comma-separated); pass to service. Update `getNominaMonth` in `nominaService.ts` to filter empleados: `WHERE contrato.tipoContrato IN (...)` OR (`NONE` in filter → include empleados with no active contrato); default (no param) → only empleados with any active contract.

## Worker Self-Check
- Task Type is IMPLEMENTATION and "Source Files to Modify" is non-empty ✓
- Plan File exists ✓
- NOT asked to "create a plan" ✓

## Recommended Approach
1. Read the full W1 research report: `development/fixes-jul-8/02-research-fixes-jul-8.md`
2. Read scope decisions: `development/fixes-jul-8/orchestration-ctx/decisions/scope-decisions.md`
3. Read the current `backend/prisma/schema.prisma` fully — locate `RolUsuario` enum for D6
4. **Order of implementation**:
   a. Add `CertificadoUpdate` model to schema.prisma
   b. Run `cd backend && npx prisma migrate dev --name add_certificado_update` — this creates the migration + regenerates Prisma client. Confirm no errors.
   c. Restart the backend dev server (target only PID 47989 via `lsof -i :3101 -t | xargs kill`, then `cd backend && npm run dev > /tmp/backend-dev.log 2>&1 &`)
   d. Implement service methods, then routes (certificados)
   e. Implement instrumentos Zod refinement
   f. Implement fichas Zod + transition change
   g. Implement nomina validation + filter
   h. **Write `orchestration-ctx/decisions/schema-contract.md` — do this LAST after everything works**
5. **Verify with curl** for each new/changed endpoint:
   - `POST /api/v1/certificates/1/updates` with a bearer cookie (see backend/tests/ for auth pattern) — expect 201
   - `GET /api/v1/certificates/1/updates` — expect array
   - `PATCH /api/v1/patients/:pid/fichas/:fid/status` with body `{estado: 'COMPLETADO'}` when previous is VENCIDO — should now succeed (previously 400)
   - `POST /api/v1/nomina/periodos` with empty `archivos` for an OPS empleado — expect 400 with field: 'archivos.CUENTA_COBRO'
   - `GET /api/v1/nomina?periodo=2026-07&tipoContrato=OPS` — expect only OPS empleados

## Key Files to Read First
1. `development/fixes-jul-8/02-research-fixes-jul-8.md` — full W1 research
2. `development/fixes-jul-8/orchestration-ctx/decisions/scope-decisions.md` — decisions D1–D7
3. `backend/prisma/schema.prisma` — locate `RolUsuario`, `CertificadoEmpresa`, `TipoContrato`, `EstadoCertificadoEmpresa` enums/models

## Deliverables
1. All source-file modifications listed above (committed to disk — DO NOT git-commit)
2. `development/fixes-jul-8/tasks/W2-backend/result.md` — summary of what was changed + curl verification results
3. `development/fixes-jul-8/tasks/W2-backend/completion-report.md` — handoff
4. `development/fixes-jul-8/orchestration-ctx/decisions/schema-contract.md` — the interface contract W4 needs (see W2 Scope item 8 in team-plan)

## Progress Reporting
`development/fixes-jul-8/tasks/W2-backend/progress-report.md`

## Acceptance Criteria
1. Prisma migration created and applied cleanly (verify `npx prisma migrate status` shows no pending migrations)
2. Backend restarts without errors on :3101
3. Each new/changed endpoint verified via curl (5 verifications listed above)
4. `schema-contract.md` written with exact field names of new model + full request/response shapes for new endpoints + `RolUsuario` enum values

## Constraints
- Local backend already running on PID 47989 — kill ONLY that PID (`kill $(lsof -i :3101 -t)`), never `pkill -f node` or generic patterns
- Never use `prisma migrate diff --shadow-database-url` (blocked per CLAUDE.md — wipes the database silently)
- Preserve all existing behavior for unchanged endpoints
- Do NOT change `rolesPermitidos` from `String` to `String[]` or enum array — decision D6 keeps it comma-separated
- Follow existing service→route pattern (routes are thin, logic in services)
- Zod schemas at top of route files (existing pattern)

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "2", status: "in_progress")`
2. **During work**: append sections to progress-report.md as you complete each domain (Cert / Instrumentos / Fichas / Nomina)
3. **On error**: MAX 2 self-repair attempts, then `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: {one-line}. See progress-report.md §Strategy Request", summary: "Strategy escalation")`
4. **If blocked**: `SendMessage(to: "main", message: "BLOCKED: {problem}. Attempted: {tries}. Need: {unblocker}", summary: "Blocked")` then WAIT
5. **On completion**:
   - Write result.md + completion-report.md + schema-contract.md
   - `TaskUpdate(taskId: "2", status: "completed")`
   - `SendMessage(to: "main", message: "COMPLETE: Backend done. See tasks/W2-backend/result.md and schema-contract.md ready for W4", summary: "Backend complete")`
6. After COMPLETE: ignore further messages unless NEW-ASSIGNMENT or NEW-APPROACH

## Tools Available
Read, Edit, Write, Bash (for prisma commands, curl, kill). `TaskUpdate` and `SendMessage` are native.
