# task-assignment-data-schema

## Your Role
You are **worker-1 · pt-data-schema** — you own the shared CONTRACT + schema (enum) + the 2 instrument template JSONs for fixes-features-aug-6. Author the contract FIRST, publish it, then do the migration + templates. You do NOT touch backend services/routes or frontend.

## Project Context
Project root: `/Users/jeik/ws/mi-empresa-app-development`. You are Worker 1 of 3. W2 (backend) and W3 (frontend) implement against the contract YOU publish in T1 — publish it early and correctly.

## Task Type
IMPLEMENTATION

## Your Tasks (TaskList ids, in order)
- **T1 (id 1)** — Author `development/fixes-features-aug-6/orchestration-ctx/decisions/contract-fixes-features-aug-6.md`. **After writing it, send `CHECKPOINT: contract published` so the orchestrator can spawn W2/W3.** Then continue.
- **T2 (id 2, blockedBy 1)** — Enum migration.
- **T3 (id 3, blockedBy 1)** — 2 instrument templates.

## FIRST ACTION
0. `pwd` must be `/Users/jeik/ws/mi-empresa-app-development` (else `SendMessage(to:"main","BLOCKED: cwd=<pwd>")` + STOP).
1. Fresh session → skip /compact. Read this file fully. Call `TaskUpdate(taskId:"1", status:"in_progress")`.

## Locked decisions (do NOT re-litigate)
- D1 PROFESORES + AUXILIARES = 2 new TipoEmpleado values, identical access.
- D2 fill-gating reuses existing `Instrumento.rolesPermitidos` CSV — NO new column.
- D3 notes privacy = RBAC filter by autor for new roles; admin+geronto see all.
- D4 both new instruments informational (non-scored).
- D5 pacientes access for new roles = new `read-only` matrix value (GET only).
- D6 GERONTOLOGA certificados false→true.

## Key files to read first
- `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md` — contract STYLE template.
- `backend/src/middleware/domainAccess.ts` — `DOMAIN_ACCESS` matrix + `DomainAccessValue` (current: GERONTOLOGA/CONTRATOS; certificados GERONTOLOGA=false).
- `backend/src/services/instrumentService.ts:554-582` — `getInstrumentDefinition` rolesPermitidos intersection (the "no real ADMIN bypass" bug source; comment line ~567). `backend/src/routes/instruments.routes.ts:170-184` — caller CSV = `rol,tipoEmpleado`.
- `backend/prisma/schema.prisma:860-863` — `enum TipoEmpleado`.
- `backend/prisma/instrument-templates/FICHA_NUTRICIONAL.v1.json`, `VALORACION_INTEGRAL.v1.json` — template STRUCTURE exemplars (sections/items; text-info, group-info types). `backend/src/services/instrumentScoringService.ts` — item type definitions (single-select-scored, text-info, group-info, number-info…).
- PDFs: `context/instrumentos-raw/SIGNOS VITALES_*.pdf`, `BOLETIN ANUAL USUARIOS_*.pdf` (already analyzed; fields summarized in the plan).

## Source files to modify
- `development/fixes-features-aug-6/orchestration-ctx/decisions/contract-fixes-features-aug-6.md` (T1)
- `backend/prisma/schema.prisma` + `backend/prisma/migrations/<new>/` (T2)
- `backend/prisma/instrument-templates/SIGNOS_VITALES.v1.json`, `BOLETIN_ANUAL.v1.json` (T3)

## Contract must specify (T1) — unambiguous for W2 & W3
1. **Enum**: TipoEmpleado = GERONTOLOGA | CONTRATOS | PROFESORES | AUXILIARES.
2. **DOMAIN_ACCESS full matrix** (all 4 tipos × all domains) incl:
   - new value `'read-only'` semantics: GET allowed; POST/PUT/PATCH/DELETE → 403 DOMAIN_FORBIDDEN. FE: `can()`=true, `canCreateOnly()`=false, add `isReadOnly()`.
   - PROFESORES + AUXILIARES rows (identical): pacientes=`read-only`, fichas=`create-only`, notas=`create-only`, empleados/nomina/certificados/instrumentos/empresa/asistencia=`false`.
   - GERONTOLOGA: certificados=`true` (was false); other cells unchanged.
3. **rolesPermitidos rule**: caller CSV built from `rol,tipoEmpleado` (e.g. `EMPLEADO,GERONTOLOGA`); allowed CSV = `Instrumento.rolesPermitidos`. **Explicit ADMIN bypass** (rol===ADMIN → allow regardless). Exact trimmed-token match (specify casing — tokens are the RolUsuario/TipoEmpleado names + free-form cargo names + `ADMIN`). Create-default rolesPermitidos MUST include the creator's role tokens so the creator can immediately fill. Token to add for new roles: `PROFESORES`, `AUXILIARES`.
4. **Notes privacy**: for EMPLEADO+PROFESORES/AUXILIARES: notes LIST filtered `autor=userId`; POST allowed; PUT/DELETE→403. ADMIN + GERONTOLOGA unfiltered.
5. **2 instruments** — codigo, tipo, periodicidad, rolesPermitidos (`ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES`), and field/section structure:
   - `SIGNOS_VITALES`: header items (tipoDocumento, nombreCompleto, edad, sexo) + a repeatable group `mediciones` with columns fechaHora,o2,presionArterial,fc,fr,temperatura,observaciones. Non-scored (`scoring.total='none'`).
   - `BOLETIN_ANUAL`: header (tipoDocumento, numeroDocumento, nombreApellido, periodoAnio, edad, sexo) + text-info items psicologia,deporte,terapiaOcupacional,fisioterapia,componenteSocial,conceptoEnfermeria (each long free-text; optionally an author text field). Non-scored.
   - Give W3 the exact item ids so the FE fill view matches.

## Acceptance criteria
1. Contract covers items 1–5; W2/W3 can implement without reading schema/service for facts.
2. `npx prisma migrate status` clean local :15432; enum has 4 values; client regenerated.
3. Both templates parse and validate against the scoring service types (informational); `npm run instruments:upgrade` locally inserts+activates both (report the active version rows).

## Traps (pre-loaded)
- Local backend :3101, db :15432. Migration via `prisma migrate dev --name add_tipoempleado_profesores_auxiliares` (NEVER `migrate diff --shadow-database-url`). Never pkill node/tsx (prod bun on :4142).
- Adding enum values is additive/safe. `instruments:upgrade` guards deployed-stage DBs (local is fine without FORCE_UPGRADE).
- Template item types must match what `instrumentScoringService` validates — read an existing informational template to copy the exact `type` strings and section shape.

## Reporting protocol
TaskUpdate in_progress on start. **After T1: `SendMessage(to:"main", message:"CHECKPOINT: contract published at decisions/contract-fixes-features-aug-6.md", summary:"Contract published")`** then continue T2/T3. Per subtask append to `development/fixes-features-aug-6/tasks/W1-data-schema/progress-report.md`. MAX 2 self-repair attempts then TURNING-POINT-STRATEGY. On all tasks done: write completion-report.md, TaskUpdate completed, `SendMessage(to:"main","COMPLETE: W1 done. Deliverables: {list}")`. Never TaskCreate. After COMPLETE, ignore task echoes.

## Deliverables
1. `development/fixes-features-aug-6/tasks/W1-data-schema/completion-report.md`
2. Contract doc, enum migration, 2 template JSONs.
