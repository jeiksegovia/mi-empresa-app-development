# task-assignment-frontend-b — certificados + instrumentos

## Plan File
`development/fixes-jul-8/orchestration-ctx/team-plan-fixes-jul-8.md`

## Task Type
IMPLEMENTATION

## Your Task
Frontend fixes for **certificados empresa** (Detalle refactor with history + agregar; create-with-first-update; edit metadata-only) and **instrumentos** (MultiSelect roles + plantilla upload + new editar page). Does NOT touch pacientes fichas or nomina — W3 owns those.

## Task ID
Your task ID is `4`. Call `TaskUpdate(taskId: "4", status: "in_progress")` on start.

## Implementation Location
- Source: `/Users/jeik/ws/mi-empresa-app-development/frontend/`

## Source Files to Modify (concrete list)
1. `frontend/app/pages/certificados/[id].vue` — refactor:
   - New "Historial de actualizaciones" section, fetches `GET /certificates/:id/updates` (response: `{ success, data: CertificateUpdateRecord[] }` — newest first)
   - New "Agregar actualización" button + dialog: fields = optional file (via `useFileUpload().uploadFile(file, 'certificados')`), optional notas, optional fechaEmision, optional fechaVencimiento. At least ONE field must be provided (backend enforces via Zod refine). Submits via `POST /certificates/:id/updates` with body `{archivoUrl?, notas?, fechaEmision?, fechaVencimiento?}`
   - After successful add: re-fetch cert (parent snapshot updated by backend) + re-fetch updates list. Toast success.
   - Inline "Editar" mode: strip out `archivoUrl`, `comprobantePagoUrl`, `fechaEmision`, `fechaVencimiento` (these are now history-managed). Keep: `nombre`, `tipoCertificado`, `descripcion`, `estado`, `periodicidad`, `periodo`, `comprobantePagoUrl` (payment proof — not part of update history per contract; keeps as metadata edit).
2. `frontend/app/pages/certificados/crear.vue` — add optional "primera actualización" section at bottom of form:
   - Optional file input (`useFileUpload().uploadFile(file, 'certificados')`)
   - Optional notas text field
   - Optional fechaEmision, fechaVencimiento
   - On submit: POST /certificates first (existing flow), then if any of the 4 update fields is set, immediately POST /certificates/{newId}/updates with them. Show toast for both steps; both must succeed for user to be routed to `/certificados/{newId}`.
3. `frontend/app/pages/instrumentos/crear.vue` — replace `<InputText v-model="form.rolesPermitidos">` (lines 198-214 per W1) with:
   - `<MultiSelect v-model="rolesArray" :options="['ADMIN','EMPLEADO','AUDITOR','OPERADOR']" placeholder="Selecciona roles">` — display option label matches value
   - On form submit: `form.rolesPermitidos = rolesArray.join(',')` before the API call
   - Add plantilla file upload: `<FileUpload>` or a plain file input + `useFileUpload().uploadFile(file, 'instrumentos')`; on success, set `form.plantillaArchivo = key`. Optional field.
4. `frontend/app/pages/instrumentos/[id]/editar.vue` — NEW FILE. Mirror `crear.vue` structure but pre-populate from `GET /instruments/:id`, submit via `PUT /instruments/:id`. Include the same MultiSelect for roles + plantilla file upload (allow replace; show current filename if `plantillaArchivo` is set with a "Reemplazar" button).
5. `frontend/app/pages/instrumentos/[id]/index.vue` — add a "Editar" button (admin-only) linking to `/instrumentos/:id/editar` (top-right of the detail page, following existing patterns from other detail pages).

## Worker Self-Check
- Task Type is IMPLEMENTATION and "Source Files to Modify" is non-empty ✓
- Plan File exists ✓
- NOT asked to "create a plan" ✓

## Recommended Approach
1. Read `development/fixes-jul-8/orchestration-ctx/decisions/schema-contract.md` — this is the single source of truth for endpoint shapes, enum values, and error contracts
2. Read `development/fixes-jul-8/02-research-fixes-jul-8.md` — Domains B and C
3. Read scope decisions: `development/fixes-jul-8/orchestration-ctx/decisions/scope-decisions.md` — D2, D6, D7
4. Read current source files first (`certificados/[id].vue`, `certificados/crear.vue`, `instrumentos/crear.vue`, `instrumentos/[id]/index.vue`) BEFORE editing — understand the existing patterns for PrimeVue components, dialog composition, useApi/useFileUpload usage
5. **Order of implementation**:
   a. Instrumentos crear.vue MultiSelect + plantilla (simplest)
   b. Instrumentos [id]/editar.vue (new file, mirrors crear)
   c. Instrumentos [id]/index.vue add Editar button
   d. Certificados crear.vue add optional first-update section
   e. Certificados [id].vue add history section + agregar dialog
   f. Certificados [id].vue restrict inline edit to metadata only
