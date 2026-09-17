# W2 Frontend Wave — Completion Report

**Task IDs:** 29 (T5) + 30 (T6)
**Worker:** W2 (pt-frontend-eng)
**Date:** 2026-07-10
**Wave:** 2 of 4 (next-release-jul-10)
**Plan ref:** `development/next-release-jul-10/orchestration-ctx/team-plan-next-release-jul-10.md`
**API contract:** `orchestration-ctx/decisions/schema-contract-jul10.md` §5 (C1/C2/C3), §4 (E1), §5.C (tipoEmpleado)
**Origins:** `context/user-feedback/qa-session-jul-9-reinterpreted.md` §3.1–3.3, §5.1

---

## TL;DR

T5 + T6 landed and browser-verified end-to-end (0 console errors). Single-step
ficha creation (assign + complete in one dialog), client-side plantilla rename,
C3 create-instrument shortcut with return round-trip, and E1 uppercase-as-you-type
on all 8 listed nombre inputs. tipoEmpleado is API-only (no user-management UI
exists — documented). All jul-8/jul-9 fichas/nota regression specs pass; a new
jul10 local-qa spec (3 tests) passes.

---

## Deliverables

| # | Item | Path | Status |
|---|---|---|---|
| 1 | T5 single-step dialog + descargar plantilla | `frontend/app/pages/pacientes/[id]/index.vue` | DONE |
| 2 | C3 shortcut return handling | `frontend/app/pages/instrumentos/crear.vue` | DONE |
| 3 | E1 uppercase (8 files) | cert/instrumento/paciente/empleado/empresa forms | DONE |
| 4 | NEW jul10 spec (3 tests, green) | `frontend/tests/local-qa/jul10-ficha-single-step.spec.ts` | DONE |
| 5 | Updated obsolete e2e test | `frontend/tests/e2e/paciente-fichas.spec.ts` | DONE |
| 6 | result.md (per-task + browser notes) | `tasks/W2-frontend/result.md` | DONE |
| 7 | progress-report.md | `tasks/W2-frontend/progress-report.md` | DONE |
| 8 | completion-report.md | `tasks/W2-frontend/completion-report.md` | THIS FILE |

Constraints honored: composables + nuxt.config.ts untouched; no git commit;
backend/frontend not restarted; all pre-existing `data-testid` preserved.

---

## Test results summary

| Suite | Tests | Pass | Skip | Fail | Notes |
|---|---:|---:|---:|---:|---|
| `jul8-fichas-*` + `jul8-ficha-file-reset` + `jul9-nota-*` | 8 | 6 | 2 | 0 | renewal + draft/stash intact |
| `jul10-ficha-single-step.spec.ts` (NEW) | 3 | 3 | 0 | 0 | single-step / C3 / E1 |
| `e2e/paciente-fichas.spec.ts` | 8 | — | — | 7 | pre-existing harness login/nav failure (see below) |

Run env: `TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1`

---

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|:---:|---|
| 1 | Select opens combined dialog; one-step COMPLETADO | ✅ | patient 85: registro 12→13, new COMPLETADO row |
| 2 | Descargar plantilla renamed filename | ✅ | `Ficha_de_Valoración_Médica_Inicial_Paciente_T4.pdf` |
| 3 | Renewal (pencil) incl. VENCIDO→COMPLETADO | ✅ | jul8 specs pass; dialog opens with `#newEstado` |
| 4 | jul8/jul9 specs still pass | ✅ | 6 pass / 2 skip |
| 5 | Uppercase-as-you-type on all listed inputs | ✅ | "PRUEBA JUL10 SHORTCUT"; 8 files edited |
| 6 | C3 shortcut round-trips | ✅ | returned to `/pacientes/85` after create |
| 7 | No console errors | ✅ | 0 errors across all flows |

---

## Deviations / notes

1. **tipoEmpleado is API-only.** No usuarios/user-management UI exists anywhere
   (`app/pages/**`, `app/components/**`, sidebar). `tipoEmpleado` is on `Usuario`,
   not `Empleado`, so the empleado form does not map to it. Per the assignment's
   fallback, no Select was added; documented in result.md with the exact spec for
   when the surface is built.
2. **Old "Asignar Instrumento" button removed by design** (single-step replaces
   the 2-step assign). The obsolete e2e test asserting that button was rewritten
   to the new behavior.
3. **e2e/paciente-fichas suite (7 fail) is pre-existing.** Failure is inside the
   shared `goToPacientes()` UI-login/sidebar-nav helper (app logs in fine — the
   failure snapshot shows the authenticated dashboard; the `aside nav` click
   times out in the collapsed-sidebar headless viewport). 6 of the 7 failing
   tests were never touched by W2. Equivalent coverage is green in the jul10
   local-qa spec. Flagged for W3/T7.
4. **Auth host quirk (not a bug in scope).** SPA apiBase is the external IP;
   session cookie is `SameSite=Strict` host-only, so a `localhost:3100` origin
   sends no cookie cross-site. QA must load the frontend from the same host as
   the API (`100.85.193.33:3100`). No config changed.

---

## Test-data side effects (dev DB)
Patient 85 +1 COMPLETADO ficha; instrument 42 `plantillaArchivo` set (to exercise
C2); one throwaway instrument created via the C3 flow. Harmless, consistent with
existing seed/test rows.

---

## Standing status
PARKED — awaiting QA fix-ups from W3 (T7 #31).
