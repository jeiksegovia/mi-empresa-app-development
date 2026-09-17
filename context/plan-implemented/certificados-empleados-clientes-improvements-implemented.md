# cert-empleado-mejoras — Implemented
Date: 2026-07-04
Plan: context/implementation-plan/certificados-empleados-clientes-improvements-plan.md

## Overview
P1–P5 fully implemented locally (backend :3101, frontend :3100, postgres :15432). 13/13 Playwright local-qa specs green in 34.4s. dashboardService dead-ref fix applied post-worker.

## Key Decisions
- empresaId derived server-side via getDefaultEmpresaId() (single-tenant, findFirst); Zod schema .optional()
- P2003 FK violation → 400 (was 500 generic)
- TipoCertificadoEmpresa enum replaced: ALCALDIA/GOBERNACION/SECRETARIAS/TRIBUTARIOS/REGISTRO_MERCANTIL/OTRO; old values mapped via CASE SQL
- TipoVivienda reset to PROPIA/ARRENDADA/FAMILIAR — all old rows → PROPIA (only dev data existed)
- Cargo.salario Decimal(12,2) added; help text "se extraerá de nómina cuando el módulo esté activo"
- CertificadoAlturas + CertificadoRiesgoElectrico replaced by generic CertificadoEmpleado with TipoCertificadoEmpleado enum (ALTURAS/RIESGO_ELECTRICO/MANIPULACION_ALIMENTOS/OTRO); 2 dev rows migrated
- EmpleadoCertificadosEditor.vue (PrimeVue 4 Select) shared between nuevo wizard step 5 and editar tab 5; v-model:certificados
- Pacientes genero: Select MASCULINO/FEMENINO/OTRO. Parentesco: Select PADRE/MADRE/HIJO/OTRO + inline InputText when OTRO (stored in same column)
- dashboardService: replaced prisma.certificadoAlturas.count() + prisma.certificadoRiesgoElectrico.count() with prisma.certificadoEmpleado.count()

## Migration approach (all phases)
Prisma migrate dev --create-only → manual SQL (rename→create new enum→temp col→CASE UPDATE→drop old) → prisma migrate deploy. Avoided --shadow-database-url entirely.

## Files changed
backend/src/services/certificateService.ts — getDefaultEmpresaId helper
backend/src/routes/certificates.routes.ts — empresaId optional, P2003→400
backend/src/routes/employees.routes.ts — PUT /certificados list shape (replace-all)
backend/src/services/dashboardService.ts — dead ref fix (post-worker)
backend/prisma/schema.prisma — TipoCertificadoEmpresa, TipoVivienda, Cargo.salario, CertificadoEmpleado model
backend/prisma/migrations/ — f1-cert-taxonomy, f2-vivienda-salario, f2-cert-empleado-generic
frontend/app/pages/certificados/crear.vue — form reorder + new tipo options
frontend/app/pages/certificados/index.vue — POR_VENCER badge (≤30 days, client-side)
frontend/app/pages/empleados/nuevo.vue — TipoVivienda options, salario field, EmpleadoCertificadosEditor step 5
frontend/app/pages/empleados/[id]/editar.vue — same on cargo tab + EmpleadoCertificadosEditor tab 5
frontend/app/components/EmpleadoCertificadosEditor.vue — NEW shared component
frontend/app/pages/pacientes/crear.vue — genero Select, parentesco Select + OTRO inline
frontend/app/pages/pacientes/[id]/editar.vue — same
frontend/tests/local-qa/bug-validation.spec.ts — BUG-1 flipped 400→201
frontend/tests/local-qa/p2-cert-types.spec.ts — NEW
frontend/tests/local-qa/p3-empleado-fields.spec.ts — NEW
frontend/tests/local-qa/p4-cert-editor.spec.ts — NEW
frontend/tests/local-qa/p5-clientes-selects.spec.ts — NEW

## Deferred
- P6 staging deploy (CodeDeploy + frontend deploy + staging QA) — schedule separately
- Email POR_VENCER notifications — blocked on SMTP creds (no env on any stage)
- Staging prerequisite: seed empresa row on staging (extend prisma/test-db/ with idempotent seed-empresa.ts)

## Grep hooks
cert-mejoras certificadoEmpleado TipoCertificadoEmpleado EmpleadoCertificadosEditor POR_VENCER getDefaultEmpresaId
