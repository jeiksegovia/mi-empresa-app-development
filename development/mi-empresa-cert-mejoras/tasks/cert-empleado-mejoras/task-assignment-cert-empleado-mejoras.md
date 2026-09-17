# task-assignment-cert-empleado-mejoras

## Plan File
`/Users/jeik/ws/my-empresa-app-development/development/mi-empresa-cert-mejoras/orchestration-ctx/team-plan-cert-empleado-mejoras.md`

## Task Type
IMPLEMENTATION

## Your Task
Implement P1–P5 of the mi-empresa certificados/empleados/clientes improvements. This is a
full-stack sequential implementation covering backend fixes, Prisma schema migrations, frontend
form updates, a new shared Vue component, and local Playwright QA specs. All validation is
**local only** — docker postgres :15432, backend :3101, frontend :3100. No staging.

## Implementation Location
- Real project root: `/Users/jeik/ws/mi-empresa-app-development/`
- Backend: `/Users/jeik/ws/mi-empresa-app-development/backend/`
- Frontend: `/Users/jeik/ws/mi-empresa-app-development/frontend/`
- Orchestration workspace: `/Users/jeik/ws/my-empresa-app-development/development/mi-empresa-cert-mejoras/`

## Worker Self-Check
- Task type is IMPLEMENTATION and Source Files list is non-empty → proceed
- Do NOT create a plan document — the plan file above already exists; implement from it

## Source Files to Modify

**P1 — BUG-1 fix (no migration)**
- `backend/src/services/certificateService.ts` — add `getDefaultEmpresaId()` helper; use it in `createCertificate` when empresaId is undefined (empresaId is already `?: number` — do not undo)
- `backend/src/routes/certificates.routes.ts` — make `empresaId` `.optional()` in Zod schema; catch Prisma P2003 error in POST handler → return 400
- `frontend/tests/local-qa/bug-validation.spec.ts` — flip BUG-1 expectation 400→201; replace error toast assertion with success navigation assertion

**P2 — New cert taxonomy + POR_VENCER badge (schema migration)**
- `backend/prisma/schema.prisma` — replace TipoCertificadoEmpresa enum values
- `backend/prisma/migrations/<timestamp>_f1-cert-taxonomy/migration.sql` — include UPDATE statements mapping old→new values before enum change
- `backend/src/routes/certificates.routes.ts` — update Zod enum
- `backend/src/services/certificateService.ts` — update TypeScript type
- `frontend/app/pages/certificados/crear.vue` — form order + new tipo options with help text
- `frontend/app/pages/certificados/index.vue` — add POR_VENCER badge (client-side, ≤30 days)

**P3 — TipoVivienda + salario on Cargo (schema migration)**
- `backend/prisma/schema.prisma` — update TipoVivienda enum; add `salario Decimal? @db.Decimal(12,2)` to Cargo
- `backend/prisma/migrations/<timestamp>_f2-vivienda-salario/migration.sql`
- `backend/src/routes/employees.routes.ts` — update Zod for tipoVivienda if it validates the enum
- `frontend/app/pages/empleados/nuevo.vue` — update TipoVivienda Select options; add salario field on cargo step
- `frontend/app/pages/empleados/[id]/editar.vue` — same on cargo tab

**P4 — Shared CertificadoEmpleado editor (largest change)**
- `backend/prisma/schema.prisma` — add `TipoCertificadoEmpleado` enum + `CertificadoEmpleado` model; drop old `CertificadoAlturas` and `CertificadoRiesgoElectrico` models
- `backend/prisma/migrations/<timestamp>_f2-cert-empleado-generic/migration.sql` — copy existing rows + drop old tables
- `backend/src/routes/employees.routes.ts` — update PUT /employees/:id/certificados to accept list shape
- `frontend/app/components/EmpleadoCertificadosEditor.vue` — NEW component (list of cert rows with add/remove)
- `frontend/app/pages/empleados/nuevo.vue` — step 5: use EmpleadoCertificadosEditor
- `frontend/app/pages/empleados/[id]/editar.vue` — tab 5: use EmpleadoCertificadosEditor

**P5 — Clientes selects (no migration)**
- `frontend/app/pages/pacientes/crear.vue` — genero Select; parentesco Select + conditional InputText
- `frontend/app/pages/pacientes/[id]/editar.vue` — same

**QA specs (create in `frontend/tests/local-qa/`)**
- `bug-validation.spec.ts` — update in-place (P1 flip)
- `p2-cert-types.spec.ts` — new: verify new tipo options + POR_VENCER badge
- `p3-empleado-fields.spec.ts` — new: verify vivienda enum + salario field
- `p4-cert-editor.spec.ts` — new: parity spec for EmpleadoCertificadosEditor on both pages
- `p5-clientes-selects.spec.ts` — new: verify genero/parentesco selects

## Recommended Approach

