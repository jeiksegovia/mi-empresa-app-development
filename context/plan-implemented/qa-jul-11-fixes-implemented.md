# qa-jul-11-fixes — implemented

**Source plan**: `context/implementation-plan/qa-jul-11-fixes.md` · **Feedback**: `context/user-feedback/qa-jull-11-raw.md` · **Date**: 2026-07-11 · **Scope**: local working tree only (no deploy, no commit).

## High-level overview

All 4 P0 bugs and 9 improvements from the jul-11 QA transcript implemented and verified. Two silent-failure root causes were confirmed by driving the REAL UI controls in Playwright (the exact thing prior specs avoided): (1) PrimeVue DatePicker Date-object serialization vs anchored YYYY-MM-DD Zod regexes, and (2) a `v-model`-on-`const reactive` no-op that dropped every UI-attached certificate file since jul-9.

## Bugs fixed (grep: B1 B2 B3 B4 dateYMD toYMD v-model-noop stash-reset comprobantePago-propagation)

- **B1 fichas asignar-y-completar silent fail** — DatePicker emits `Date` → JSON ISO timestamp → `createFichaSchema.fechaVencimiento` regex 400. Fix both sides: `dateYMD` Zod preprocess (`backend/src/routes/patients.routes.ts` — normalizes ISO-like strings to date part; applied to fechaVencimiento, fechaIncidente, fechaNacimiento, fechaCumpleanos) + `toYMD()` util (`frontend/app/utils/date.ts`) used in `handleSingleStepSubmit`, `handleNoteSubmit`, `handleFichaSubmit` (`pacientes/[id]/index.vue`).
- **B2 notas no se guardan desde UI** — same root cause on `fechaIncidente`; same fix.
- **B3 no error feedback** — `pacientes/[id]/index.vue` had NO `<Toast/>` outlet. Fix: single global `<Toast/>` in `layouts/default.vue`; removed 10 per-page duplicates (double-toast prevention).
- **B4 certificate files "lost"** — three stacked causes:
  1. **ROOT (found while testing, not in the transcript)**: `certificados/crear.vue` and `certificados/[id].vue` bound `v-model` to `const reactive(...)` mirrors; the compiled reassignment on `update:modelValue` silently no-ops, so the child's `archivoUrl`/`comprobantePagoUrl` never reached the parents → first-update never POSTed / updates POSTed without files. Fixed with `:model-value` + `@update:model-value="(v) => Object.assign(target, v)"`.
  2. `CertificateUpdateForm` mount-restore showed a stale IDB-stashed file chip with null `archivoUrl` (silent no-op) and `clearDraft()` never cleared the IDB stash; nothing cleared on cancel. Fixed: exposed `reset()` (files + model + IDB + sessionStorage), wired to create-success, both Cancel buttons (`onCancel`), dialog dismiss (pre-flush watcher on `showAddUpdateDialog`); mount-restore now RE-UPLOADS a stashed file when no key exists so the chip always maps to a persisted S3 key.
  3. `certificateService.addCertificateUpdate` propagated archivoUrl/fechas to the parent snapshot but never `comprobantePagoUrl`. Fixed.
  - Staging "root 2026" 404s: corrupted pre-W11 uploads (bug already fixed jul-10); no code change — covered by the reset utility.

## Improvements (grep: cargos-view roles-cargos plantilla-fecha ficha-download tabs-scroll novedades-detail nomina-spinner nomina-detalles reset-staging)

