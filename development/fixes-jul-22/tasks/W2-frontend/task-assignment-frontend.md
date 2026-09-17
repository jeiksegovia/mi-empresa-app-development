# task-assignment-frontend (W2)

## Your Role
You are **frontend-eng**. Match PrimeVue/Nuxt patterns, Spanish UI, English code, data-testid hooks.

## Project Context
Slug: `fixes-jul-22`  
CWD: `/Users/jeik/ws/mi-empresa-app-development`  
Worker 2 of 3. Backend DONE. Contract is SSOT.

## AUTHORITATIVE CONTRACT
`development/fixes-jul-22/orchestration-ctx/decisions/schema-contract-fixes-jul-22.md`  
**Do not invent names from schema.prisma** — use the contract.

## Task Type
IMPLEMENTATION

## TaskList IDs
| ID | Title |
|----|-------|
| **7** | FE estado UI + types |
| **8** | useUnsavedGuard + wire forms |
| **9** | group-info text cells + instrument UI |
| **10** | FE smoke specs |

## Source Files to Modify
- `frontend/app/pages/pacientes/crear.vue` — hide estado for CONTRATOS only
- `frontend/app/pages/pacientes/[id]/editar.vue` — show estado only GERONTOLOGA/ADMIN
- `frontend/app/composables/useUnsavedGuard.ts` — **NEW**
- Wire dirty guard: patient crear/editar, instrument complete/dynamic form page(s)
- `frontend/app/components/instrument/DynamicGroupInfoField.vue` (+ types if needed) — `cellInput: "text"`
- Result/audit views if needed for text cells
- `frontend/tests/**` smokes for estado hide, unsaved, matrix text

## FIRST ACTION
0. pwd project root or BLOCKED  
1. TaskUpdate 7 in_progress  
2. Read contract §§1,3,4 fully + existing crear.vue / DynamicGroupInfoField.vue

## Acceptance Criteria
1. CONTRATOS on `/pacientes/crear`: no Activo/Inactivo control; payload omits estado (server forces ACTIVO).
2. Edit patient: estado Select only for GERONTOLOGA or ADMIN (not CONTRATOS).
3. `useUnsavedGuard`: dirty → route leave confirm + beforeunload.
4. Wired on patient crear/editar + instrument fill form; clean after successful save.
5. group-info with `cellInput: "text"` renders InputText per cell; answers match contract shape `{rowId,columnId,value}[]`.
6. Legacy group-info without cellInput keeps prior select behavior.
7. FE smokes green (mocked OK for RBAC UI; live optional).
8. No backend/** edits.

## I1 clarified
Hide estado **only on create** for CONTRATOS. Edit ownership = GERONTOLOGA + ADMIN.

## Boundaries
frontend/** + development/fixes-jul-22/tasks/W2-frontend/** only  
No git commit

## Progress / completion
- `development/fixes-jul-22/tasks/W2-frontend/progress-report.md`
- `development/fixes-jul-22/tasks/W2-frontend/completion-report.md`

## Reporting Protocol
1. TaskUpdate 7–10 as you complete  
2. Append progress sections  
3. On all done: SendMessage main  
   `COMPLETE: W2-frontend done. estado UI + unsaved guard + text matrix + smokes. See tasks/W2-frontend/completion-report.md`  
4. Never idle without COMPLETE/BLOCKED/WAITING/TURNING-POINT-*  
5. Never TaskCreate; never message other workers  

Start NOW.
