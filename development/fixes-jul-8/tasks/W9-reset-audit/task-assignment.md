# task-assignment — file-state reset audit + fixes

## Task Type
IMPLEMENTATION (audit + code changes + tests)

## Task ID
`40`. Call `TaskUpdate(taskId: "40", status: "in_progress")` on start.

## Your Task
Fix a confirmed bug: on paciente detail page, opening the "actualizar estado" ficha dialog for one row, saving, then opening the dialog for a DIFFERENT ficha shows the previous file (`archivo respaldo`) instead of a clean slate. Then audit the entire frontend for other modal-reuse-across-rows patterns with the same file-state leak and fix them.

## Confirmed root cause of the ficha bug
In `frontend/app/pages/pacientes/[id]/index.vue:116`:
```ts
const stashKey = computed(() => `ficha:${route.params.id}:file`)
```
`route.params.id` is the **patient** id, not the ficha id. Every ficha row on the same patient page shares the same stash key. When the user picks a file for ficha #1, it stashes under `ficha:<patientId>:file`; when the user opens ficha #2's dialog, `restoreFile(stashKey.value)` returns ficha #1's file.

## Source Files to Modify
1. `frontend/app/pages/pacientes/[id]/index.vue`:
   - Change `stashKey` to include `fichaForm.id`: `computed(() => \`ficha:${route.params.id}:${fichaForm.id}:file\`)`. Since `fichaForm.id` is set inside `openFichaDialog` BEFORE the restore call, the reactive computed will pick up the new value.
   - Add an EXPLICIT reset at the TOP of `openFichaDialog(ficha)` — before any restore logic — to ensure `uploadedFile.value = null`, `uploadedFileName.value = null`, `uploadedFileKey.value = null`. Currently the reset happens partially and after some state is already read.
   - Reset the sessionStorage draft key namespace similarly if it uses the same shared key.
2. Any other page identified in the audit below with the same bug.

## Audit scope (READ + REPORT)
For every page under `frontend/app/pages/`, identify **modal-reuse-across-rows** patterns:
- A dialog opened for different list items on the same page load
- The dialog has file-input state, sessionStorage draft state, or IDB stash state
- The state is keyed by anything OTHER than the row id (patient id, form key, etc.)

Known suspects (verify each):
- `frontend/app/pages/nomina/index.vue` — the "registrar/editar" dialog is opened for different empleados. Check whether `dialogForm.archivos`, `cuentaCobroError`, etc. get reset between opens (`openDialog`, `closeDialog`, `saveEntrada` handlers).
- `frontend/app/pages/certificados/[id].vue` — Agregar actualización dialog. Single-cert-per-page so lower risk, but confirm.
- `frontend/app/pages/empleados/[id]/editar.vue` — check for any dialog reuse in the editar flow.
- `frontend/app/pages/certificados/index.vue` — any modal on this page?
- `frontend/app/pages/pacientes/crear.vue` — file inputs on creation?
- `frontend/app/pages/pacientes/[id]/editar.vue` — file inputs?
- `frontend/app/pages/instrumentos/crear.vue` and `[id]/editar.vue` — plantilla file inputs; not modals but check state reset between page navs.

## Deliverables
1. Modified `pacientes/[id]/index.vue` with the ficha fix
2. Any other file with a similar bug — fixed
3. New playwright spec: `frontend/tests/local-qa/jul8-ficha-file-reset.spec.ts` — opens ficha #1 dialog, picks file, closes dialog, opens ficha #2 dialog → asserts uploadedFileName is null AND IDB does not restore any file
4. Audit report: `development/fixes-jul-8/tasks/W9-reset-audit/audit-report.md` — table of pages checked, findings, fixes applied
5. `development/fixes-jul-8/tasks/W9-reset-audit/result.md`
6. `development/fixes-jul-8/tasks/W9-reset-audit/completion-report.md`
7. `development/fixes-jul-8/tasks/W9-reset-audit/progress-report.md`

## Acceptance Criteria
1. Ficha dialog: switching between fichas on the same patient page shows a CLEAN file input every time
2. Existing playwright specs still pass (`jul8-fichas-*.spec.ts`, `jul8-*.spec.ts`)
3. New spec proves no leak
4. Audit report enumerates every page checked with a clear status per page (LEAK-FIXED / NO-LEAK / N-A)
5. Any leak found in other pages is either fixed or reported (with reasoning) as safe-to-defer

## Constraints
- Local frontend :3100 running (kill only that PID if HMR breaks)
- Backend :3101 running (do NOT touch)
- Follow existing patterns (PrimeVue Dialog, `useFileStash`, sessionStorage)
- Do NOT modify `useApi.ts`, `useFileUpload.ts`, `useFileStash.ts`, `nuxt.config.ts`
- Do NOT git-commit
- Do NOT modify source code just to make an existing test pass — fix the code, then update tests only if the API contract changed

## Recommended Approach
1. Read the confirmed root cause file: `frontend/app/pages/pacientes/[id]/index.vue:105-370` (all the ficha-form state + openFichaDialog + onFileSelected + stashKey)
2. Read `useFileStash.ts` for the stash/restore/clear signature
3. Read `jul8-fichas-file-stash.spec.ts` for the existing test pattern
4. Fix the ficha stashKey + reset — verify the existing playwright spec still passes (a stale-file restore on the same ficha SHOULD still work — only different-ficha restores should not leak)
5. Audit each suspect page systematically; write findings to audit-report.md as you go
6. Fix any other leaks
7. Write the new playwright spec
8. Run all `jul8-*.spec.ts` — confirm no regressions

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "40", status: "in_progress")`
2. **Progress**: append to progress-report.md per phase (Root-cause fix / Audit / Other fixes / Tests)
3. **On completion**:
   - `TaskUpdate(taskId: "40", status: "completed")`
   - `SendMessage(to: "main", message: "COMPLETE: File-reset audit + fixes done. See tasks/W9-reset-audit/audit-report.md and result.md", summary: "Reset audit complete")`

## Tools
Read, Edit, Write, Bash (playwright). SendMessage + TaskUpdate are native.
