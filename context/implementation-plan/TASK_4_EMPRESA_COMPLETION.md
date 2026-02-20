# Task 4: Empresa Entity - Backend Schema + Service

**Date**: 2026-02-19
**Status**: COMPLETED

---

## Summary

Added the `Empresa` model as a standalone entity to the backend. This includes the Prisma schema model, database migration, service layer, REST API routes, seed data, and Playwright tests.

---

## Files Changed

### 1. `/Users/jeik/ws/mi-empresa-app-development/backend/prisma/schema.prisma`
- Added `Empresa` model before the `// ENUMS` section
- Model maps to `empresas` table with fields: `id`, `nombre`, `nit` (unique), `direccion`, `telefono`, `email`, `activa`, `createdAt`, `updatedAt`

### 2. `/Users/jeik/ws/mi-empresa-app-development/backend/prisma/seed.ts`
- Added `await prisma.empresa.deleteMany()` to the cleanup block
- Added default empresa creation after user creation
- Updated summary section to include `Empresa: 1 (default)`

### 3. `/Users/jeik/ws/mi-empresa-app-development/backend/src/services/empresaService.ts` (NEW)
- `getEmpresa()`: fetches the first active empresa
- `updateEmpresa(id, input)`: updates empresa fields by ID, throws if not found

### 4. `/Users/jeik/ws/mi-empresa-app-development/backend/src/routes/empresa.routes.ts` (NEW)
- `GET /empresa` - returns current active empresa (authenticated)
- `PUT /empresa/:id` - updates empresa fields (ADMIN role only)
- Uses `authMiddleware()`, `validate()` with Zod schema

### 5. `/Users/jeik/ws/mi-empresa-app-development/backend/src/routes/index.ts`
- Added import for `empresaRoutes`
- Registered `router.use('/empresa', empresaRoutes)`

### 6. `/Users/jeik/ws/mi-empresa-app-development/backend/tests/empresa/empresa.spec.ts` (NEW)
- Playwright API tests: 401 without auth, GET returns empresa data, PUT updates fields

---

## Migration Result

Migration `20260220022425_add_empresa_entity` applied successfully.

Generated SQL:
```sql
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "nit" VARCHAR(50) NOT NULL,
    "direccion" VARCHAR(255),
    "telefono" VARCHAR(20),
    "email" VARCHAR(255),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "empresas_nit_key" ON "empresas"("nit");
```

Prisma Client regenerated successfully. TypeScript compile check passed (`tsc --noEmit` with zero errors).

---

## API Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/empresa` | Required | Any | Get active empresa |
| PUT | `/api/v1/empresa/:id` | Required | ADMIN | Update empresa fields |

---

## Notes

- No FK references to other models as instructed (standalone entity)
- NIT field has a unique constraint; duplicate NIT returns 409 with Spanish message
- ADMIN role check is done in the PUT handler using `req.user.rol`
