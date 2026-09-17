# W1-Research Completion Report

**Task:** Research across 5 domains for fixes-jul-8 plan.
**Status:** COMPLETE
**Output:** `tasks/W1-research/result.md` (557 lines) and copy at `02-research-fixes-jul-8.md`.

---

## Executive Summary

The 5 research domains surfaced **3 confirmed bugs/gaps** and **2 already-working features** that the task assignment assumed were missing.

### Key findings W2/W3 should know

**A. SPA Reload (priority) — NO reload trigger exists in the code.**
Exhaustive search returned zero hits for `location.reload`, `location.href =`, `router.go(0)`, `visibilitychange`, `document.hidden`, `useDocumentVisibility`. The only forced navigation is `navigateTo('/login')` on 401 in `app/composables/useApi.ts`. Perceived "page reloads" are likely caused by **session-expiry 401 redirect with no retry or toast**. Recommendation for W3: improve the 401 interceptor (retry once, skip when on `/login`, show a toast).

**B. Certificados — PUT endpoint + Zod schema ALREADY EXIST.**
The assignment told W2 to "add CertificadoUpdate schema + routes" — but `PUT /api/v1/certificates/:id` and `updateCertificateSchema = baseCertificateFields.partial()` already exist. No backend rewrite needed. The frontend edit mode on `certificados/[id].vue` already calls PUT — but the `editForm` omits `archivoUrl`, `comprobantePagoUrl`, `periodicidad`, and `periodo`, so the user can't update those via the UI today. **W3 gap to fill: add those fields to the inline edit form.**

**C. Instrumentos — `rolesPermitidos` is a comma-separated STRING, NOT an enum.**
Schema: `String @db.VarChar(255)`. No `InstrumentoRol` enum exists. Backend Zod accepts any non-empty string — no per-role validation. Frontend uses plain `<InputText>` with placeholder `Ej: ADMIN,EMPLEADO`. W3 should replace with `<MultiSelect>` sourced from `['ADMIN','EMPLEADO','AUDITOR','OPERADOR']`; W2 should add a `.refine()` to validate each comma-split value against `RolUsuario`.

**No `/instrumentos/[id]/editar.vue` route exists** — the detail page (`[id]/index.vue`) is read-only. W3 needs to create an edit page OR add inline edit mode.

**Plantilla upload UI is missing on the frontend** even though the schema/service accept it. W3 needs a file-input control.

**D. Paciente Fichas — `handleFichaSubmit` quotes verbatim in result.md (D.3).**
Two issues:
1. The handler does inline presigned-URL upload (duplicates `useFileUpload` composable). Refactor to use `useFileUpload().uploadFile(file, 'fichas')`.
2. The handler sends only `estado` (+ optional `archivoCompletado`). Backend accepts `notasObservaciones` and `fechaVencimiento` but they're never sent — the dialog has no inputs for them. Add inputs.

The **disabled condition on the pencil button is verbatim**: `:disabled="data.estado === 'VENCIDO'"` at `pacientes/[id]/index.vue:642`. VENCIDO is terminal — backend **rejects** any transition out with 400. Un-disabling the frontend button alone will not work; W2/W3 must align policy first.

**E. Nomina — Cuenta-de-cobro enforcement gap.**
`nominaPeriodoSchema.archivos` is `.optional()` in the backend Zod. The frontend dialog displays required slots via `requiredSlotsForTipo(tipo)` but **does not enforce** them before save. Result: a user can save a nomina entry with empty cuenta-de-cobro. Recommendation: W2 adds `.superRefine()` in the **service** (after resolving contrato tipo) requiring `archivos.some(a => a.tipoArchivo === 'CUENTA_COBRO')` when `tipoContrato ∈ {OPS, OBRA_O_LABOR}`; W3 disables "Guardar" when slots are empty and renders Zod `errors[]` inline.

### Cross-cutting decision matrix

| Domain | Backend | Frontend | Recommended action |
|---|---|---|---|
| A. Reload | n/a | Improve 401 interceptor | W3 only |
| B. Certificados | Already done | Add 4 fields to edit form | W3 only |
| C. Instrumentos | Add roles refine() | Replace InputText→MultiSelect; create editar.vue; add plantilla upload | W2 + W3 |
| D. Fichas | Optional: add Zod | Refactor upload; add notas/fechaVencimiento inputs; align VENCIDO | W3 primarily |
| E. Nomina | Add superRefine for cuenta-de-cobro | Disable save on empty required slot; render Zod errors | W2 + W3 |

---

## Acceptance criteria check

- [x] Every domain (A–E) has file paths + relevant code excerpts
- [x] SPA reload search reports every hit (zero) or explicit "none found"
- [x] Prisma models for CertificadoEmpresa, Instrumento, RegistroFichaCompletada (= Ficha), Nomina, NominaPeriodo quoted verbatim
- [x] `handleFichaSubmit` body fully quoted (D.3)
- [x] Disabled condition on the edit pencil fully quoted (D.4: `:disabled="data.estado === 'VENCIDO'"`)
- [x] result.md is 557 lines (under 600 limit)

---

## Files written
- `/Users/jeik/ws/mi-empresa-app-development/development/fixes-jul-8/tasks/W1-research/result.md` — primary deliverable (557 lines)
- `/Users/jeik/ws/mi-empresa-app-development/development/fixes-jul-8/02-research-fixes-jul-8.md` — orchestrator copy (identical)
- `/Users/jeik/ws/mi-empresa-app-development/development/fixes-jul-8/tasks/W1-research/completion-report.md` — this file
- `/Users/jeik/ws/mi-empresa-app-development/development/fixes-jul-8/tasks/W1-research/progress-report.md` — updated with progress sections