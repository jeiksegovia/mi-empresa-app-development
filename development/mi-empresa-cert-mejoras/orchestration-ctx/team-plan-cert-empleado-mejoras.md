# Plan: cert-empleado-mejoras

## Objective
Implement P1–P5 from the feature plan (`context/implementation-plan/certificados-empleados-clientes-improvements-plan.md`):
- **P1** — Fix BUG-1: backend derives empresaId server-side; flip local-qa test 400→201
- **P2** — F1+F1.1: new TipoCertificadoEmpresa taxonomy + form order + POR_VENCER badge
- **P3** — F2.1+F2.2: TipoVivienda enum reset (PROPIA/ARRENDADA/FAMILIAR) + salario on Cargo
- **P4** — F2.3: replace CertificadoAlturas/CertificadoRiesgoElectrico with generic CertificadoEmpleado; shared EmpleadoCertificadosEditor.vue component
- **P5** — F3: genero Select + parentesco Select (with inline "¿Cuál?" when OTRO) in pacientes

All validation is LOCAL ONLY (docker postgres :15432, backend :3101, frontend :3100). Every phase ends with a passing Playwright spec in `frontend/tests/local-qa/`.

## Recommended Approach

### Pre-work: verify stack state
```bash
# Postgres is already running (docker miempresa-postgres :15432)
# Start backend (from mi-empresa-app-development/backend/):
PORT=3101 DATABASE_URL="postgresql://miempresa:dev_password@localhost:15432/miempresa_dev" npx tsx src/start.ts &
# Start frontend (from mi-empresa-app-development/frontend/):
NUXT_PUBLIC_API_BASE=http://localhost:3101/api/v1 npx nuxt dev --port 3100 &
# Read backend .env for actual credentials
```

### Phase P1 — BUG-1 fix (no migration needed)
1. **certificateService.ts**: add helper `async function getDefaultEmpresaId()` that calls `prisma.empresa.findFirst({ select: { id: true } })` and throws `Error('No empresa found')` if null
2. **certificateService.ts**: `createCertificate` — if `input.empresaId` is undefined, call `getDefaultEmpresaId()` to resolve it
3. **certificates.routes.ts**: make `empresaId` optional in the Zod schema (`.optional()`)
4. **certificates.routes.ts**: in the POST handler catch block, check `(error as any).code === 'P2003'` → return `res.status(400).json({ success:false, message: 'Empresa not found' })`
5. **bug-validation.spec.ts**: flip BUG-1 `expect(res.status()).toBe(400)` → `toBe(201)`; change URL assertion `/certificados\/crear/` → `/certificados/\d+` or just `/certificados`; remove error toast assertion, add success navigation assertion
6. Run playwright BUG-1 test → expect green

### Phase P2 — New certificate taxonomy (schema migration)
1. **schema.prisma**: replace `TipoCertificadoEmpresa` enum:
   `ALCALDIA | GOBERNACION | SECRETARIAS | TRIBUTARIOS | REGISTRO_MERCANTIL | OTRO`
2. Write data migration SQL (in the migration): map old values `RUT→TRIBUTARIOS, CAMARA_COMERCIO→REGISTRO_MERCANTIL, PERMISO_SANITARIO→SECRETARIAS, PAGO_SEGURIDAD_SOCIAL→OTRO, OTRO→OTRO`
   - Use `prisma migrate dev --name f1-cert-taxonomy` (it creates the migration file; edit the .sql to add UPDATE statements before the enum redefinition)
   - Pattern: use a temp column approach or recreate the enum with PostgreSQL `ALTER TYPE ... RENAME VALUE` / rename + migrate + rename strategy
3. **certificates.routes.ts + certificateService.ts**: update Zod enum + TypeScript type to new values
4. **certificados/crear.vue**: reorder form (tipo → nombre → vigencia → descripcion → archivo); add help text per option using PrimeVue Select optionLabel with template slot or option descriptions
5. **certificados/index.vue**: add `POR_VENCER` badge — derive client-side: `fechaVencimiento && diffDays(fechaVencimiento, today) <= 30 && estado !== 'VENCIDO'`
6. Run playwright local-qa spec for P2 → green

### Phase P3 — TipoVivienda + Salario on Cargo (schema migration)
1. **schema.prisma**: update `TipoVivienda` enum to `PROPIA | ARRENDADA | FAMILIAR`
2. **schema.prisma**: add `salario Decimal? @db.Decimal(12,2)` to `Cargo` model
3. `prisma migrate dev --name f2-vivienda-salario`
4. Data migration: existing `tipoVivienda` values (CASA/APARTAMENTO/LOTE) map to `PROPIA` (semantic reset; only test data)
5. **empleados/nuevo.vue**: update TipoVivienda Select options; add salario InputNumber field with label "Salario (se extraerá de nómina cuando el módulo esté activo)"
6. **empleados/[id]/editar.vue**: same changes in the personal-data tab
7. Backend: update Zod schema in employees.routes.ts for the new enum values if present
8. Run playwright local-qa spec for P3 → green

