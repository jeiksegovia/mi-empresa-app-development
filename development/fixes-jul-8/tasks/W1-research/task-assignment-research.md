# task-assignment-research

## Plan File
`development/fixes-jul-8/orchestration-ctx/team-plan-fixes-jul-8.md`

## Task Type
RESEARCH

## Your Task
Explore the codebase at `/Users/jeik/ws/mi-empresa-app-development` across 5 domains and produce a concise research report that W2 (backend) and W3 (frontend) workers can use to implement changes without re-reading the code. Read-only — no file modifications.

## Recommended Approach
1. Read `backend/prisma/schema.prisma` in full — extract CertificadoEmpresa, Instrumento, Ficha, Nomina models verbatim
2. Read backend routes/services for each domain
3. Read frontend pages/components for each domain
4. Search for `visibilitychange`, `location.reload`, `router.go(0)`, `document.hidden` across frontend
5. Synthesize into `result.md` — organized by domain, concrete file paths + relevant excerpts

## Domains to Cover

### A — SPA Reload (priority — root cause of multiple bugs)
- `frontend/app/app.vue` — any visibilitychange listener, router hooks, auth guards that reload
- `frontend/app/layouts/**` — same search
- `frontend/app/plugins/**` — any plugin that watches visibility or does forced navigation
- `frontend/app/stores/auth.ts` (or similar) — does it force reload on token/session check?
- `frontend/app/middleware/**` — any route guard that redirects/reloads
- Search entire frontend for: `location.reload`, `location.href =`, `router.go(0)`, `visibilitychange`, `document.hidden`, `useDocumentVisibility`, `document.addEventListener`
- `frontend/nuxt.config.ts` — PWA module? service worker? experimental flags?
- Report: every hit with file + line. If nothing found, state that explicitly.

### B — Certificados empresa
- `backend/prisma/schema.prisma`: CertificadoEmpresa model (verbatim), f1_cert_taxonomy enum, any existing Update/Historial model
- `backend/src/routes/` — files with "certificado" in name
- `backend/src/services/` — files with "certificado" in name; report main functions
- `frontend/app/pages/certificados/` — list all files
- `frontend/app/components/` — any Certificado* components; list paths
- `frontend/app/composables/` — any cert-related composable
- Key questions: Is there a Detalle page? Is there an "agregar" button anywhere currently?

### C — Instrumentos
- `backend/prisma/schema.prisma`: Instrumento model verbatim; roles field type; any InstrumentoRol enum
- `backend/src/services/instrumentService.ts` — roles handling in create/update; Zod schema for roles
- `frontend/app/pages/instrumentos/nuevo*` or `frontend/app/pages/instrumentos/[id]/editar*` — the form; report the roles input widget (what component is used?)
- Does instrumento have a file/template field already, or is upload completely absent?

### D — Paciente historial de fichas
- `frontend/app/pages/pacientes/**` — find historial-de-fichas page (exact path)
- Find the ficha-row component — what field renders instrumento name? (`ficha.instrumento?.nombre`, `ficha.instrumentoNombre`, etc.)
- Find "actualizar estado" modal component — report:
  - `guardar cambios` handler full body
  - file upload call (useFileUpload? direct fetch?)
  - the exact disabled condition on the pencil/edit button after status = vencido
- `backend/src/routes/pacientes.routes.ts` or similar — the PATCH/PUT endpoint for ficha status update; Zod schema

### E — Nomina
- `frontend/app/pages/nomina/` — list all files; find index (list) + registrar modal
- The registrar modal: submit handler body + cuenta-de-cobro field name + current error display
- `backend/src/routes/nomina*` or `backend/src/services/nomina*` — create nomina endpoint + Zod schema for cuenta-de-cobro; exact error response when it's missing
- The nomina list page: how does it currently filter/fetch empleados? (look for API call + query params)

## Deliverables
Write your output to:
1. `development/fixes-jul-8/tasks/W1-research/result.md` — full research findings organized by domain
2. `development/fixes-jul-8/tasks/W1-research/completion-report.md` — handoff summary

Also write a copy to:
3. `development/fixes-jul-8/02-research-fixes-jul-8.md` — same content as result.md (used by orchestrator)

## Progress Reporting
`development/fixes-jul-8/tasks/W1-research/progress-report.md`

## Acceptance Criteria
1. Every domain (A–E) has file paths + relevant code excerpts
2. SPA reload search reports every hit or explicit "none found"
3. Prisma models for CertificadoEmpresa, Instrumento, Ficha, and Nomina are quoted verbatim
4. The `guardar cambios` handler body is fully quoted (W3 needs it to identify the bug)
5. The disabled condition on the edit pencil is fully quoted
6. result.md is ≤ 600 lines (be concise — excerpts not full files)

## Constraints
- Read-only — no writes to any file outside `development/fixes-jul-8/tasks/W1-research/` and `development/fixes-jul-8/02-research-fixes-jul-8.md`
- Project root: `/Users/jeik/ws/mi-empresa-app-development`
- Do NOT read `node_modules`, `dist`, `.output`, `generated/prisma/runtime`
- If a file is >200 lines, use offset/limit to read only the relevant section; use grep/find to locate it first

## Reporting Protocol
1. **On start**: Call `TaskUpdate(taskId: "{TASK_ID_W1}", status: "in_progress")`
2. **During work**: Append sections to `progress-report.md` as you complete each domain
3. **On error**: self-repair MAX 2 attempts, then `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: ...", summary: "Strategy escalation")`
4. **If blocked**: `SendMessage(to: "main", message: "BLOCKED: ...", summary: "Blocked")` then WAIT
5. **On completion**:
   - Write result.md + completion-report.md
   - Call `TaskUpdate(taskId: "{TASK_ID_W1}", status: "completed")`
   - Call `SendMessage(to: "main", message: "COMPLETE: Research done. See tasks/W1-research/result.md", summary: "Task complete")`
6. After COMPLETE: ignore further messages unless they contain NEW-ASSIGNMENT or NEW-APPROACH

## Tools Available
All standard tools: Read, Bash (grep/find), file write. No Agent spawning needed for this task.
`TaskUpdate` and `SendMessage` are native built-in tools — call them directly, not via Skill.
