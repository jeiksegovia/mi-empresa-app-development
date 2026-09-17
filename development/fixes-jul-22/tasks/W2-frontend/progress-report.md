# W2-frontend — Progress Report (fixes-jul-22)

## Task #7 — FE estado UI + types [COMPLETED]

### Plan
- `pacientes/crear.vue`: hide estado Select when caller is EMPLEADO + CONTRATOS. Also drop `estado` from payload in that case so server forces ACTIVO.
- `pacientes/[id]/editar.vue`: show estado Select only for ADMIN or EMPLEADO + GERONTOLOGA. Hide and omit from payload for any other caller (CONTRATOS, AUDITOR/OPERADOR, etc.).
- Reuse `useDomainAccess` (profile = GERONTOLOGA | CONTRATOS | null) and `useAuthStore.role` for ADMIN detection.

### Implementation
- `pacientes/crear.vue`
  - Added `const { profile } = useDomainAccess()` + computed `hideEstadoCreate = profile === 'CONTRATOS'`.
  - Wrapped the `<div>…Select…</div>` for Estado with `v-if="!hideEstadoCreate"` + `data-testid="estado-field"`.
  - Build the POST payload without `estado` when `hideEstadoCreate` is true; otherwise include `form.estado`.
- `pacientes/[id]/editar.vue`
  - Added `authStore = useAuthStore()` + `profile = useDomainAccess().profile`.
  - Computed `canEditEstado = authStore.isAdmin || profile === 'GERONTOLOGA'`.
  - Wrapped the `<div>…Select…</div>` for Estado with `v-if="canEditEstado"` + `data-testid="estado-field"`.
  - Build the PUT payload without `estado` when `canEditEstado` is false; otherwise include `form.estado`.

### Verification (manual code-trace)
- crear.vue: CONTRATOS → DOMAIN_ACCESS `pacientes = 'create-only'`, `profile = 'CONTRATOS'`, `hideEstadoCreate = true` → Select hidden, payload omits `estado`. ADMIN/AUDITOR/OPERADOR/GERONTOLOGA → `profile = null` → `hideEstadoCreate = false` → Select visible, payload includes `estado`.
- editar.vue: ADMIN → `authStore.isAdmin = true` → `canEditEstado = true`. GERONTOLOGA → `profile = 'GERONTOLOGA'` → `canEditEstado = true`. CONTRATOS → `profile = 'CONTRATOS'`, `isAdmin = false` → `canEditEstado = false`. AUDITOR/OPERADOR → `profile = null`, `isAdmin = false` → `canEditEstado = false`. Backend contract: presence of `estado` triggers the 403 rule for any caller that is not ADMIN/GERONTOLOGA, so omission is the correct shape.

## Task #8 — useUnsavedGuard + wire forms [COMPLETED]

### Plan
- Create `composables/useUnsavedGuard.ts` — accept a ref/getter, install SPA-leave guard via `onBeforeRouteLeave` + browser-leave guard via `beforeunload`. Cleanup on scope dispose. Provide `markDirty`/`markClean`/`isDirty`.
- Wire into patient crear / editar, instrument crear / editar, and the dynamic fill dialog (Cancel button confirm).

### Implementation
- `frontend/app/composables/useUnsavedGuard.ts` (new): SPA `onBeforeRouteLeave` + `window.beforeunload` listener + `onScopeDispose` cleanup. `markDirty`/`markClean`/`isDirty` returned. SSR-safe (beforeunload attached only under `import.meta.client`).
- `pacientes/crear.vue`: `isDirty` ref + initialSnapshot; deep watcher flips dirty on first change; `markClean` called inside `handleSubmit` after 201; `handleCancel` clears dirty explicitly.
- `pacientes/[id]/editar.vue`: `isDirty` ref + post-load snapshot captured inside `loadPatient` after patient hydration; watcher compares current vs snapshot; `markClean` after PUT success; `handleCancel` clears dirty.
- `instrumentos/crear.vue`: `isDirty` ref; the existing `watch([...])` for `writeInstCrearDraft` now also flips dirty; `selectedTemplate` change tracked separately; `markClean` after POST success; Cancel button calls `markClean()` then `navigateTo`.
- `instrumentos/[id]/editar.vue`: same pattern — the existing draft watcher now flips dirty; `markClean` after PUT; Cancel button clears dirty.
- `pacientes/[id]/index.vue` (dynamic fill dialog): local `formDialogIsDirty` ref with watcher over `formRespuestas`, `formNotas`, `formFechaVencimiento`; Cancel button + `closeFormDialog` prompt `window.confirm` when dirty. Submit path resets dirty.

### Verification (manual code-trace)
- `useUnsavedGuard` is auto-imported by Nuxt (mirrors `useApi`, `useDomainAccess`, etc.); same `app/composables/` location.
- All four full-page forms guard both `onBeforeRouteLeave` (SPA) and `beforeunload` (browser reload/close).
- The fill dialog is a `Dialog` overlay (not a separate route), so the SPA guard doesn't apply — local confirm covers that surface. Browser-unload is also blocked at the page level since the underlying page (`/pacientes/[id]`) hasn't been navigated away from.

## Task #9 — group-info text cells + instrument UI [COMPLETED]

### Plan
- Extend `GroupInfoItem` type with `cellInput?: 'text'`.
- Add `GroupTextCellValue` type and `AnswerValue` union member.
- Render InputText matrix in `DynamicGroupInfoField.vue` when `cellInput === 'text'`; keep the legacy Dropdown path when absent.
- Update `InstrumentResultView.vue` `optionLabel()` to render text-cell answers as compact "row: col = value" list.

### Implementation
- `frontend/app/components/instrument/types.ts`
  - `GroupInfoItem` gained `cellInput?: 'text'`.
  - New `GroupTextCellValue { rowId, columnId, value }` type.
  - `AnswerValue` now also accepts `GroupTextCellValue[]`.
- `frontend/app/components/instrument/DynamicGroupInfoField.vue`
  - `isTextMode` computed from `item.cellInput === 'text'`.
  - Legacy helpers (`legacyPairs`, `legacyValueFor`, `onLegacyRowChange`) unchanged.
  - New text-mode helpers: `textCells`, `textValueFor`, `ensureFullGrid` (rebuilds the full N×M grid preserving any existing values), `onTextCellChange`.
  - Template renders `<table>` of `InputText` per row×column when text mode; `data-testid="text-matrix-${item.id}"` + per-cell `data-testid="text-cell-${item.id}-${rowId}-${columnId}"`.
- `frontend/app/components/instrument/InstrumentResultView.vue`
  - `optionLabel()` detects `cellInput === 'text'` and renders a `row: col = value` compact string, omitting empty cells.
- `scoring.ts` — no change needed. `itemScore()` only scores `single-select-scored`; `group-info` (both modes) is already non-scored. `hasAnswerFor` treats any non-empty array as answered, which matches §5.3 semantics (text-cell answer is a full N×M grid so it's "answered" as soon as the dialog is opened).

### Verification (manual code-trace)
- MNA_CUADRO v2's `frecuencia_grupos` declares `cellInput: "text"`. The renderer now draws a 7-row × 4-column InputText grid. On every edit, `onTextCellChange` emits `GroupTextCellValue[]` containing all 28 coordinates (preserving any untouched cells with `value: ''`).
- BARTHEL, MINI_MENTAL, TINETTI v2, YESAVAGE, FICHA_NUTRICIONAL, VALORACION_INTEGRAL have NO `cellInput` flag → the existing Dropdown path renders unchanged.

## Task #10 — FE smoke specs [IN_PROGRESS]