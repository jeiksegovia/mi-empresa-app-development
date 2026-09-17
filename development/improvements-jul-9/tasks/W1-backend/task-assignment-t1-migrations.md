# task-assignment-t1-migrations (W1, wave 1)

## Plan File
`development/improvements-jul-9/orchestration-ctx/team-plan-improvements-jul-9.md` — read first.
Feature source of truth: `context/user-feedback/improvements-jul-9-insights.md` (decisions L1–L6 are LOCKED — do not re-litigate).

## Task Type
IMPLEMENTATION

## Task ID
`9`. Call `TaskUpdate(taskId: "9", status: "in_progress")` on start. Do NOT claim tasks #10–#13 yet — those come as a NEW-ASSIGNMENT after this task is validated.

## Your Task
All Prisma schema changes for the jul-9 improvements, as ordered migrations, plus the interface contract document that unblocks every other worker.

## Implementation Location
- `/Users/jeik/ws/mi-empresa-app-development/backend/` (schema: `prisma/schema.prisma`, migrations: `prisma/migrations/`)

## Source Files to Modify
1. `backend/prisma/schema.prisma` — all model/enum changes below
2. `backend/prisma/migrations/*` — generated via `npx prisma migrate dev --name <slug>` (run from `backend/`)
3. `backend/prisma/seed.ts` — seed cargos if the project seeds via this file (check pattern first)
4. `development/improvements-jul-9/orchestration-ctx/decisions/schema-contract-jul9.md` — the contract (write LAST)

## Schema changes (in this order)

**Migration 1 — additive columns (`jul9_additive_fields`)**
- `CertificadoUpdate.comprobantePagoUrl String? @map("comprobante_pago_url") @db.VarChar(500)`
- `Cliente.fechaCumpleanos DateTime? @map("fecha_cumpleanos") @db.Date`
- `Cliente.eps String? @db.VarChar(200)`
- New enum `TipoSangre { A_POS A_NEG B_POS B_NEG AB_POS AB_NEG O_POS O_NEG }` + `Cliente.tipoSangre TipoSangre? @map("tipo_sangre")`
- `Empleado.nivelEscritura` → make nullable (`String?`) — do NOT drop the column
- `Empleado.documentoIdentificacionUrl String? @map("documento_identificacion_url") @db.VarChar(500)`
- `Contrato.archivoFirmadoUrl String? @map("archivo_firmado_url") @db.VarChar(500)`

**Migration 2 — NotaCliente.fechaIncidente (`jul9_nota_fecha_incidente`)**
- Add `fechaIncidente DateTime? @map("fecha_incidente") @db.Date` (nullable first)
- In the SAME migration SQL: backfill `UPDATE notas_clientes SET fecha_incidente = fecha::date WHERE fecha_incidente IS NULL;` then `ALTER TABLE notas_clientes ALTER COLUMN fecha_incidente SET NOT NULL;`
- Schema ends as `fechaIncidente DateTime @map("fecha_incidente") @db.Date` (required)
- You will need to hand-edit the generated migration.sql to insert the backfill between add-column and set-not-null — verify with `npx prisma migrate dev` that it applies cleanly

**Migration 3 — EducacionEmpleado (`jul9_educacion_empleado`)**
- New model per insights doc §D2: `id, empleadoId FK (Cascade), profesion VarChar(200), universidad? VarChar(200), fechaGraduacion? Date, diplomaUrl? VarChar(500)`, `@@index([empleadoId])`, `@@map("educacion_empleado")`. Add relation on `Empleado`.

