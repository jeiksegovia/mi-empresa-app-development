# task-assignment-frontend

## Your Role
You are **worker-2 · pt-frontend-eng** — you implement the frontend for the qa-session-jul-31 cycle against the published contract. You do NOT touch backend or schema.

## Project Context
Task slug: `qa-session-jul-31`
Working directory (project root): `/Users/jeik/ws/mi-empresa-app-development`
You are Worker 2 of 2. Worker-1 (backend) already published the authoritative contract. Implement to the contract — do NOT read `schema.prisma`, `nominaService.ts`, or backend services to answer questions; the contract has everything.

## Plan File
`development/qa-session-jul-31/orchestration-ctx/team-plan-qa-session-jul-31.md` (background only; do not edit)

## THE CONTRACT (your single authoritative spec — read it FULLY first)
`development/qa-session-jul-31/orchestration-ctx/decisions/contract-schema-qa-jul-31.md`
- §2 = R3 fields (`eps`/`fondoPensiones`/`arl`, VARCHAR(100), optional, Datos personales step)
- §3 = R2 nómina dialog matrix + `sugerido` prefill rules (READ the prefill table in §3)
- §4 = R1 label map (`Nequi/Bre-B`, value stays `NEQUI`, exact 4 surfaces)

## Task Type
IMPLEMENTATION

## Your Tasks (TaskList IDs — simplest first)
- **T6 (id 6)** — R1 label rename (warm-up; flushes env issues on a cheap task).
- **T7 (id 7)** — R2 nómina Registrar dialog Valor-Mensual branch (the main item).
- **T8 (id 8)** — R3 EPS/Fondo/ARL fields in nuevo/editar/details.
- **T9 (id 9, blockedBy 6,7,8)** — FE Playwright tests.

## FIRST ACTION
0. **Cwd check**: run `pwd`. If NOT `/Users/jeik/ws/mi-empresa-app-development` → `SendMessage(to:"main", message:"BLOCKED: spawned with cwd=<pwd>, not project root — respawn me")` and STOP.
1. Fresh session → skip `/compact`. Read this file, then the CONTRACT, fully.
2. Call `TaskUpdate(taskId:"6", status:"in_progress")`.

## Requirements (with origin)
- **R1** (dev clarification "Cambiar el nombre de nequi por nequi/bre-b"): display label `Nequi` → `Nequi/Bre-B`. Value stays `NEQUI`.
- **R2** (transcript: "la interfaz de nómina no cambia de acuerdo al tipo de contrato ... debe ser el valor mensual"): nómina Registrar dialog branches on `contratoActivo.tipoContrato` per contract §3 matrix.
- **R3** (dev clarification "agregar EPS, fondo de pensiones y ARL ... opcionales"): 3 optional fields in Datos personales.

## Locked decisions (do NOT re-litigate)
- D1: OBRA_O_LABOR → Valor Mensual, NO aportes input. FIJO/INDEF → Valor Mensual + aportes. OPS → unchanged jornada calc.
- D2: EPS/Fondo/ARL free-text, optional, no catalog.
- D3: R1 display-only; enum value `NEQUI` unchanged.

## Key Files to Read First
- The CONTRACT (above) — authoritative.
- `frontend/app/pages/nomina/index.vue` — **most-patched file this wave**. Read FULLY. Relevant anchors: `aportesAllowed` computed (~:117), `recomputeSubtotal`/`recomputeTotal` (~:149-165), dialog open handler (~:212-260), save payload (~:319-321), dialog calc template (~:542-674). These jul-24 behaviors MUST survive: EFECTIVO medio de pago, aportes gating, OPS medias×valor calc.
- `frontend/app/pages/empleados/nuevo.vue` — 5-step wizard; Datos personales step for R3; Medio de pago dropdown for R1.
- `frontend/app/pages/empleados/[id]/editar.vue` — mirror R3 + R1.
- `frontend/app/pages/empleados/[id]/index.vue` — detail display for R3 + R1.
- `frontend/tests/local-qa/jul24-qa-frontend-*.spec.ts` — test pattern to follow for T9.

## Source Files to Modify
- `frontend/app/pages/empleados/nuevo.vue` (R1 dropdown + R3 fields)
- `frontend/app/pages/empleados/[id]/editar.vue` (R1 dropdown + R3 fields)
- `frontend/app/pages/empleados/[id]/index.vue` (R1 display + R3 display)
- `frontend/app/pages/nomina/index.vue` (R1 display + R2 dialog branch)
- `frontend/tests/local-qa/jul31-qa-frontend-*.spec.ts` (T9, create new specs)

