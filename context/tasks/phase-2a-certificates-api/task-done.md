# Task: A3 - Certificate CRUD Routes + Service

## Task Definition

Implement certificate management API for the CertificadoEmpresa model, including:
- Service layer with full CRUD + stats
- REST routes with authentication, role-based access, and Zod validation
- Registration of certificate routes in the main router

Depends on: A2 (CertificadoEmpresa Prisma schema)

## Plan

1. Create `src/services/certificateService.ts` with listCertificates, getCertificate, createCertificate, updateCertificate, deleteCertificate, getCertificateStats
2. Create `src/routes/certificates.routes.ts` with GET /stats, GET /, GET /:id, POST /, PUT /:id, DELETE /:id
3. Update `src/routes/index.ts` to import and register certificateRoutes at /certificates
4. Write task report

## Output Summary

### Files Created

- `/Users/jeik/ws/mi-empresa-app-development/backend/src/services/certificateService.ts`
  - listCertificates: paginated list with optional tipo/estado filters
  - getCertificate: single certificate by id
  - createCertificate: creates record with creadoPor from authenticated user
  - updateCertificate: partial update, throws if not found
  - deleteCertificate: hard delete, throws if not found
  - getCertificateStats: counts by estado (VIGENTE/VENCIDO/PENDIENTE) + total

- `/Users/jeik/ws/mi-empresa-app-development/backend/src/routes/certificates.routes.ts`
  - All routes under authMiddleware()
  - GET /stats - open to all authenticated users
  - GET / - list with pagination, tipo, estado query filters
  - GET /:id - single lookup with 404 handling
  - POST / - requireRole('ADMIN') + Zod createCertificateSchema validation
  - PUT /:id - requireRole('ADMIN') + Zod updateCertificateSchema (partial) validation
  - DELETE /:id - requireRole('ADMIN') with 404 handling

### Files Modified

- `/Users/jeik/ws/mi-empresa-app-development/backend/src/routes/index.ts`
  - Added import for certificateRoutes
  - Registered router.use('/certificates', certificateRoutes)
  - Upload routes were already registered (added by A1 task)

## Key Decisions

- `parseInt(req.params.id as string)` cast used consistently with existing codebase pattern
- Default estado for new certificates: PENDIENTE
- Stats endpoint placed before /:id route to prevent route shadowing
- Errors from service layer (Certificate not found) mapped to HTTP 404; all others to 500
- Enum values cast with `as any` to satisfy Prisma generated types while keeping strict TypeScript interfaces

## TypeScript Status

- No errors in certificate-specific files
- Pre-existing errors in employees.routes.ts and patients.routes.ts (outside A3 scope)