- **I1** `/empresa` view mode: read-only "Catálogo de Cargos" card (`empresa-cargos-view`, `empresa-cargo-chip`).
- **I2** instrumentos roles ↔ cargos: new `composables/useCargoRoles.ts` (ADMIN + active cargo names + merge of already-selected legacy values); wired in `instrumentos/crear.vue` (ADMIN default-selected) and `instrumentos/[id]/editar.vue`. Backend `refineRolesPermitidos` relaxed from RolUsuario enum to shape rules (items ≤100 chars, total ≤255) — column is descriptive; `requireInstrumentWriter` never reads it.
- **I3** plantilla filename now `{instrumento}_{paciente}_{YYYY-MM-DD}.{ext}` (`downloadPlantillaRenamed`).
- **I4** fichas historial download button (`ficha-historial-download`) — backend `getPatient` now returns `archivoCompletado` per registro.
- **I5** empleados detalle tabs: `overflow-x-auto flex-nowrap` + `whitespace-nowrap flex-shrink-0`.
- **I6** novedades: descripcion `line-clamp-2` + detail dialog (`novedad-detail-dialog`, `novedad-view-btn`, `novedad-detail-download`).
- **I7** nómina: per-slot upload spinners (`uploadingSlots`, `nomina-slot-uploading`) + `savingEntrada` loading on Guardar.
- **I8** nómina "Ver detalles" (`nomina-view-details`, `nomina-details-dialog`, `nomina-detail-download`) — read-only dialog with all archivos downloadable, visible to all users.
- **I9** `backend/infrastructure/db/scripts/reset-staging-db.sh` — staging-only (refuses STAGE≠staging and any URL containing "prod"), interactive confirmation phrase, pre-reset dump to backups bucket, `migrate deploy`, empresa+7-cargos re-seed. **Never executed automatically; developer-run only.** Guard behavior verified locally.

## Why QA missed it (grep: qa-gap ui-driven datepicker-spec optional-fields)

1. `jul9-nota-fecha-incidente.spec.ts` created notes **via API** and only asserted rendering — the dialog + DatePicker were never driven.
2. `jul10-ficha-single-step.spec.ts` left the optional DatePicker **empty** — the conditional spread omitted the field, so the regex never fired under test.
3. `jul8-cert-crear-with-update.spec.ts` explicitly avoided the file/update UI ("PrimeVue controls flaky") and proved the contract **via API** — hiding the v-model no-op entirely.
4. No Toast outlet meant failures were silent for humans AND untestable for specs.

**Rules adopted**: every save/POST button needs ≥1 spec driving the real controls; ≥1 variant fills ALL optional fields (DatePickers included); error/success paths assert visible feedback (`.p-toast-message`).

## Tests (grep: jul11 regression)

- NEW backend `tests/patients/jul11-date-normalization.spec.ts` (4) + `tests/certificates/jul11-update-propagation.spec.ts` (3) — 7/7 pass.
- REWRITTEN `tests/instruments/roles-refinement.spec.ts` for the cargo-name contract — 7/7 pass.
- NEW frontend `tests/local-qa/jul11-notas-ui-create.spec.ts`, `jul11-ficha-single-step-fecha.spec.ts`, `jul11-cert-stash-clear.spec.ts` — 3/3 pass (real DatePicker driving via `.p-datepicker-panel` today-cell).
- Regression runs: backend patients/certificates/instruments suites green except 2 **pre-existing** failures verified present on unmodified code (`certificates.spec.ts:108` tipo=RUT enum-500 flake; `instruments.spec.ts:478` record-update). Frontend: jul8/jul9/jul10 cert+nomina+ficha suites 9+16 pass.
- Env reminder: backend suites need `TEST_API_URL=http://localhost:3101`; frontend suites need `TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1` (sameSite=strict).

## Deviations from plan

- B4 gained the v-model root cause mid-execution (test-first exposure); the stash fix alone would NOT have fixed QA's "archivo no aparece" complaint.
- `updateFichaStatusSchema.fechaVencimiento` left regex-less (already ISO-tolerant); frontend normalizes anyway.
- Novedades list already had per-file download buttons; only detail dialog + truncation were added.

## Not done / follow-ups

- Staging deploy of these fixes (separate release cycle; runbook `staging-release-jul10-runbook.md` pattern).
- Pre-existing failures above; `pacientes/[id]` tabs (3) not given scroll (no overflow).
- Prod equivalent of reset utility intentionally forbidden.
