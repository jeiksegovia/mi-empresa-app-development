# Handoff: next-release-jul-10 — Fichas release + Hardening + E1 complete

**Delivered:** 2026-07-10 · **Baseline:** improvements-jul-9 + 2 new migrations (22 total)
**Team:** W1 pt-backend-eng (2 waves, reused) · W2 pt-frontend-eng (fresh) · W3 pt-test-quality (2 waves, reused)
**Runtime:** backend :3101 + frontend :3100 live (HMR). **Not committed.**
**Excluded by external block:** C5 TipoInstrumento enum — waiting on client Excel samples.

---

## What shipped (11/11 items MET, QA-verified)

### Group 1 — Fichas release (transcript §3, lines 210–286)
- **C1** `POST /patients/:id/fichas` now atomic single-step: with `archivoCompletado` → transaction creates ficha as COMPLETADO + fechaCompletado; without → legacy PENDIENTE flow preserved. UI: picking an instrumento immediately opens the combined dialog.
- **C2** "Descargar plantilla en blanco" button — client-side renamed `{instrumentoNombre}_{pacienteNombre}.{ext}` (verified: `Ficha_de_Valoración_Médica_Inicial_Paciente_T4.pdf`).
- **C3** "➕ Crear instrumento nuevo" dropdown shortcut with return-URL round-trip.
- **C4** Lazy PENDIENTE→VENCIDO flip (single `updateMany` before reads in `getPatient` + vencimientos endpoint) — estados now truthful, no cron.
- **C6** `TipoEmpleado` enum (`GERONTOLOGA`) on Usuario + `requireInstrumentWriter` middleware (ADMIN OR EMPLEADO+GERONTOLOGA on instrument writes) + NEW `/api/v1/users` CRUD (ADMIN-only, pairing rule: tipoEmpleado requires rol=EMPLEADO, auto-cleared on rol change). **tipoEmpleado is API-only** — no user-management UI exists yet; spec for that surface documented in W2 result.md.
- **C7** `GET /patients/fichas/vencimientos?days=N` — due/overdue fichas with paciente+instrumento names, most-overdue first.

### Group 2 — Hardening (jul-9 qa-report §6 + d7 decision)
- jul4 suite **2/24 → 24/24** (origin fix + selector refresh + cargoId fixtures + uppercase reconciliation + B1 fixture)
- Port-3001 suites green (auth-empleado 5, dashboard 9); patient-notes 4/4
- NEW D3 spec (documentoIdentificacionUrl round-trip)
- **D7 tightened**: `Contrato.cargoId` NOT NULL (17 junk NULL rows backfilled → Otro) + Zod REQUIRED (missing → 400 errors.cargoId)
- e2e/paciente-fichas harness fixed (goToPacientes → page.goto) — 5/5 + 2 pre-existing skips

### Group 4 — E1 auto-uppercase (transcript lines 55–62)
- Backend: Zod `trim+toUpperCase` on nombre fields — CertificadoEmpresa, Instrumento (nombreInstrumento), Cliente, Empleado (nombre+apellido), Empresa. Descripcion/notas explicitly preserved.
- Frontend: uppercase-as-you-type on the same 8 form inputs.
- Historical rows untouched (user decision). Legacy spec fixtures reconciled to UPPERCASE (never loosened to case-insensitive).

## Test state (strongest in repo history)
- Backend: 232 pass / 5 fail (all classified pre-existing: 1 FLAKE, 1 BUG `employees-full-create` certificadoAlturas, 1 TEST-ENV, 1 env-blocked staging, +serial dnr) / 2 skip
- Frontend local-qa: 59 pass / 8 fail (all = GAP-1 legacy origin URLs, pre-existing, LOW)
- New this release: 27 backend tests (7 files) + 3 frontend tests (W2's jul10 spec) — all green

## Follow-ups
| # | Item | Effort |
|---|---|---|
| 1 | GAP-1: migrate 5 legacy local-qa files to `getApiBase` (8 tests) | ~30 min |
| 2 | Pre-existing BUG: employees-full-create certificadoAlturas not honored on create | small |
| 3 | user-management UI (would make tipoEmpleado settable from the app) | future surface |
| 4 | C5 TipoInstrumento enum + seed | blocked on client Excel |
| 5 | Colombian holiday table for businessDays | when needed |

## Key decisions
- D-C4 lazy flip (no cron) · D-C1 one endpoint, presence of archivoCompletado branches the flow · D7 NOT NULL executed with 17-row backfill · incident lesson: **never reuse teammate names while shutdown requests are pending** (stale jul-9 sweep raced the new spawns; resolved — only old workers terminated)

## Run / verify
- Backend: `cd backend && npx playwright test tests/`
- Frontend: `TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1 npx playwright test tests/local-qa/ tests/e2e/paciente-fichas.spec.ts`
- Contract: `orchestration-ctx/decisions/schema-contract-jul10.md` · QA: `tasks/W3-test-quality/qa-report.md`