### 0. Read context first
Read the plan file above in full. Then read:
- `/Users/jeik/ws/mi-empresa-app-development/context/implementation-plan/certificados-empleados-clientes-improvements-plan.md`
- `backend/prisma/schema.prisma` (current full schema)
- `backend/src/routes/certificates.routes.ts`
- `backend/src/services/certificateService.ts` (already has empresaId as `?: number`)
- `frontend/playwright.config.ts` (for baseURL / env var patterns)
- `frontend/tests/local-qa/bug-validation.spec.ts` (existing repro spec)
- A few reference pages: `empleados/nuevo.vue` (wizard pattern), `certificados/crear.vue` (current form)

### 1. Start local dev stack
```bash
# Postgres already running at :15432 (docker miempresa-postgres)
# Read actual backend env:
cat /Users/jeik/ws/mi-empresa-app-development/backend/.env
# Start backend (adjust DATABASE_URL from .env):
cd /Users/jeik/ws/mi-empresa-app-development/backend
PORT=3101 node --import tsx src/start.ts &
# Start frontend:
cd /Users/jeik/ws/mi-empresa-app-development/frontend
NUXT_PUBLIC_API_BASE=http://localhost:3101/api/v1 npx nuxt dev --port 3100 &
# Verify both running:
curl -s http://localhost:3101/api/v1/health
```

### 2. P1 — BUG-1 fix
- Add `getDefaultEmpresaId()` to certificateService.ts; call it in `createCertificate` when `input.empresaId` is undefined
- In certificates.routes.ts: make Zod schema `empresaId: z.number().int().positive().optional()`; in the POST catch block add `if ((error as any).code === 'P2003') { res.status(400).json({...}); return }`
- In bug-validation.spec.ts: flip 400→201; the success case navigates to `/certificados/{id}` — update URL assertion; remove error toast, expect either success toast or successful navigation

Run test:
```bash
cd /Users/jeik/ws/mi-empresa-app-development/frontend
TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/bug-validation.spec.ts --headed
```
Expect both tests green.

### 3. P2 — Cert taxonomy migration
```bash
cd /Users/jeik/ws/mi-empresa-app-development/backend
# Create migration file only (don't apply yet):
npx prisma migrate dev --create-only --name f1-cert-taxonomy
# Edit the generated SQL to add UPDATE + enum change
npx prisma migrate dev  # applies it
npx prisma generate
```
PostgreSQL enum change approach: check if values exist in any row first; the recommended SQL sequence for replacing an enum:
```sql
-- 1. Rename old enum
ALTER TYPE "TipoCertificadoEmpresa" RENAME TO "TipoCertificadoEmpresa_old";
-- 2. Create new enum
CREATE TYPE "TipoCertificadoEmpresa" AS ENUM ('ALCALDIA', 'GOBERNACION', 'SECRETARIAS', 'TRIBUTARIOS', 'REGISTRO_MERCANTIL', 'OTRO');
-- 3. Migrate data (add temp column, copy, drop old, rename)
ALTER TABLE "certificados_empresa" ADD COLUMN "tipo_new" "TipoCertificadoEmpresa";
UPDATE "certificados_empresa" SET "tipo_new" = CASE "tipo_certificado"::text
  WHEN 'RUT' THEN 'TRIBUTARIOS'::"TipoCertificadoEmpresa"
  WHEN 'CAMARA_COMERCIO' THEN 'REGISTRO_MERCANTIL'::"TipoCertificadoEmpresa"
  WHEN 'PERMISO_SANITARIO' THEN 'SECRETARIAS'::"TipoCertificadoEmpresa"
  WHEN 'PAGO_SEGURIDAD_SOCIAL' THEN 'OTRO'::"TipoCertificadoEmpresa"
  ELSE 'OTRO'::"TipoCertificadoEmpresa"
END;
ALTER TABLE "certificados_empresa" DROP COLUMN "tipo_certificado";
ALTER TABLE "certificados_empresa" RENAME COLUMN "tipo_new" TO "tipo_certificado";
DROP TYPE "TipoCertificadoEmpresa_old";
```
Then update Zod + TypeScript types; update crear.vue + index.vue.

### 4. P3 — TipoVivienda + salario
Same migration pattern. TipoVivienda rename approach; the new values (PROPIA/ARRENDADA/FAMILIAR) don't map cleanly from old ones — all existing rows become PROPIA (semantic reset; only dev data). The `salario` column on `Cargo` is straightforward `ALTER TABLE "cargos" ADD COLUMN "salario" DECIMAL(12,2)`.

Check if `salario` already exists on Cargo before adding (grep schema).