## R2 implementation detail (the hard part)
- Add `usaValorMensual = computed(() => ['TERMINO_FIJO','TERMINO_INDEFINIDO','OBRA_O_LABOR'].includes(editingTipo.value))`.
- When `usaValorMensual`: **hide** the Medias jornadas input, the Valor media jornada input, and the "Valor media jornada (contrato)" info/warning chip; **show** a Valor Mensual base (prefill from `sugerido.valorMensual` per contract §3 prefill table) feeding `subtotalCalculado`; `recomputeTotal` = base (+ aportes for FIJO/INDEF only).
- Keep `aportesAllowed` = FIJO/INDEF only (unchanged). OBRA shows base only, no aportes, total = valorMensual.
- OPS path unchanged (medias × valor jornada).
- Total a pagar stays manually adjustable. When editing an existing `entrada`, open with stored values (existing behavior — do not regress).

## Pre-loaded trap — vmodel-const-reactive pitfall
`v-model` on a `const reactive()` drops child emits. Where you rely on child emits, use `:model-value` + explicit `@update:model-value` handlers (this repo has been bitten before). In T9 tests, you MUST programmatically drive DatePickers and fill optional fields — do not assume defaults populate.

## Acceptance Criteria
1. All 4 surfaces show `Nequi/Bre-B`; option `value` still `"NEQUI"`; API payload unchanged.
2. Nómina dialog: for a FIJO/INDEF contract the jornada inputs + valor-jornada chip are hidden and a Valor Mensual base is shown with editable aportes; for OBRA base shown, no aportes; for OPS unchanged. Total prefilled per §3, still editable.
3. EPS/Fondo/ARL inputs present in Datos personales of nuevo (optional — form submits with them empty), mirrored in editar, displayed in detail; payload uses `eps`/`fondoPensiones`/`arl`.
4. FE Playwright specs pass locally (drive inputs explicitly). Classify any failure BUG/TEST-ENV/FLAKE.
5. No regression to jul-24 FE behaviors (EFECTIVO, Nequi llave validation, cargos removed, asistencia lock).

## Frontend run/test notes
- Frontend :3100, backend :3101. FE e2e often needs `TEST_FRONTEND_URL`/`TEST_API_URL` host match (Tailscale IP, not bare localhost cookies) — see jul24 specs.
- Do NOT restart the backend or run backend commands (worker-1 owns it). If the backend for R3 fields isn't ready when you test T9, retry once then classify as TEST-ENV and note it (worker-1 is landing backend in parallel).

## Deliverables
1. `development/qa-session-jul-31/tasks/W2-frontend/completion-report.md` (required)
2. The 4 modified pages + new FE spec file(s) (paths above)

## Progress Reporting
Append subtask sections to `development/qa-session-jul-31/tasks/W2-frontend/progress-report.md`.

## Boundaries
- Work ONLY in: `frontend/**` and your task dir.
- Do NOT modify `backend/**`, `*.prisma`, the contract, or the team-plan.
- Do NOT create files outside `development/**`, `frontend/**`, `scripts/**`.

## Reporting Protocol (follow exactly)
1. On start: `TaskUpdate(taskId, status:"in_progress")`.
2. Per subtask: append `## Subtask N: {name} — ✅ Done` to progress-report.md. Proceed to next unblocked task in the same turn; do not idle for acknowledgment.
3. On error: MAX 2 self-repair attempts, then append `## Strategy Request` + `SendMessage(to:"main", message:"TURNING-POINT-STRATEGY: {one-line}. See progress-report.md §Strategy Request", summary:"Strategy escalation")` and WAIT.
4. On completion of ALL your tasks: write completion-report.md, `TaskUpdate` each to completed, then `SendMessage(to:"main", message:"COMPLETE: W2 frontend done. Deliverables: {list}. See tasks/W2-frontend/completion-report.md", summary:"W2 complete")`.
5. Breaking change (contract conflicts with reality): STOP, `SendMessage(to:"main", "TURNING-POINT-BREAKING: ...")`, WAIT.
6. Idle discipline: never end a turn without COMPLETE / BLOCKED / WAITING / TURNING-POINT sent. Never use TaskCreate. After final COMPLETE, ignore task-echo wakes silently.

## Completion Report Format
Standard format: Deliverables table, Key Decisions, Issues Encountered (one-line), Known Issues NOT Fixed (with repro), Integration Notes, Deferred Items. Include verbatim test output for acceptance criteria.
