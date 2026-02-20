# Task Completion: Empresa Entity - Backend Schema + Service

## Summary
Added standalone Empresa model to the system for company information management.

## Changes Made

### backend/prisma/schema.prisma
Added Empresa model with fields: id, nombre, nit (unique), direccion, telefono, email, activa, createdAt, updatedAt

### Database Migration
- Ran: npx prisma migrate dev --name add-empresa-entity
- Created table: empresas

### backend/prisma/seed.ts
- Added empresa.deleteMany() to cleanup
- Added default Empresa seed: "Mi Empresa S.A.S." with NIT 900123456-1

### backend/src/services/empresaService.ts (new)
- getEmpresa(): finds first active empresa
- updateEmpresa(id, input): updates empresa by id

### backend/src/routes/empresa.routes.ts (new)
- GET /empresa: returns first active empresa (auth required)
- PUT /empresa/:id: updates empresa (ADMIN only, 403 for non-admin)

### backend/src/routes/index.ts
- Added import and mount for empresaRoutes

### backend/tests/empresa/empresa.spec.ts (new)
- 3 serial tests: 401 without auth, GET returns data, PUT updates fields

## Test Results
- empresa.spec.ts: 3/3 passed
- Full backend suite: 123 passed