### 5. P4 — Shared cert editor
Biggest step. Run migration + data copy in one SQL block:
```sql
CREATE TYPE "TipoCertificadoEmpleado" AS ENUM ('ALTURAS', 'RIESGO_ELECTRICO', 'MANIPULACION_ALIMENTOS', 'OTRO');
CREATE TABLE "certificados_empleado" (...);
INSERT INTO "certificados_empleado" (empleado_id, tipo, fecha_expedicion, fecha_vencimiento)
  SELECT empleado_id, 'ALTURAS', fecha_expedicion, fecha_vencimiento FROM "certificados_alturas";
INSERT INTO "certificados_empleado" (empleado_id, tipo, fecha_expedicion, fecha_vencimiento)
  SELECT empleado_id, 'RIESGO_ELECTRICO', fecha_expedicion, fecha_vencimiento FROM "certificados_riesgo_electrico";
DROP TABLE "certificados_alturas";
DROP TABLE "certificados_riesgo_electrico";
```
Check actual table names in schema. After migration, build the EmpleadoCertificadosEditor component (see plan for props/emit spec). Update PUT /employees/:id/certificados route. Update both wizard and edit pages.

### 6. P5 — Clientes selects
No migration. Just replace input elements in crear.vue and editar.vue. For parentesco OTRO: `v-if="form.contacto.parentesco === 'OTRO'"` shows the custom text InputText; store the custom value in the same `parentesco` field by overwriting it when saved. Pattern: use a local `parentescoSelect` computed for the select value, and `parentescoCustom` for the text input; on submit, send `parentescoSelect === 'OTRO' ? parentescoCustom : parentescoSelect`.

### 7. Run full local-qa suite
```bash
cd /Users/jeik/ws/mi-empresa-app-development/frontend
TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/ --reporter=list
```
All specs must be green.

## Key Files / Resources to Read First
- `/Users/jeik/ws/my-empresa-app-development/development/mi-empresa-cert-mejoras/orchestration-ctx/team-plan-cert-empleado-mejoras.md`
- `/Users/jeik/ws/mi-empresa-app-development/context/implementation-plan/certificados-empleados-clientes-improvements-plan.md`
- `backend/prisma/schema.prisma`
- `backend/src/routes/certificates.routes.ts`
- `backend/src/services/certificateService.ts`
- `frontend/tests/local-qa/bug-validation.spec.ts`
- `frontend/playwright.config.ts`
- `frontend/tests/e2e/empleado-crear-completo.spec.ts` (reference for wizard selectors)
- `frontend/tests/e2e/certificado-crear.spec.ts` (reference, add happy-path submit)

## Deliverables
1. `development/mi-empresa-cert-mejoras/tasks/cert-empleado-mejoras/result.md` — list of all files changed + playwright results per phase
2. `development/mi-empresa-cert-mejoras/tasks/cert-empleado-mejoras/completion-report.md`

Implementation output goes directly to the real project files listed in "Source Files to Modify".

## Progress Reporting
`development/mi-empresa-cert-mejoras/tasks/cert-empleado-mejoras/progress-report.md`

Append a section after each phase completes:
```
## Phase P{N}: {name} — ✅ Done
{brief: what changed, playwright output summary}
```

## Acceptance Criteria
1. POST /api/v1/certificates without empresaId → 201
2. BUG-1 Playwright test → green
3. All new TipoCertificadoEmpresa options visible in /certificados/crear
4. POR_VENCER badge on certs ≤30 days from vencimiento
5. TipoVivienda shows PROPIA/ARRENDADA/FAMILIAR (not CASA/APARTAMENTO/LOTE)
6. Salario field visible in empleado cargo step/tab
7. EmpleadoCertificadosEditor renders on both nuevo wizard and editar page
8. MANIPULACION_ALIMENTOS cert saved → 200
9. Genero in pacientes is a Select (3 options)
10. Parentesco is a Select; OTRO reveals inline text input
11. All local-qa specs pass (bug-validation, p2–p5)

## Constraints
- No staging; no AWS commands; local only
- `certificateService.ts` empresaId is already `?: number` — preserve that, just add the helper
- PrimeVue 4: use `<Select>` not `<Dropdown>`; check existing components for correct import pattern
- PostgreSQL enums require multi-step SQL — don't use simple Prisma enum rename (it won't work); write raw SQL in the migration
- When running `npx prisma migrate dev`, must be in `backend/` dir with the correct DATABASE_URL env var
- Max 2 self-repair attempts per error; then escalate via TURNING-POINT-STRATEGY message

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "{TASK_ID}", status: "in_progress")` — replace {TASK_ID} with the actual task id from TaskList
2. **During work**: append sections to progress-report.md after each phase
3. **On error**: self-repair max 2x then `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: ...")`
4. **If blocked**: `SendMessage(to: "main", message: "BLOCKED: ...")`
5. **On completion**: write result.md + completion-report.md, then `TaskUpdate(..., status: "completed")`, then `SendMessage(to: "main", message: "COMPLETE: ...")`
6. After COMPLETE: ignore idle/echo messages — end turn silently

## Tools Available
All standard tools: Read, Edit, Write, Bash, Agent (for sub-agents), TaskUpdate, TaskList, TaskGet, SendMessage. Team tools (TaskUpdate, SendMessage) are native built-in tools — call them directly like Read or Bash. Do NOT use Skill("TaskUpdate") — that fails.
