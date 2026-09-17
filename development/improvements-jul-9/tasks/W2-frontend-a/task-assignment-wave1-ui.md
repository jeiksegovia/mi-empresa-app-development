# task-assignment-wave1-ui (W2, wave 1)

## Plan File
`development/improvements-jul-9/orchestration-ctx/team-plan-improvements-jul-9.md` — read first.
Feature source: `context/user-feedback/improvements-jul-9-insights.md` (§A1–A3, §A6, §D4, §D5). Decisions L1–L6 LOCKED.

## Task Type
IMPLEMENTATION

## Task IDs
Three tasks, work them in this order (all independent, no schema dependency):
- `14` — T6 cert create form cleanup (A1–A3)
- `15` — T7 empresa save bug (A6)
- `16` — T8 dropzone cursor (D4) + contrato tab (D5)
Call `TaskUpdate(taskId: "14", status: "in_progress")` on start; mark each completed as you finish and claim the next. Do NOT claim task #17 — that comes later as NEW-ASSIGNMENT.

## Your Task

### T6 (task 14) — Cert create form cleanup
`frontend/app/pages/certificados/crear.vue`: remove from the TOP block: `periodo`, `fechaEmision`, `fechaVencimiento`, `archivoUrl` upload, `comprobantePagoUrl` upload (and their form state/validation). Final top block: `nombre, tipoCertificado, descripción, periodicidad` only. The "Primera actualización" section at the bottom stays EXACTLY as is (its own file/notas/fechas inputs). Stop sending removed fields in the POST body. QA transcript refs: lines 18–98 of `context/user-feedback/qa-session-jul-9-reinterpreted.md` §1.1–1.3.

### T7 (task 15) — Empresa save bug
User report: `/empresa` page "guardar cambios" does not persist (transcript §1.4). Investigate: read `frontend/app/pages/empresa/*.vue` submit handler → check what the PUT/PATCH sends → check `backend/src/routes/empresa*.ts` (or wherever empresa routes live) → reproduce via curl → fix root cause (may be frontend payload shape, backend Zod, or missing await). MAX 2 self-repair attempts then BLOCKED message with findings.

### T8 (task 16) — Dropzone polish + Contrato tab
- D4: find the file-input/dropzone markup used across forms (search `type="file"` in `frontend/app/`); add `cursor-pointer` + a hover state (follow existing Tailwind patterns).
- D5: in `frontend/app/pages/empleados/[id]/editar.vue`, move ALL contrato UI out of the "información laboral" tab into a NEW tab labeled "Contrato laboral". Check `empleados/nuevo.vue` for the same structure and mirror if applicable. Do NOT add new fields (archivoFirmado/cargo come later — W3's scope). Preserve existing contrato form logic exactly; this is a relocation, not a rewrite.

## Worker Self-Check
- IMPLEMENTATION with non-empty file list ✓. Not asked to create a plan ✓.

## Key Files to Read First
1. Team plan (path above) — esp. §Existing Patterns + §Risk
2. `context/user-feedback/qa-session-jul-9-reinterpreted.md` §1, §1.4, §4.4, §4.5
3. `frontend/app/pages/certificados/crear.vue`
4. `frontend/app/pages/empleados/[id]/editar.vue`

## Constraints
- Local frontend :3100 (HMR live) — kill only exact PID if needed (`lsof -ti :3100`)
- Do NOT touch: `useApi.ts`, `useFileUpload.ts`, `useFileStash.ts`, `nuxt.config.ts`, pacientes/nomina pages, `certificados/[id].vue` (wave-2 scope)
- Preserve `useFileStash` + sessionStorage draft key semantics on any form you touch
- Do NOT git-commit
- Backend on :3101 is being migrated by W1 in parallel — if you hit a transient backend error during T7 testing, retry once before concluding

## Deliverables
1. Source changes for T6/T7/T8
2. `development/improvements-jul-9/tasks/W2-frontend-a/result.md` — per-task summary + verification notes (browser/curl)
3. `development/improvements-jul-9/tasks/W2-frontend-a/completion-report.md`

## Progress Reporting
`development/improvements-jul-9/tasks/W2-frontend-a/progress-report.md` — section per task.

## Acceptance Criteria
1. Cert create form shows only the 4 metadata fields + Primera actualización section; POST body clean
2. Empresa page saves and persists after reload (verified in browser + curl)
3. Dropzones show pointer cursor + hover feedback
4. Contrato UI lives in its own "Contrato laboral" tab; existing contrato CRUD still works
5. No console errors on HMR; existing jul8 specs untouched

## Reporting Protocol
1. On start: `TaskUpdate(taskId: "14", status: "in_progress")`
2. Per task done: `TaskUpdate(taskId: "<id>", status: "completed")`, claim next
3. On error: MAX 2 attempts → TURNING-POINT-STRATEGY + WAIT. If blocked: BLOCKED + WAIT.
4. When all three done: write result.md + completion-report.md → `SendMessage(to: "main", "COMPLETE: Wave-1 UI done (T6/T7/T8). See tasks/W2-frontend-a/result.md", summary: "W2 wave 1 complete")`
5. After COMPLETE: stay available — a NEW-ASSIGNMENT (task #17, shared CertificateUpdateForm) will follow once the schema contract lands. Ignore idle/echo messages carrying no new assignment.

## Tools
Read, Edit, Write, Bash (curl, playwright if useful). `TaskUpdate`/`SendMessage` are native tools.
