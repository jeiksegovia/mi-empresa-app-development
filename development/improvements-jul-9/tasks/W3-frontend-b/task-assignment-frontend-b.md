# task-assignment-frontend-b (W3 — pacientes + empleados + empresa-config UI)

## Plan File
`development/improvements-jul-9/orchestration-ctx/team-plan-improvements-jul-9.md` — read first.
**API contract (your spec)**: `development/improvements-jul-9/orchestration-ctx/decisions/schema-contract-jul9.md` — all endpoints implemented + curl-verified by W1. Never open schema.prisma; the contract is authoritative.
Feature rationale: `context/user-feedback/improvements-jul-9-insights.md` §B1-B6, §D1-D3, §D6-D8.

## Task Type
IMPLEMENTATION

## Task IDs (work in this order)
- `18` — T10 Pacientes UI
- `19` — T11 Empleados UI
- `20` — T12 Contrato UI + empresa config
`TaskUpdate` each as you go.

## Scope per task

### T10 (#18) — Pacientes
`frontend/app/pages/pacientes/[id]/index.vue`, `pacientes/crear.vue`, `pacientes/[id]/editar.vue`:
1. **Notes dialog**: add required `fechaIncidente` DatePicker. On 400 with `field: 'fechaIncidente'`, render inline error next to the field (pattern: nomina CUENTA_COBRO inline `<Message>`). Note: backend hard-blocks dates >2 business days back or future.
2. **Notes list**: add fecha column showing `fechaIncidente` (DD/MM/YYYY).
3. **Datos personales** (crear + editar + detail view): add `fechaCumpleanos` (DatePicker, optional, labeled "Fecha de cumpleaños"), `tipoSangre` (Select with the 8 enum values from contract §2 — display as "A+", "A-", … map to A_POS etc.), `eps` (InputText). Position above "Información del seguro".

### T11 (#19) — Empleados
`frontend/app/pages/empleados/nuevo.vue`, `empleados/[id]/editar.vue`:
1. **Educación repeatable**: consume `/employees/:id/educacion` CRUD (contract §3). Repeatable rows: profesion (required), universidad, fechaGraduacion, diploma file upload (`useFileUpload().uploadFile(file, 'empleado-documentos')`). Add/edit/delete rows. On `nuevo.vue`: since empleado has no id yet, collect rows locally and POST after create (or match how contactosEmergencia does it — check existing pattern first).
2. **Documento identificación**: file upload in datos personales → `documentoIdentificacionUrl` on the empleado PUT/POST.
3. **Remove `nivelEscritura`** input from both forms (backend now optional).

### T12 (#20) — Contrato + empresa config
1. **Contrato laboral tab** (W2 already relocated it in `empleados/[id]/editar.vue`): add `archivoFirmadoUrl` file upload + `cargoId` Select populated from `GET /empresa/cargos?activo=true` (contract §4) with an "➕ Agregar otro cargo" option that opens a small inline dialog → `POST /empresa/cargos {nombre}` → refresh + auto-select. Contrato POST/PUT sends `cargoId: number` (legacy `cargo: string` is rejected by the API).
2. **Empresa configuración — cargos manager**: admin-only section (extend `frontend/app/pages/empresa/editar.vue` or add a new card/tab on the empresa page — follow whichever pattern the page already uses). List cargos with activo state; add new; archive (PATCH activo=false). 409/duplicate → inline error.

## Constraints
- Local frontend :3100 HMR live; backend :3101 healthy — do NOT restart either (kill only exact PID if truly needed)
- Do NOT touch: `certificados/**` (W2's domain), composables, nuxt.config.ts
- File inputs: use the clickable-label + pointer/hover pattern (see `empleados/[id]/editar.vue` contrato dialog for the established markup)
- File stash keys row-scoped where dialogs are reused across rows (jul-9 lesson: `useFileStash` keys must include the row id)
- UI text Spanish; code English. No git commit.
- QA creds for browser verification: admin@miempresa.com/<redacted> (local dev)

## Deliverables
1. Source changes for T10-T12
2. `development/improvements-jul-9/tasks/W3-frontend-b/result.md` — per-task summary + browser verification notes
3. `development/improvements-jul-9/tasks/W3-frontend-b/completion-report.md`

## Progress Reporting
`development/improvements-jul-9/tasks/W3-frontend-b/progress-report.md` — section per task.

## Acceptance Criteria
1. Note with valid fechaIncidente saves; date >2 business days back shows inline error (not just toast)
2. Paciente forms round-trip fechaCumpleanos/tipoSangre/eps (create → detail shows them → edit persists)
3. Educación rows CRUD end-to-end incl. diploma upload
4. Contrato saves with cargoId + archivo firmado; "agregar otro" creates + selects a new cargo
5. Cargos manager lists/creates/archives; duplicate shows friendly error
6. No console errors; existing jul8 specs untouched

## Reporting Protocol
1. On start: `TaskUpdate(taskId: "18", status: "in_progress")`
2. Per task done: TaskUpdate completed, claim next
3. On error: MAX 2 attempts → TURNING-POINT-STRATEGY + WAIT. Blocked → BLOCKED + WAIT.
4. All done: result.md + completion-report.md → `SendMessage(to: "main", "COMPLETE: Frontend-B done (T10-T12). See tasks/W3-frontend-b/result.md", summary: "W3 complete")`
5. After COMPLETE: stay PARKED — QA wave may send fix-ups.

## Tools
Read, Edit, Write, Bash. `TaskUpdate`/`SendMessage` are native tools — call directly.
