# Team Plan: improvements-jul-9

**Feature plan (source of truth)**: `context/user-feedback/improvements-jul-9-insights.md` — Sprint 1+2 bundled, 17 items, decisions L1–L6 locked with user on 2026-07-09.
**Supporting docs**: `context/user-feedback/qa-session-jul-9-reinterpreted.md` (transcript with line refs), `qa-session-jul-9-improvement-map.md` (matrix).
**Baseline**: HEAD `48029ef`, staging running jul-9 release, local dev healthy (backend :3101, frontend :3100, pg :15432, 14 migrations applied).

---

## Orchestrator Mindset

1. **Schema is the spine.** Every feature in this sprint hangs off new columns/tables. One worker owns ALL migrations in one bundle, produces a `schema-contract.md`, and everything else blocks on it. No frontend worker ever guesses a field name — they read the contract.
2. **Context is an asset when the next task touches the same files; a liability when it doesn't.** Reuse is planned per-wave (see Reuse Strategy below), not improvised.
3. **Tests are not optional** (jul-8 lesson: W2/W3/W4 skipped tests, W5 had to backfill 13 specs). A dedicated `pt-test-quality` wave is part of the plan, with fresh context for unbiased verification.
4. **Additive migrations only, except D7.** D7 (cargo → CargoEmpresa FK) is the one data migration with backfill risk — it gets a plan-approval gate before execution.
5. **Every decision already made stays made.** L1–L6 are locked; workers do not re-litigate them. Deviations require `TURNING-POINT-BREAKING` through the orchestrator.

## Scope (17 items)

| ID | Item | Layer |
|----|------|-------|
| A1–A3 | Cert create form cleanup (only nombre/tipo/descripción/periodicidad + first-update section) | UI |
| A4 | `comprobantePagoUrl` on `CertificadoUpdate` (schema + API + both update forms) | Schema+API+UI |
| A5 | Shared `<CertificateUpdateForm>` component | UI refactor |
| A6 | Empresa page save bug — investigate + fix | BUG |
| B1+B2+B6 | `fechaIncidente` on NotaCliente + 2-business-day hard block (L3) + list column | Schema+API+UI |
| B3/B4/B5 | `fechaCumpleanos` + `tipoSangre` enum + `eps` on Cliente | Schema+API+UI |
| D1 | `nivelEscritura` → nullable + hide from UI | Schema+UI |
| D2 | `EducacionEmpleado` repeatable (new table + CRUD + UI) | Schema+API+UI |
| D3 | `documentoIdentificacionUrl` on Empleado | Schema+API+UI |
| D4 | Dropzone `cursor: pointer` + hover | CSS |
| D5 | Contrato → own "Contrato laboral" tab | UI |
| D6 | `archivoFirmadoUrl` on Contrato | Schema+API+UI |
| D7 | `CargoEmpresa` table (L1) + `Contrato.cargoId` FK + backfill | Schema+API |
| D8 | Empresa configuración page (cargos manager) | UI+API |

**Out of scope** (deferred, do not touch): Section C (fichas single-step, cron, sub-roles), E1 uppercase, TipoInstrumento enum.

## Existing Patterns Used

- **Prisma migrations**: `backend/prisma/migrations/` — additive, snake_case `@map`, `npx prisma migrate dev --name <slug>`. NEVER `migrate diff --shadow-database-url`.
- **Service→route**: logic in `backend/src/services/*.ts`, thin routes with Zod at top of route file (`certificates.routes.ts` is the exemplar). Errors: `Object.assign(new Error(...), { status, field })` or `CertificateError` class.
- **Structured 400 with `field`**: `{ success: false, message, field: 'archivos.CUENTA_COBRO' }` pattern from nomina — reuse for `fechaIncidente`.
- **Frontend**: Nuxt 4 SPA, PrimeVue auto-import, `useApi().apiFetch`, `useFileUpload().uploadFile(file, folder)`, `useFileStash` for file inputs (keys scoped by row id — jul-9 W9 lesson), sessionStorage drafts.
- **Tests**: `backend/tests/{area}/*.spec.ts` (curl/API pattern), `frontend/tests/local-qa/jul9-*.spec.ts` following `jul8-*` naming; helper `frontend/tests/helpers/auth.ts` (origin-aware).
- **UI language Spanish, code English.** Entity names NOT auto-uppercased in this sprint (E1 deferred).

## Worker Waves + Reuse Strategy

Max 3 concurrent workers. 4 logical workers across waves; reuse-vs-fresh decided per the 5 gates in worker-reuse.md:

| Wave | Worker | Role | Spawn mode | Why |
|------|--------|------|-----------|-----|
| 1 | W1 | pt-backend-eng | FRESH | Schema+contract owner. pt-backend-eng (not pt-data-schema) because the same worker continues into API work in wave 2 — same role keeps G1 passing for reuse. |
| 1 | W2 | pt-frontend-eng | FRESH | Pure-UI items with zero schema dependency (A1–A3, A6, D4, D5) run in parallel with W1's migrations. |
| 2 | W1 | pt-backend-eng | **REUSE** (NEW-ASSIGNMENT) | API endpoints consume the schema it just wrote — G1 role ✓, G4 domain overlap max ✓. Its context IS the contract; re-deriving it in a fresh worker would waste the main benefit. |
| 2 | W2 | pt-frontend-eng | **REUSE** (NEW-ASSIGNMENT) | A4-UI + A5 touch the exact files it just edited (`certificados/crear.vue`, `[id].vue`) — G4 max. |
| 3 | W3 | pt-frontend-eng | **FRESH** | Pacientes + empleados UI. Zero file overlap with W2's certificados context (G4 fails); scope is large (~12 pts) and needs the full context budget; fresh avoids anchoring on certificados patterns where empleado forms differ. |
| 4 | W4 | pt-test-quality | **FRESH** | Different role (G1 fails vs all) + independent verification benefits from clean context — an implementer-biased context tends to write tests that mirror the implementation instead of the requirement. |

**Shutdown plan**:
- W2 → structured shutdown after wave-2 validation (certificados scope exhausted; no future tasks in its domain).
- W1 → PARKED after wave 2 (QA findings in wave 4 may need API fix-ups — highest-probability revision target).
- W3 → PARKED after wave 3 (same reason, UI fix-ups).
- W4 + all PARKED → session-end structured shutdown sweep after convergence.

## Dependency Graph

```
[#T1 W1 migrations+contract] ──blocks──► T2,T3,T4,T5 (W1 API), T9 (W2 A4-UI), T10,T11,T12 (W3)
[#T6 W2 A1-A3]  (independent)
[#T7 W2 A6 bug] (independent)
[#T8 W2 D4+D5]  (independent)          D5 blocks T12 (contrato UI lands in the new tab)
[#T2..T5 W1 API] ──block──► T10,T11,T12 (W3 UI), T13 (W4 backend specs)
[#T9..T12 UI]    ──block──► T14 (W4 playwright)
[#T13,T14]       ──block──► T15 (full regression + QA report)
```

## Interface Contract (W1 → everyone)

W1 writes `orchestration-ctx/decisions/schema-contract-jul9.md` at end of T1 containing:
- Exact Prisma models/columns added (CertificadoUpdate.comprobantePagoUrl, NotaCliente.fechaIncidente, Cliente.{fechaCumpleanos,tipoSangre,eps}, TipoSangre enum, Empleado.{documentoIdentificacionUrl, nivelEscritura→nullable}, EducacionEmpleado model, Contrato.{archivoFirmadoUrl,cargoId}, CargoEmpresa model)
- Endpoint request/response shapes for every new/changed API (educación CRUD, cargos CRUD, notas with fechaIncidente + error shape, etc.)
- Seed values (7 cargos + Otro; TipoSangre 8 values)
- D7 backfill mapping decisions

## Risk & Watch-outs

- **D7 backfill** — plan-approval gate: W1 writes `proposed-plan.md` with `SELECT DISTINCT cargo FROM contratos` results + mapping before running the migration. Orchestrator approves.
- **B1 backfill** — `fechaIncidente` NOT NULL requires backfilling existing rows with `fecha`; do nullable → backfill → SET NOT NULL in one migration script (drift-1 lesson from jul-5).
- **A6 unknown** — empresa bug cause unknown; timebox investigation, escalate BLOCKED if >2 attempts.
- **Local services** — backend PID on :3101, frontend on :3100; kill only exact PIDs; never generic pkill.
- **No commits** — only when explicitly instructed.
- **prisma migrate diff --shadow-database-url** — BLOCKED, never run.

## Complexity Budget

| Worker | Wave | Tasks | Points |
|--------|------|-------|--------|
| W1 | 1 | T1 migrations+contract | 8 |
| W1 | 2 | T2–T5 API | 10 |
| W2 | 1 | T6–T8 UI | 8 |
| W2 | 2 | T9 A4-UI+A5 | 5 |
| W3 | 3 | T10–T12 | 12 |
| W4 | 4 | T13–T15 | 10 |

Each wave per worker ≤13 ✓
