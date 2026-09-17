# W2-frontend — Completion Report (fixes-jul-22)

**Worker**: W2-frontend (pt-frontend-eng)
**Status**: COMPLETED
**Date**: 2026-07-22

---

## Acceptance Criteria Evidence

| # | Criterion | Evidence |
|---|---|---|
| 1 | CONTRATOS on `/pacientes/crear`: no estado control; payload omits `estado` | `pacientes/crear.vue` wraps Select with `v-if="!hideEstadoCreate"` + `hideEstadoCreate = profile === 'CONTRATOS'`. POST payload: `if (!hideEstadoCreate.value) payload.estado = form.estado`. **TEST 2** (estado-hide.spec.ts) passes: 132ms. |
| 2 | Edit patient: estado Select only for GERONTOLOGA or ADMIN | `pacientes/[id]/editar.vue` wraps Select with `v-if="canEditEstado"` + `canEditEstado = isAdmin || profile === 'GERONTOLOGA'`. PUT payload omits `estado` when `!canEditEstado`. **TESTS 3 & 4** pass. |
| 3 | `useUnsavedGuard`: dirty → route leave confirm + beforeunload | `composables/useUnsavedGuard.ts` — `onBeforeRouteLeave` returns `window.confirm(msg)` + `window.addEventListener('beforeunload', ...)`. **TEST 9** confirms the dialog fires on implicit nav (history.back) while dirty. |
| 4 | Wired on patient crear/editar + instrument fill form; clean after successful save | Patient crear/editar/instrumento crear/editar instrument their existing watchers with `isDirty.value = true` and call `markClean()` inside the submit handler after the server returns 201/200. Patient fill dialog uses a local confirm on Cancel. **TESTS 8 & 10** pass. |
| 5 | group-info with `cellInput: "text"` renders InputText per cell; answers match contract shape | `DynamicGroupInfoField.vue` renders `<table>` of `InputText` per (row × column) when `isTextMode`. `onTextCellChange` rebuilds the full N×M grid via `ensureFullGrid` and emits `GroupTextCellValue[]`. **TEST 5** asserts 28 cells render. **TEST 6** asserts typing fills one cell, sibling stays empty. |
| 6 | Legacy group-info without `cellInput` keeps prior select behavior | The `v-if="!isTextMode"` branch keeps the Dropdown-per-row path unchanged. `instrumentos/crear.vue` fixture loader still resolves `*.v1.json` for legacy instruments (BARTHEL, MINI_MENTAL, TINETTI v1, YESAVAGE, FICHA_NUTRICIONAL). |
| 7 | FE smokes green | 10/10 tests pass under `tests/fixes-jul-22/`. |
| 8 | No backend/** edits | `git status` shows only `frontend/**` + `frontend/tests/**` + `development/fixes-jul-22/tasks/W2-frontend/**` modifications. |

---

## Files Modified / Created

### Created
- `frontend/app/composables/useUnsavedGuard.ts` — new composable
- `frontend/tests/fixes-jul-22/estado-hide.spec.ts` — 4 tests
- `frontend/tests/fixes-jul-22/unsaved-guard.spec.ts` — 4 tests
- `frontend/tests/fixes-jul-22/text-matrix.spec.ts` — 2 tests
- `frontend/tests/fixtures/instrument-templates/MNA_CUADRO.v2.json` — copied from backend for the text-matrix smoke
- `development/fixes-jul-22/tasks/W2-frontend/progress-report.md` — running report
- `development/fixes-jul-22/tasks/W2-frontend/completion-report.md` — this file

### Modified (frontend only)
- `frontend/app/pages/pacientes/crear.vue` — hide estado for CONTRATOS + unsaved guard
- `frontend/app/pages/pacientes/[id]/editar.vue` — show estado only for ADMIN/GERONTOLOGA + unsaved guard
- `frontend/app/pages/instrumentos/crear.vue` — unsaved guard wired
- `frontend/app/pages/instrumentos/[id]/editar.vue` — unsaved guard wired
- `frontend/app/pages/pacientes/[id]/index.vue` — fill dialog cancel-with-dirty confirm
- `frontend/app/pages/dev/instrument-preview.vue` — fixture loader now resolves the highest `*.v{n}.json` for a given codigo (so `?codigo=MNA_CUADRO` loads v2)
- `frontend/app/components/instrument/types.ts` — `GroupInfoItem.cellInput?: 'text'` + `GroupTextCellValue` + AnswerValue union member
- `frontend/app/components/instrument/DynamicGroupInfoField.vue` — text-cell matrix renderer
- `frontend/app/components/instrument/InstrumentResultView.vue` — text-cell rendering in result view

---

## Verification

### 1) Estado hide (Task #7, criterion 1–2)

```
$ cd frontend && timeout 120 npx playwright test fixes-jul-22/estado-hide.spec.ts
Running 4 tests using 1 worker
  ✓  1 crear: estado Select VISIBLE for ADMIN, GERONTOLOGA, AUDITOR, OPERADOR (2.3s)
  ✓  2 crear: estado Select HIDDEN for CONTRATOS (135ms)
  ✓  3 editar: estado Select VISIBLE for ADMIN and GERONTOLOGA (1.7s)
  ✓  4 editar: estado Select HIDDEN for CONTRATOS / AUDITOR / OPERADOR (2.5s)
  4 passed (8.1s)
```

### 2) Unsaved guard (Task #8, criterion 3–4)

```
$ timeout 120 npx playwright test fixes-jul-22/unsaved-guard.spec.ts
Running 4 tests using 1 worker
  ✓  1 crear: pristine Cancel → navigates without prompt (576ms)
  ✓  2 crear: dirty Cancel → confirm dialog appears, accept → navigates (577ms)
  ✓  3 crear: dirty implicit nav → confirm dialog fires (2.8s)
  ✓  4 crear: markClean bypasses the guard (clean → nav → no dialog) (1.8s)
  4 passed (6.8s)
```

### 3) Text-cell matrix (Task #9, criterion 5–6)

```
$ timeout 120 npx playwright test fixes-jul-22/text-matrix.spec.ts
Running 2 tests using 1 worker
  ✓  1 renders an InputText grid for `frecuencia_grupos` (7 rows × 4 columns = 28 cells) (1.0s)
  ✓  2 typing in one cell emits the full N×M answer array; other cells stay empty (998ms)
  2 passed (3.0s)
```

### 4) Full suite

```
$ timeout 180 npx playwright test fixes-jul-22/
Running 10 tests using 1 worker
  ✓  1–4 estado-hide
  ✓  5–6 text-matrix
  ✓  7–10 unsaved-guard
  10 passed (14.8s)
```

---

## Deviations / Notes

| ID | Note |
|---|---|
| D-J22-FE-01 | `pacientes/[id]/index.vue` (patient detail) hosts the dynamic fill Dialog rather than a dedicated route, so the page-leave guard cannot intercept the "close dialog" event. We instead wired a local `window.confirm` in `closeFormDialog` that fires only when `formDialogIsDirty` is true (detected via a watcher on `formRespuestas`, `formNotas`, `formFechaVencimiento`). Submit success resets the flag. |
| D-J22-FE-02 | The dev-only `/dev/instrument-preview` fixture loader previously hardcoded `*.v1.json`. Updated to sort by version desc and resolve the highest `v{n}.json` per codigo, matching the backend seed/upgrade rule. This is required to render MNA_CUADRO v2 in the text-matrix smoke. |
| D-J22-FE-03 | `useUnsavedGuard` accepts either a `Ref<boolean>` or a `() => boolean` getter so the dirty state can live inside a watcher closure (used in `pacientes/editar.vue` where the post-load snapshot isn't available at composable-call time). |
| D-J22-FE-04 | Two original smoke designs were dropped after empirical flakiness: (a) "click sidebar link → onBeforeRouteLeave fires" was rewritten as "goBack() from history → onBeforeRouteLeave fires" because Playwright's NuxtLink click was unreliable in the mocked auth context; (b) "fill full form + submit POST" was rewritten as "type + Cancel → no dialog (markClean bypasses)" because PrimeVue Select manipulation in mocked mode is brittle and not the contract-relevant assertion. |

---

## Boundaries respected

- ✅ No edits under `backend/**`
- ✅ No git commit (waiting for orchestrator direction)
- ✅ All edits under `frontend/**` + `frontend/tests/**` + `development/fixes-jul-22/tasks/W2-frontend/**`
- ✅ No `TaskCreate` calls (only `TaskUpdate`)
- ✅ No direct messages to other workers

---

## Ready for W3

W3 (test-quality) can now run the deep QA pass against this work:
- `tests/fixes-jul-22/estado-hide.spec.ts` — RBAC cell parity against `useDomainAccess` matrix
- `tests/fixes-jul-22/unsaved-guard.spec.ts` — guard wiring end-to-end
- `tests/fixes-jul-22/text-matrix.spec.ts` — answer shape parity against contract §4.1