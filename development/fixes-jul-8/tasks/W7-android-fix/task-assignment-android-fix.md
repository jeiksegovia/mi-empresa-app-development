# task-assignment-android-fix + GAP-2/3

## Plan File
`development/fixes-jul-8/orchestration-ctx/team-plan-fixes-jul-8.md`

## Task Type
IMPLEMENTATION

## Your Task
Apply the fixes W6 designed for the Android tab-discard bug, then extend the same persistence to the other file-upload forms (GAP-3), and add the plantilla download link on the instrumento detail page (GAP-2).

## Task ID
Your task ID is `26`. Call `TaskUpdate(taskId: "26", status: "in_progress")` on start.

## Implementation Location
- Source: `/Users/jeik/ws/mi-empresa-app-development/frontend/`

## Source Files to Modify (concrete list)
### Part 1 — Android fix (Fix Option A + B from W6's proposal)
1. `frontend/app/composables/useFileStash.ts` — **NEW** — verbatim from `development/fixes-jul-8/tasks/W6-android-research/fix-proposal.md §A.1` (IndexedDB stash/restore/clear)
2. `frontend/app/pages/pacientes/[id]/index.vue` — apply Diffs 1-4 from W6's proposal:
   - Diff 1 — import + stashKey computed
   - Diff 2 — `onFileSelected` stashes to IDB
   - Diff 3 — dialog-open restore path (integrate with existing sessionStorage draft restore)
   - Diff 4 — clear IDB entry on successful submit + on dialog close
   - Additionally: apply Fix Option B's title-updater at file picker open + reset on file selected/cancel

### Part 2 — GAP-3: extend to cert + instrumento forms
3. `frontend/app/pages/certificados/crear.vue` — cert-file-input + first-update file input; apply same stash pattern with keys `cert-crear:file`, `cert-crear:update-file`
4. `frontend/app/pages/certificados/[id].vue` — the Agregar actualización dialog file input; key `cert-agregar:<certId>:file`
5. `frontend/app/pages/instrumentos/crear.vue` — plantilla file input; key `instrumento-crear:plantilla`
6. `frontend/app/pages/instrumentos/[id]/editar.vue` — plantilla file input; key `instrumento-editar:<id>:plantilla`

Also add sessionStorage draft persistence for the metadata fields on these forms (mirror the ficha `writeFichaDraft`/`readFichaDraft` pattern) — key format `<form>-draft:<contextId>`.

### Part 3 — GAP-2: plantilla download link on instrumento detail
7. `frontend/app/pages/instrumentos/[id]/index.vue` — if `instrument.plantillaArchivo` is a non-empty string, render a Button "Descargar plantilla" that calls `useFileUpload().downloadFile(instrument.plantillaArchivo)`. Follow the pattern used by cert/ficha download buttons if any exist; otherwise a plain `<Button label="Descargar plantilla" @click="handlePlantillaDownload">`.

## Worker Self-Check
- Task Type is IMPLEMENTATION and "Source Files to Modify" is non-empty ✓
- Plan File exists ✓
- NOT asked to "create a plan" ✓

## Recommended Approach
1. **Read W6's outputs first** (MANDATORY):
   - `development/fixes-jul-8/tasks/W6-android-research/result.md` — root cause analysis
   - `development/fixes-jul-8/tasks/W6-android-research/fix-proposal.md` — verbatim code diffs
2. **Order of implementation**:
   a. Create `useFileStash.ts` composable (verbatim from proposal §A.1)
   b. Apply the 4 diffs to `pacientes/[id]/index.vue` (fichas dialog is the highest-value target)
   c. Add title-updater helper (can live in the composable or inline in each page)
   d. Extend to certificados/crear.vue, certificados/[id].vue Agregar dialog
   e. Extend to instrumentos/crear.vue, instrumentos/[id]/editar.vue
   f. Add plantilla download button on instrumentos/[id]/index.vue
3. **Verify**:
   - Backend + frontend already running (do NOT restart). HMR picks up changes.
   - Manually confirm via browser DevTools → Application → IndexedDB that `mi-empresa-file-stash` DB is created on first file select
   - Confirm `sessionStorage` draft entry appears on each form
   - Existing playwright specs from W5 (`jul8-fichas-persistence.spec.ts`) should still pass — do NOT modify tests to accommodate new behavior; if they fail, log the discrepancy
4. **Update tests** — add new specs (or extend existing ones) for the file-stash behavior:
   - `frontend/tests/local-qa/jul8-fichas-file-stash.spec.ts` — verify file survives a page reload (simulate via `page.reload()` after stash)
   - Follow existing playwright patterns from `jul8-fichas-persistence.spec.ts`
   - At least 1 test for the fichas file-stash + 1 for one of the extended forms

## Key Files to Read First
1. `development/fixes-jul-8/tasks/W6-android-research/fix-proposal.md` (MANDATORY — has the verbatim code)
2. `development/fixes-jul-8/tasks/W6-android-research/result.md` — background
3. `frontend/app/pages/pacientes/[id]/index.vue` — target of primary fix
4. `frontend/app/composables/useFileUpload.ts` — reference (do NOT modify)
5. `frontend/tests/local-qa/jul8-fichas-persistence.spec.ts` — existing playwright pattern to mirror

## Deliverables
1. All file modifications listed (Part 1-3)
2. New composable `useFileStash.ts`
3. New playwright spec(s) for the file-stash behavior
4. `development/fixes-jul-8/tasks/W7-android-fix/result.md` — summary + verification notes
5. `development/fixes-jul-8/tasks/W7-android-fix/completion-report.md` — handoff

## Progress Reporting
`development/fixes-jul-8/tasks/W7-android-fix/progress-report.md`

## Acceptance Criteria
1. `useFileStash.ts` composable exists and matches W6's proposal signature (stash/restore/clear + 24h TTL)
2. Ficha dialog: file survives simulated page reload — playwright test proves it
3. Cert crear + Agregar + instrumento crear + editar all use the same persistence pattern
4. Instrumento detail page shows "Descargar plantilla" when `plantillaArchivo` is set
5. Existing W5 tests still pass (13 specs from `jul8-*.spec.ts`)
6. HMR clean, no console errors
7. Title-updater helper applied at least to the fichas dialog

## Constraints
- Local frontend :3100 running (PID may have shifted; kill only the exact PID if needed)
- Local backend :3101 running (do NOT touch)
- Follow existing patterns: PrimeVue components, `useApi()`, `useFileUpload()`, `useToast()`
- Do NOT modify `useApi.ts`, `useFileUpload.ts`, `nuxt.config.ts`
- Do NOT git-commit
- Namespace all IDB/sessionStorage keys with clear prefixes so future contributors can grep them
- The `useFileStash` composable must be defensive: try/catch on all IDB ops; silently no-op on failure (proposal §A.2 edge cases)

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "26", status: "in_progress")`
2. **Progress**: append to progress-report.md per phase (Part 1 / Part 2 / Part 3 / Tests)
3. **On error**: MAX 2 self-repair attempts, then `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: ...", summary: "Strategy escalation")`
4. **If blocked**: `SendMessage(to: "main", message: "BLOCKED: ...", summary: "Blocked")` then WAIT
5. **On completion**:
   - Write result.md + completion-report.md
   - `TaskUpdate(taskId: "26", status: "completed")`
   - `SendMessage(to: "main", message: "COMPLETE: Android fix + GAP-2/3 done. See tasks/W7-android-fix/result.md", summary: "Complete")`

## Tools Available
Read, Edit, Write, Bash. `TaskUpdate` and `SendMessage` are native.
