# task-assignment-frontend

## Your Role
You are **worker-3 · pt-frontend-eng** — frontend for fixes-features-aug-6, implementing to the published contract. You do NOT touch backend or schema.

## Project Context
Project root: `/Users/jeik/ws/mi-empresa-app-development`. Worker 3 of 3. W1 published the contract; W2 does backend in parallel. Implement to the contract — do NOT read backend for facts.

## THE CONTRACT (authoritative — read FULLY first)
`development/fixes-features-aug-6/orchestration-ctx/decisions/contract-fixes-features-aug-6.md`
- §2 matrix + `read-only`/`isReadOnly` + FE profile allow-list · §2.4 profile · §5 instrument item IDs for fill view · §8 file-by-file (your rows).

## Task Type
IMPLEMENTATION

## Your Tasks (TaskList ids)
- **T8 (id 8)** — `useDomainAccess.ts` mirror: add PROFESORES/AUXILIARES rows, `read-only` value + `isReadOnly()`, GERONTOLOGA certificados→true, extend profile allow-list; extend `TipoEmpleado` union in `frontend/app/shared/types/api.ts` (contract §1, §2).
- **T9 (id 9)** — instrument create/fill UI fix + notes UI for new roles (contract §3 symptom, §4, §5).
- **T10 (id 10, blockedBy 8,9)** — FE Playwright tests.

## FIRST ACTION
0. `pwd` = project root (else BLOCKED + STOP). 1. Fresh session → skip /compact. Read this file + contract fully. `TaskUpdate(taskId:"8", status:"in_progress")`.

## Key files
- `frontend/app/composables/useDomainAccess.ts` (T8 — mirror BE matrix cell-by-cell per contract §2.2; add `isReadOnly`).
- `frontend/app/shared/types/api.ts` (T8 — `TipoEmpleado` union → 4 values).
- `frontend/app/pages/instrumentos/crear.vue` + the instrument fill view (find it: `frontend/app/pages/instrumentos/**` or the paciente ficha fill) (T9). The bug UX: after creating from a template the instrument shows "no instrument selected"/"no puede ser llenado" — ensure the created instrument's definition loads and the fill view renders; surface `ROLE_NOT_ALLOWED` clearly; the create form's `rolesPermitidos` default should include the creator (W2 fixes the backend default; FE should not force an admin-only default).
- Notes UI on the paciente detail page (`frontend/app/pages/pacientes/**`): for PROFESORES/AUXILIARES show only their own notes (backend filters the LIST — FE just renders what it gets), allow add, HIDE edit/delete controls; respect `isReadOnly('pacientes')` → hide paciente create/edit affordances for these roles.
- Instrument fill view must render the 2 new instruments (SIGNOS_VITALES repeatable `mediciones` group with "Agregar medición"; BOLETIN_ANUAL free-text components) using the item IDs in contract §5.
- Test pattern: `frontend/tests/rbac/nav-gating.spec.ts` (MOCKED session), `frontend/tests/local-qa/*.spec.ts`.

## Acceptance criteria
1. `useDomainAccess.ts` matches contract §2.2 cell-by-cell (BE parity); `isReadOnly()` added; certificados visible for GERONTOLOGA; PROFESORES/AUXILIARES in profile allow-list; `TipoEmpleado` union updated.
2. Instrument create→fill works (regression of the gerontologa bug at the UI level): created instrument shows its definition + is fillable for an allowed role.
3. Paciente notes: PROFESORES/AUXILIARES see only their own (as returned), can add, no edit/delete controls; paciente create/edit hidden (read-only).
4. Fill view renders SIGNOS_VITALES (repeatable mediciones) + BOLETIN_ANUAL (6 components) per §5 item IDs.
5. FE Playwright specs pass; drive inputs explicitly (vmodel-const-reactive pitfall — use :model-value + handlers where child emits drop).

## Traps
- Frontend :3100, backend :3101. Beware v-model on const reactive() dropping child emits. Do NOT restart/modify backend (W2 owns it); if backend endpoints for new roles aren't ready during T10, mock them (nav-gating pattern is fully mocked) or classify TEST-ENV.

## Reporting protocol
TaskUpdate in_progress/completed. Per subtask append to `development/fixes-features-aug-6/tasks/W3-frontend/progress-report.md`. MAX 2 self-repair then TURNING-POINT-STRATEGY. On completion: completion-report.md + `SendMessage(to:"main","COMPLETE: W3 done. Deliverables: {…}")`. Never TaskCreate.

## Deliverables
1. `development/fixes-features-aug-6/tasks/W3-frontend/completion-report.md`
2. Edited useDomainAccess.ts, api.ts, instrument create/fill + notes pages + new FE specs.
