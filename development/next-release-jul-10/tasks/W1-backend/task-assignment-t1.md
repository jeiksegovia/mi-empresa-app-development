# task-assignment-t1 (W1, wave 1)

## Plan File
`development/next-release-jul-10/orchestration-ctx/team-plan-next-release-jul-10.md` — read first.
Origins: `context/user-feedback/improvements-jul-9-insights.md` (L2 locked), `development/improvements-jul-9/orchestration-ctx/decisions/d7-cargo-migration-approval.md` (NOT NULL deferral now due), transcript lines 55–62 (E1).
Prior contract to EXTEND (do not rewrite): `development/improvements-jul-9/orchestration-ctx/decisions/schema-contract-jul9.md`.

## Task Type
IMPLEMENTATION

## Task ID
`25`. `TaskUpdate(taskId: "25", status: "in_progress")` on start. Tasks #26/#27 arrive later as NEW-ASSIGNMENT.

## Scope

### Migration A — `jul10_tipo_empleado`
- New enum `TipoEmpleado { GERONTOLOGA }` (single value now; enum for future specializations per L2)
- `Usuario.tipoEmpleado TipoEmpleado? @map("tipo_empleado")` (nullable — only EMPLEADOs with a specialization set it)

### Migration B — `jul10_contrato_cargo_not_null` (D7 tighten)
1. Data check FIRST: `SELECT COUNT(*) FROM contratos WHERE cargo_id IS NULL;` — record count in progress-report
2. Backfill: NULL cargoId rows → that empresa's `Otro` cargo (join via empleado→empresa; every empresa has Otro seeded)
3. `ALTER TABLE contratos ALTER COLUMN cargo_id SET NOT NULL;`
4. Schema: `cargoId Int @map("cargo_id")` (drop the `?`)
5. Zod on contrato create/update: `cargoId: z.number().int().positive()` REQUIRED

### E1 — backend uppercase transforms (no migration)
Zod `.transform(v => v.trim().toUpperCase())` on create AND update schemas for:
- `CertificadoEmpresa.nombre` (certificates.routes.ts)
- `Instrumento.nombreInstrumento` (instruments.routes.ts)
- `Cliente.nombre` (patients routes)
- `Empleado.nombre` + `Empleado.apellido` (employees.routes.ts)
- `Empresa.nombre` (empresa.routes.ts)
Explicitly NOT: descripcion, notas, any Text field (user spec, transcript line 60–62). NOT CargoEmpresa.nombre (title-case catalog values seeded jul-9 — leave as-is).

### Contract
NEW file `orchestration-ctx/decisions/schema-contract-jul10.md`: TipoEmpleado enum + Usuario field + how it's set; D7 NOT NULL + required Zod; E1 exact field list; placeholder sections for T2/T3 endpoints (fill in wave 2).

## Constraints
Same as jul-9: NEVER `migrate diff --shadow-database-url`; dev DB :15432 only; backend :3101 tsx-watch absorbs regen; no git commit; no staging/prod; stuck-migration-row lesson in `development/fixes-jul-8/tasks/W2-backend/completion-report.md` if needed.

## Deliverables
1. 2 migrations applied + E1 route changes
2. `schema-contract-jul10.md`
3. `tasks/W1-backend/result.md`, `completion-report.md`, `progress-report.md`

## Acceptance Criteria
1. `npx prisma migrate status` clean (24 total)
2. cargo_id NOT NULL verified via information_schema; NULL-backfill count documented
3. Curl: create cert/instrumento/cliente/empleado with lowercase nombre → stored + returned UPPERCASE; descripcion preserves case
4. Contrato create without cargoId → 400
5. Backend healthy throughout

## Reporting Protocol
Standard (as jul-9): TaskUpdate on start/done; progress-report per section; MAX 2 self-repair → TURNING-POINT-STRATEGY; BLOCKED + WAIT if stuck. On done: `SendMessage(to: "main", "COMPLETE: T1 done. See tasks/W1-backend/result.md", summary: "T1 complete")`. Stay available for wave-2 NEW-ASSIGNMENT.