**Migration 4 — CargoEmpresa + Contrato.cargoId (`jul9_cargo_empresa`) — PLAN-APPROVAL GATE**
- BEFORE writing this migration: run `SELECT DISTINCT cargo, COUNT(*) FROM contratos GROUP BY cargo;` against local dev DB. Write `development/improvements-jul-9/tasks/W1-backend/proposed-plan.md` with: the distinct values found, the proposed seed list (`Fisioterapeuta, Terapeuta Ocupacional, Educador Físico, Manualidades, Auxiliar de Enfermería, Auxiliar de Servicios Generales, Otro` — adjust based on data), and the backfill mapping (existing string → seeded row, unmatched → 'Otro').
- Send `SendMessage(to: "main", message: "PLAN-APPROVAL: D7 cargo migration plan ready. See tasks/W1-backend/proposed-plan.md", summary: "D7 gate")` and WAIT for approval.
- After approval: new model `CargoEmpresa` per insights doc §D7 (`@@unique([empresaId, nombre])`, `@@map("cargos_empresa")`); `Contrato.cargoId Int? @map("cargo_id")` FK; migration SQL seeds cargos per empresa + backfills `cargoId` from `cargo` string matching; KEEP `Contrato.cargo` column for now (deprecate later — do not drop).

## Contract document (write LAST — unblocks W2/W3)
`orchestration-ctx/decisions/schema-contract-jul9.md`: every model/column verbatim, enum values, seed data, JSON shapes the API will expose (fields in camelCase as Prisma returns), the D7 backfill mapping actually applied, and any deviation from this assignment.

## Constraints
- **NEVER** run `prisma migrate diff --shadow-database-url` (wipes DB silently — hard rule)
- Local backend runs on :3101 (tsx watch — picks up Prisma client regen automatically after `migrate dev`; if it crashes, restart ONLY via `kill $(lsof -ti :3101)` then `cd backend && npm run dev > /tmp/backend-dev.log 2>&1 &`)
- Local DB: `localhost:15432` (docker), dev database — safe to migrate
- If `migrate dev` complains about a stuck failed migration row, see jul-8 lesson: delete the single stuck row from `_prisma_migrations` (documented in `development/fixes-jul-8/tasks/W2-backend/completion-report.md`)
- Do NOT git-commit. Do NOT touch staging/prod.
- Verify after each migration: `npx prisma migrate status` clean + backend `/api/v1/health` returns 200

## Deliverables
1. Schema + migrations applied locally (all 4)
2. `orchestration-ctx/decisions/schema-contract-jul9.md`
3. `development/improvements-jul-9/tasks/W1-backend/result.md` — what changed + verification output
4. `development/improvements-jul-9/tasks/W1-backend/completion-report.md`

## Progress Reporting
`development/improvements-jul-9/tasks/W1-backend/progress-report.md` — append per migration.

## Acceptance Criteria
1. `npx prisma migrate status` → all applied, no pending
2. `fecha_incidente` NOT NULL with all existing rows backfilled (verify with SQL count)
3. Cargos seeded; existing contrato rows have `cargo_id` populated (or documented as unmatched→Otro)
4. Backend healthy on :3101 after Prisma client regen
5. schema-contract-jul9.md complete enough that a frontend worker never needs to open schema.prisma

## Reporting Protocol
1. On start: `TaskUpdate(taskId: "9", status: "in_progress")`
2. During: progress-report.md per migration; D7 gate: PLAN-APPROVAL message + WAIT
3. On error: MAX 2 self-repair attempts → `SendMessage(to: "main", "TURNING-POINT-STRATEGY: ...", summary: "Strategy escalation")` + WAIT
4. If blocked: `SendMessage(to: "main", "BLOCKED: {problem}. Attempted: {tries}. Need: {unblocker}", summary: "Blocked")` + WAIT
5. On completion: write result.md + completion-report.md → `TaskUpdate(taskId: "9", status: "completed")` → `SendMessage(to: "main", "COMPLETE: Migrations + contract done. See tasks/W1-backend/result.md", summary: "T1 complete")`
6. After COMPLETE: stay available — a NEW-ASSIGNMENT for the API wave (tasks #10–#13) will follow. Ignore idle/echo messages that carry no new assignment.

## Tools
Read, Edit, Write, Bash (prisma, psql via docker, curl). `TaskUpdate`/`SendMessage` are native tools — call directly.