6. **Verify each in browser**: local frontend on 3100 (PID 56667). Hot reload should Just Work.
7. TypeScript check: `cd frontend && npx nuxt typecheck` if the project has it, otherwise inspect editor squigglies.

## Key Files to Read First
1. `development/fixes-jul-8/orchestration-ctx/decisions/schema-contract.md` (MANDATORY — API contracts)
2. `development/fixes-jul-8/02-research-fixes-jul-8.md` (Domains B, C)
3. `development/fixes-jul-8/orchestration-ctx/decisions/scope-decisions.md` (D2, D6, D7)
4. `frontend/app/pages/certificados/[id].vue` (521 lines — the refactor target)
5. `frontend/app/pages/certificados/crear.vue` (508 lines)
6. `frontend/app/pages/instrumentos/crear.vue` (roles input at lines 198-214)
7. `frontend/app/pages/instrumentos/[id]/index.vue` (read-only detail; add Editar button)
8. `frontend/app/composables/useFileUpload.ts` (reference for file upload pattern — DO NOT MODIFY)
9. `frontend/app/composables/useApi.ts` (reference for API calls — DO NOT MODIFY)

## Deliverables
1. All source-file modifications listed above (files written — DO NOT git-commit)
2. `development/fixes-jul-8/tasks/W4-frontend-b/result.md` — summary of changes + manual browser verification notes
3. `development/fixes-jul-8/tasks/W4-frontend-b/completion-report.md`

## Progress Reporting
`development/fixes-jul-8/tasks/W4-frontend-b/progress-report.md`

## Acceptance Criteria
1. Certificados detail page shows history section (empty state OK if no updates yet), "Agregar" button opens dialog, submit calls POST /updates and refreshes both parent + list
2. Certificados detail inline edit form no longer includes file/date fields (per D2 — those are history-managed)
3. Certificados crear allows optional first-update in a single flow; user is routed to /certificados/{newId} only after both requests succeed
4. Instrumentos crear roles input is MultiSelect, submits comma-joined string
5. Instrumentos crear allows optional plantilla upload
6. `instrumentos/[id]/editar.vue` exists, populates from GET, submits PUT with roles.join(',') and plantilla
7. Instrumentos detail page has Editar button (admin-only) linking to editar page
8. TypeScript passes; no console errors on hot reload
9. Existing certificados/index.vue behavior is unchanged (list page not touched)

## Constraints
- Local frontend running PID 56667. Kill only that PID if needed (`kill $(lsof -i :3100 -t)`).
- Follow existing patterns: PrimeVue components (`Dialog`, `MultiSelect`, `Button`, `InputText`, `Textarea`, `Calendar` for dates), `useApi().apiFetch`, `useToast`
- Preserve the existing Pinia auth store patterns (admin-role checks: `useAuthStore().user?.rol === 'ADMIN'`)
- Do NOT modify `frontend/app/composables/useFileUpload.ts`, `useApi.ts`, or `nuxt.config.ts`
- Do NOT commit anything
- Do NOT touch fichas or nomina pages — W3 owns those

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "4", status: "in_progress")`
2. **During work**: append sections to progress-report.md per domain (Instrumentos / Certificados-crear / Certificados-detail)
3. **On error**: MAX 2 self-repair attempts, then `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: ...", summary: "Strategy escalation")`
4. **If blocked**: `SendMessage(to: "main", message: "BLOCKED: ...", summary: "Blocked")` then WAIT
5. **On completion**:
   - Write result.md + completion-report.md
   - `TaskUpdate(taskId: "4", status: "completed")`
   - `SendMessage(to: "main", message: "COMPLETE: Frontend-B done. See tasks/W4-frontend-b/result.md", summary: "Frontend-B complete")`
6. After COMPLETE: ignore further messages unless NEW-ASSIGNMENT or NEW-APPROACH

## Tools Available
Read, Edit, Write, Bash (targeted PID kill, curl, npm). `TaskUpdate` and `SendMessage` are native.