### Phase P4 — Shared CertificadoEmpleado editor (biggest migration)
1. **schema.prisma**: 
   - Add enum `TipoCertificadoEmpleado { ALTURAS RIESGO_ELECTRICO MANIPULACION_ALIMENTOS OTRO }`
   - Add model `CertificadoEmpleado { id, empleadoId, tipo TipoCertificadoEmpleado, nombre String?, fechaExpedicion DateTime @db.Date, fechaVencimiento DateTime @db.Date, createdAt, updatedAt }`
   - Keep old `CertificadoAlturas` + `CertificadoRiesgoElectrico` temporarily (drop after data migration)
2. `prisma migrate dev --name f2-cert-empleado-generic`
   - Add to the migration SQL: copy rows from CertificadoAlturas → CertificadoEmpleado (tipo=ALTURAS) and CertificadoRiesgoElectrico → CertificadoEmpleado (tipo=RIESGO_ELECTRICO)
   - Then drop the old tables
3. **employees.routes.ts**: update `PUT /employees/:id/certificados` to accept `{ certificados: [{tipo, nombre?, fechaExpedicion, fechaVencimiento}] }` (replace-all: delete existing rows for employee, insert new list)
4. **EmpleadoCertificadosEditor.vue** (NEW component in `frontend/app/components/`): 
   - Props: `modelValue: CertificadoEmpleadoInput[]`, emit `update:modelValue`
   - Renders a list of certificate rows; each row: tipo Select (ALTURAS/RIESGO_ELECTRICO/MANIPULACION_ALIMENTOS/OTRO), nombre InputText (shown only when OTRO), fechaExpedicion date, fechaVencimiento date, remove button
   - "Agregar certificado" button adds a blank row
5. **empleados/nuevo.vue** step 5: replace fixed Alturas+Riesgo toggles with `<EmpleadoCertificadosEditor v-model="form.certificados" />`
6. **empleados/[id]/editar.vue** tab 5: same replacement; on load, map existing CertificadoEmpleado rows to the component's format
7. Run playwright local-qa P4 spec: assert component renders on both nuevo + editar; add a MANIPULACION_ALIMENTOS cert, save → verify response 200

### Phase P5 — Clientes selects (no migration)
1. **pacientes/crear.vue**: replace genero text input with PrimeVue Select `['MASCULINO', 'FEMENINO', 'OTRO']`; for parentesco in contactos de emergencia section: Select `['PADRE', 'MADRE', 'HIJO', 'OTRO']` + conditional InputText "¿Cuál?" when OTRO is selected (stored in the `parentesco` column as the custom text value)
2. **pacientes/[id]/editar.vue**: same changes in the corresponding form sections
3. Backend employees routes: Zod for genero should accept the three enum values (or keep as string — the column is varchar; just narrow in Zod if convenient)
4. Run playwright local-qa P5 spec → green

## Key Files / Resources

- `/Users/jeik/ws/mi-empresa-app-development/context/implementation-plan/certificados-empleados-clientes-improvements-plan.md` — full feature plan with exact decisions
- `/Users/jeik/ws/mi-empresa-app-development/backend/prisma/schema.prisma` — current schema
- `/Users/jeik/ws/mi-empresa-app-development/backend/src/routes/certificates.routes.ts` — cert route (empresaId already in Zod)
- `/Users/jeik/ws/mi-empresa-app-development/backend/src/services/certificateService.ts` — ALREADY EDITED: empresaId is `?: number` (optional)
- `/Users/jeik/ws/mi-empresa-app-development/backend/src/routes/employees.routes.ts` — employee routes + certificados PUT
- `/Users/jeik/ws/mi-empresa-app-development/frontend/app/pages/certificados/crear.vue` — cert create form
- `/Users/jeik/ws/mi-empresa-app-development/frontend/app/pages/certificados/index.vue` — cert list (add badge here)
- `/Users/jeik/ws/mi-empresa-app-development/frontend/app/pages/empleados/nuevo.vue` — create wizard
- `/Users/jeik/ws/mi-empresa-app-development/frontend/app/pages/empleados/[id]/editar.vue` — edit page
- `/Users/jeik/ws/mi-empresa-app-development/frontend/app/pages/pacientes/crear.vue` — patient create
- `/Users/jeik/ws/mi-empresa-app-development/frontend/app/pages/pacientes/[id]/editar.vue` — patient edit
- `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/local-qa/bug-validation.spec.ts` — existing repro spec (flip BUG-1)
- `/Users/jeik/ws/mi-empresa-app-development/frontend/playwright.config.ts` — test config
- `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/empleado-crear-completo.spec.ts` — reference for wizard selectors
- `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/certificado-crear.spec.ts` — reference (add happy-path submit here)

