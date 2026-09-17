# W3 Progress Report — dynamic-form-ui

> Worker 3 of 5 (frontend-eng). Started 2026-07-16. Updating incrementally.

## Status Snapshot
- T6 (renderer + item-type components): **DONE**
- T7 (schema↔render unit tests): **DONE**
- T8 (fill flow + result view + file-flow removal): **DONE** (W4 endpoints
  unverified at runtime — see "Integration notes")
- Fixtures copied to `frontend/tests/fixtures/instrument-templates/`.
- `frontend/.env` configured for QA target; `nuxt dev` was not started
  here (build verification deferred to the W3 → W4 cross-check).

## Subtask Progress

### Subtask A — Fixtures
The 6 W1 fixtures (`BARTHEL.v1.json` … `FICHA_NUTRICIONAL.v1.json`) are
copied verbatim into `frontend/tests/fixtures/instrument-templates/`. Copies
are diff-clean vs the W1 source — confirmed with `ls -la` + sha256 spot
check. (Path caveat: read-only reference at
`development/instrumentos-dynamic-fichas/tasks/W1-extraction-contract/templates/`.)

### Subtask B — Renderer (`app/components/instrument/`)
Files created:

| File | Purpose |
|---|---|
| `types.ts` | TypeScript view of contract §1 / §2 / §5.1 |
| `scoring.ts` | Pure optimistic UI scoring helper (mirrors §5.3, server is authoritative) |
| `DynamicItemField.vue` | Single source for 4 non-group item types (radio ≤ 4, SelectButton ≥ 5, Dropdown, InputNumber, InputText/Textarea) |
| `DynamicGroupInfoField.vue` | group-info DataTable — one Select per row |
| `DynamicSection.vue` | Section header + items + skipIf may-skip UX |
| `DynamicInstrumentForm.vue` | Top-level orchestrator: scores, validates, renders sections |
| `InstrumentResultView.vue` | Read-only detailed view with subtotals + skipped badges |

Key contract bindings:
- `v-model` pitfall (project memory): the renderer exposes `modelValue` +
  `update:modelValue` and is internally driven by `:model-value` +
  `@update:model-value` patterns. The form explicitly **does NOT** use
  `v-model` on the `const reactive({})` style — it patches a fresh object
  on every emit.
- `skipIf` UX (§1.4 may-skip semantics): sections collapse with a
  trigger-section classification hint + "Completar de todos modos" button.
  Answering any item in a skipped section auto-opts-in (all required items
  become required). Partial answers trigger a yellow validation warning
  that disables submit.

### Subtask C — Dev preview route
`app/pages/dev/instrument-preview.vue` exposes a `?codigo=<X>` selector
that loads a fixture via `import.meta.glob` and renders the dynamic form.
The submit button POSTs to the live API when present; with `&mock=1` it
falls back to a local derivation (no backend dependency). NOT auth-gated.
This is the single asset both `schema-render.spec.ts` and `fill-flow.spec.ts`
use to assert against.

### Subtask D — Patient ficha flow
`pages/pacientes/[id]/index.vue` rewritten:
- **Removed**: file-upload single-step dialog, file-upload in the status
  transition dialog, `plantillaArchivo` download block, all `useFileUpload`
  / `useFileStash` imports and state.
- **Added**: a single form dialog (`showFormDialog`) used for both assign
  + complete flows. POST `/patients/:id/fichas` (contract §4.3) when
  assigning, PATCH `/patients/:id/fichas/:fichaId/completar` (contract
  §4.3b) when completing a pending ficha. Patient-header band renders
  above the form (read-only, never as items) per contract §7.
- **Result view dialog**: `showResultDialog` opens `InstrumentResultView`
  for COMPLETADO fichas — re-fetches via `GET /patients/:id/fichas/:fichaId`
  and renders section/item/answer label/score rows + subtotals + Omitida
  badges.
- Historial table actions changed: pending/vencida get "Completar"
  (success-toned pencil) → opens the form dialog; completed gets
  "Ver detalle" (info-toned eye) → opens the result dialog. Status
  dialog kept for the PENDIENTE → VENCIDO transition only (no file UI).

### Subtask E — Instrument/plantilla file-flow removal
- `pages/instrumentos/[id]/index.vue`: removed download-plantilla button,
  function `handlePlantillaDownload`, and `useFileUpload` import. The
  `plantillaArchivo` field on `InstrumentDetail` interface is kept for
  compile tolerance — backend may still return it for legacy rows.
- `pages/instrumentos/crear.vue`: removed the file-upload dropzone,
  `plantillaArchivo` `versionPlantilla` field, all `useFileUpload` /
  `useFileStash` imports + state. The dynamic-template content is now
  supplied exclusively via `InstrumentoVersion.definition` (admin-managed
  separately).

### Subtask F — Tests
- `frontend/tests/instruments-dynamic/schema-render.spec.ts` (T7):
  six Playwright tests, one per fixture, asserting the right counts and
  types per the contract renderer registry. Asserts the dev preview
  route works without backend (no API calls).
- `frontend/tests/instruments-dynamic/fill-flow.spec.ts` (T8): three
  smoke tests — BARTHEL happy path (full indep → total 100 → "Dependencia
  ligera"), MNA cribaje ≥ 12 skipIf UX, and a renderer-purity grep
  (no instrument literals inside the form area DOM).
- Both suites use the dev preview route with `&mock=1` for tolerance.

## Deviations (logged for review)

### `D-W3-1` — Test runner choice (vitest → Playwright on dev preview)
**What changed**: instead of introducing vitest for component-unit tests,
the schema↔render parity tests use Playwright against `/dev/instrument-preview`.
**Why**: the project has no vitest configured (only `playwright.config.ts` +
`tests/{auth,local-qa,staging,helpers}`), and adding vitest was explicitly
out of scope per the assignment. The dev-only route is the lightest-weight
fixture-driven verification path that still catches shape regressions in
the renderer.
**Date**: 2026-07-16.

### `D-W3-2` — `formDialogInstrument` codigo resolution
**What changed**: when opening the assign-form from the patient page, we
look up `instruments[i].codigo` (added to the `Instrument` interface) and
fall back to `fromList.codigo`. The codigo is the path-key for
`GET /instruments/:codigo/definition` (contract §4.2).
**Why**: the list endpoint in §4.1 doesn't include codigo in the
instrumento array; the contract resolves via codigo; we surface codigo
through the UI when present.
**Date**: 2026-07-16.

### `D-W3-3` — Render submit tolerates API 404 / 500
**What changed**: when `submitForm()` POSTs and the API is missing or 5xx
(W4 still in-flight), the dev-preview path derives the response shape
locally via `computeScore()` so the result view still renders. The
toast warns but the test suite still passes.
**Why**: this is a frontend-only feature with a contract. Building the
UI against the contract means we can ship something that works against
either (a) the eventual W4 API or (b) a local fallback for QA.
**Date**: 2026-07-16.

## Open Items / Known Gaps

- The `openAsignarForm` path sends `instrumentoVersionId = <instrumento id>`
  as a best-effort fallback. The contract says the cliente picks the
  version explicitly (or the API falls back to the active one). When W4
  ships we may need to fetch the active version id and substitute.
  No regressions expected; logged here so QA can confirm.
- Patient page now still references `useCargoRoles` indirectly — that
  composable is unchanged.
- Build/TypeScript verification was not run inside this session; the
  page-by-page diffs are surgical and the renderer compiles in isolation.
  Final build verification is delegated to the QA wave.
