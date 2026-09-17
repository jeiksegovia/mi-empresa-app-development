# QA jul-11 feedback — fixes plan

**Source**: `context/user-feedback/qa-jull-11-raw.md` (raw Spanish transcript, cleaned + deduplicated below).
**Date**: 2026-07-11. **Scope**: local working tree (uncommitted); no staging deploy in this plan.

---

## 1. Cleaned QA insights (from raw transcript)

### Bugs (P0)
| ID | Symptom (QA words, cleaned) | Root cause found |
|---|---|---|
| B1 | "Asignar y completar" en fichas no guarda nada, sin feedback | PrimeVue `DatePicker` v-model is a `Date` → JSON-serialized as ISO timestamp (`2026-08-04T05:00:00.000Z`) → `createFichaSchema.fechaVencimiento` regex `^\d{4}-\d{2}-\d{2}$` rejects → 400. Error toast invisible (see B3). The status-change dialog works because `updateFichaStatusSchema.fechaVencimiento` has **no regex** — matches QA exactly. |
| B2 | Nueva nota de paciente no se guarda desde UI (backend sí funciona) | Same Date-object bug on `fechaIncidente` (same anchored regex in `createNoteSchema`). |
| B3 | Ningún feedback de error en pacientes | `pacientes/[id]/index.vue` has **no `<Toast />` outlet** and no layout-level Toast — every `toast.add()` on that page renders nothing. |
| B4 | Archivos de certificado "se pierden": campos retienen archivos viejos al crear; archivo/comprobante de una actualización no aparecen como versión actual | **(a-ROOT, found during test execution)**: both parents bound `v-model="firstUpdate"` / `v-model="addUpdateForm"` where the target is a `const reactive(...)` — the compiled reassignment on `update:modelValue` silently no-ops, so the child's emitted `archivoUrl`/`comprobantePagoUrl` NEVER reached the parent. Notas/fechas "worked" because Textarea/date inputs mutate the object's properties directly. Every UI-attached certificate file since the shared-form refactor (jul-9) was silently dropped. Fixed with explicit `:model-value` + `@update:model-value` → `Object.assign`. (a2) `CertificateUpdateForm` restored stale IDB-stashed files on mount showing a chip with null `archivoUrl`; `clearDraft()` never cleared the IDB stash and nothing cleared on cancel → `reset()` + re-upload-on-restore. (b) Backend `addCertificateUpdate` never propagated `comprobantePagoUrl` to the parent snapshot. (c) staging "root 2026" 404s = corrupted pre-W11 uploads (already-fixed bug); handled via reset utility, no code change. |

### Improvements (P1)
- **I1** `/empresa` view mode: show read-only cargos catalog (currently edit-mode only).
- **I2** Instrumentos roles permitidos ↔ cargos de empresa: options come from `GET /empresa/cargos` (+ ADMIN always, default-selected) instead of hardcoded EMPLEADO/AUDITOR/OPERADOR.
- **I3** Plantilla download filename: add date → `{instrumento}_{paciente}_{YYYY-MM-DD}.{ext}`.
- **I4** Fichas historial: download action per row (archivoCompletado).
- **I5** Empleados detalle: tabs header overflows → horizontal scroll.
- **I6** Novedades: detail popup, truncated text in list, download adjunto in list + detail.
- **I7** Nómina: spinner on every file input slot + on Guardar.
- **I8** Nómina: "Ver detalles" action per row to view/download archivos.
- **I9** Staging DB reset utility (developer-authorized, staging-only, never auto-run).

### Why QA/regression didn't catch B1/B2 (transcript asks explicitly)
1. `local-qa/jul9-nota-fecha-incidente.spec.ts` creates the note **via `page.request.post` (API)**, then only asserts rendering — the "Nueva Nota" dialog (and its DatePicker) is never driven.
2. `local-qa/jul10-ficha-single-step.spec.ts` submits **without filling the optional `fechaVencimiento` DatePicker** — the conditional spread omits the field, so the regex never fires in tests.
3. No global `<Toast />` means silent failures are also silent in specs — nothing asserts error feedback.
4. Backend specs use correct string dates — they can't see a frontend serialization bug.

**Process rules adopted (W4):** every save/POST button gets at least one UI-driven spec; at least one spec variant fills ALL optional fields (esp. DatePickers); error paths assert visible feedback.

---

## 2. Waves

- **W1 backend**: normalize date inputs (accept ISO or YYYY-MM-DD via Zod preprocess) in `patients.routes.ts`; propagate `comprobantePagoUrl` in `addCertificateUpdate`; ensure `archivoCompletado` in patient payload for I4.
- **W2 frontend core**: `toYMD()` util + use in the 3 pacientes submit handlers; `<Toast />` in `layouts/default.vue` (remove page duplicates); `CertificateUpdateForm.reset()` (files+model+IDB+draft) wired to create-success/cancel/dialog-close; on-mount restore re-uploads stashed file when `archivoUrl` is null.
- **W3a UI** (sub-agent, sonnet): nómina spinners + ver-detalles dialog; empleados tabs scroll; novedades truncation + detail dialog.
- **W3b UI**: empresa cargos view card; instrumentos roles from cargos (crear + editar, relax backend Zod if enum-bound); plantilla filename date; fichas historial download button.
- **W4 tests**: backend regression specs (ISO dates, cert propagation); frontend UI-driven specs (nota via dialog, single-step with fecha, cert stash cleanup). Run suites.
- **W5**: staging reset script (guarded, not executed) + `context/plan-implemented/qa-jul-11-fixes-implemented.md`.