## Implementation Location

- Source code: `/Users/jeik/ws/mi-empresa-app-development/`
- Backend: `/Users/jeik/ws/mi-empresa-app-development/backend/`
- Frontend: `/Users/jeik/ws/mi-empresa-app-development/frontend/`

## Expected Deliverables

| File | Description |
|------|-------------|
| `development/mi-empresa-cert-mejoras/tasks/cert-empleado-mejoras/result.md` | Summary of all changes per phase |
| `development/mi-empresa-cert-mejoras/tasks/cert-empleado-mejoras/completion-report.md` | Handoff + deferred items |
| `backend/src/routes/certificates.routes.ts` | P1+P2 changes |
| `backend/src/services/certificateService.ts` | P1 getDefaultEmpresaId + P2 type update |
| `backend/prisma/schema.prisma` | P2+P3+P4 migrations |
| `backend/src/routes/employees.routes.ts` | P4 new certificados shape |
| `frontend/app/pages/certificados/crear.vue` | P2 form order + tipos |
| `frontend/app/pages/certificados/index.vue` | P2 POR_VENCER badge |
| `frontend/app/pages/empleados/nuevo.vue` | P3+P4 |
| `frontend/app/pages/empleados/[id]/editar.vue` | P3+P4 |
| `frontend/app/components/EmpleadoCertificadosEditor.vue` | P4 new shared component |
| `frontend/app/pages/pacientes/crear.vue` | P5 |
| `frontend/app/pages/pacientes/[id]/editar.vue` | P5 |
| `frontend/tests/local-qa/bug-validation.spec.ts` | P1 flip |
| `frontend/tests/local-qa/` | New specs per phase (P2–P5) |

## Tools Likely Needed
- Read, Edit, Write (file changes)
- Bash (prisma migrate, restart servers, run playwright)
- Sub-agents (Explore for reading wide file surfaces)

## Acceptance Criteria
1. `POST /api/v1/certificates` without `empresaId` in body → **201** (not 400)
2. BUG-1 Playwright test in `local-qa/bug-validation.spec.ts` → **green**
3. All new TipoCertificadoEmpresa values visible in `/certificados/crear` form
4. POR_VENCER badge appears on certs with vencimiento ≤ 30 days
5. TipoVivienda shows PROPIA/ARRENDADA/FAMILIAR (not CASA/APARTAMENTO/LOTE)
6. Salario field visible on cargo step (nuevo) and cargo tab (editar)
7. EmpleadoCertificadosEditor.vue renders on both wizard step 5 and edit tab 5
8. MANIPULACION_ALIMENTOS cert can be added and saved (200 from PUT)
9. Genero in pacientes is a Select (3 options, not free-text)
10. Parentesco in pacientes is a Select; OTRO shows inline custom text field
11. All local-qa Playwright specs pass

## Constraints / Watch-outs
- **certificateService.ts**: `empresaId` is ALREADY `?: number` — do not undo this; just add the `getDefaultEmpresaId` helper
- **No staging**: all validation is local only. Never touch staging URLs or prod AWS resources.
- **Prisma enum migration in PostgreSQL**: changing an enum requires using a temp column or multi-step migration. Recommended: `prisma migrate dev --create-only --name <name>` to get the empty migration file, then manually write the SQL (change-enum approach), then `prisma migrate dev` to apply.
- **PrimeVue 4**: use `<Select>` (not `<Dropdown>`) for all selects; options can be `[{label: '...', value: '...'}]` or plain string array; existing pages are the reference.
- **Data migration**: only dev/test data exists — safe to map old enum values to new ones; old cert tables (Alturas, Riesgo) rows must be copied before dropping.
- **Nuxt dev server**: hot-reload handles most frontend changes; restart only when env vars change.
- **Playwright baseURL**: read `playwright.config.ts` to confirm `TEST_FRONTEND_URL` env var pattern; set it to `http://localhost:3100` when running local-qa tests.
- **Salario on Cargo**: the schema already has a `salario` column on a `Deducciones` or payroll model — check carefully before adding; the new one is specifically on `Cargo` (the job position record), not payroll.
- **Self-repair budget**: max 2 attempts per error before escalating via TURNING-POINT-STRATEGY.
