# W6 Empresa Bootstrap — Result

**Worker**: pt-fullstack-impl · **Task ID**: 33 · **Date**: 2026-07-10
**Local backend**: :3101 · **Frontend**: :3100 · **Dev DB empresa**: id 6 (untouched)

## Summary
The "still an error" symptom on staging (where empresas=0) was caused by:
1. **No POST path for empresa**: `backend/src/routes/empresa.routes.ts` exposed only `GET /` and `PUT /:id`. On an empty DB no row could be created.
2. **404 on GET /empresa when empty**: `authStore.fetchEmpresa()` swallowed the 404 silently → `auth.empresa === null` → `empresa/editar.vue` showed an empty form with `empresaId.value === null`, and `submit()` surfaced the toast error "No se pudo identificar la empresa".
3. **No cargo seed on bootstrap**: `jul9_cargo_empresa` migration's cargo seed loop was a `CROSS JOIN` against `empresas` → on staging (0 empresas) it seeded 0 rows.

## What was changed
- **backend/src/services/empresaService.ts**: added `createEmpresa(input)` + `DEFAULT_CARGOS` constant + `CreateEmpresaInput` interface. Wraps `prisma.$transaction` around `empresa.create` + `cargoEmpresa.createMany({ skipDuplicates: true })` for atomicity.
- **backend/src/routes/empresa.routes.ts**: added `POST /` (ADMIN) + `createEmpresaSchema` (Zod, E1 uppercase on nombre, nombre+nit required); normalized `GET /` to return `200 { data: null }` on empty (was `404`).
- **frontend/app/stores/auth.ts**: `fetchEmpresa()` now coerces `response.data ?? null` so it tolerates the empty-state contract without throwing.
- **frontend/app/pages/empresa/editar.vue**: added `isCreateMode` computed; the page renders as "Crear Empresa" with banner + create-only submit button when `authStore.empresa` is null. Cargos manager card is hidden in create mode. Submit branches between POST (create) and PUT (update). Data-testids added: `empresa-form`, `empresa-create-banner`, `empresa-nombre`, `empresa-nit`.
- **frontend/app/pages/empresa/index.vue**: added empty-state Card with "Crear Empresa" CTA when `authStore.empresa === null`. Loading state now distinguishes "still loading" from "loaded but empty". Data-testids: `empresa-empty-state`, `empresa-crear-cta`.

## What was added (tests)
- **backend/tests/empresa/empresa-bootstrap.spec.ts** — 6 specs, all green locally:
  - GET /empresa returns existing row (normalized 200 contract — never 404)
  - POST /empresa when exists → 409 `{ field: 'empresa' }`
  - POST /empresa unauthenticated → 401
  - POST /empresa missing fields → 400 Zod
  - POST /empresa invalid email → 400 Zod
  - GET /empresa/cargos returns 7 default cargos (Fisioterapeuta, Terapeuta Ocupacional, Educador Físico, Manualidades, Auxiliar de Enfermería, Auxiliar de Servicios Generales, Otro)
- **frontend/tests/local-qa/jul10-empresa-bootstrap.spec.ts** — 2 specs, all green with matching LAN IP env vars:
  - Empty-state UI: GET /empresa intercepted → 200 { data: null } → page renders "Crear Empresa" form (banner visible, cargos hidden) + POST triggers 201 + no console errors
  - Empty-state CTA on /empresa index page renders "Crear Empresa" button when no empresa exists

## What was NOT done (out of scope for this worker)
- ❌ Hotfix deploy to staging — orchestrator's decision per task spec §4a. Exact commands in completion-report.md.
- ❌ Full create-from-empty verification locally — local DB has empresa id 6 (single-empresa invariant), so the create path is exercised on staging post-deploy.
- ❌ Any git commit — per task spec.

## Staging BEFORE evidence (captured live 2026-07-10, READ-ONLY)
```
login: 200 (qa@miempresa.com)
GET /empresa:        HTTP=404  {"success":false,"message":"Empresa not found"}
GET /empresa/cargos: HTTP=200  {"success":true,"data":[]}
empresas=0  cargos=0  contratos=0  (on-instance psql)
```

## Local AFTER evidence (live 2026-07-10)
```
GET /empresa:        HTTP=200  {"success":true,"data":{"id":6,"nombre":"MI EMPRESA S.A.S.","nit":"900123456-1",...}}
POST /empresa dup:   HTTP=409  {"success":false,"message":"La empresa ya existe","field":"empresa"}
POST /empresa empty: HTTP=400  {"success":false,"message":"Validation error","errors":{"nombre":["..."],"nit":["Required"]}}
POST /empresa no-auth: HTTP=401
```

## Backend specs (16/16 green locally)
- empresa-bootstrap.spec.ts: 6/6 (W6 new)
- empresa.spec.ts: 3/3 (existing, no regression)
- cargos-crud.spec.ts: 7/7 (existing, no regression)

## Frontend specs (4/4 green with matching LAN IP)
- jul10-empresa-bootstrap.spec.ts: 2/2 (W6 new)
- jul9-empresa-save.spec.ts: 1/1 (regression)
- jul9-cargos-manager.spec.ts: 1/1 (regression)