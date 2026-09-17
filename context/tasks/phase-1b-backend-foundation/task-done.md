# Task Done: Phase 1B Backend Foundation (A1, A7, A8)

**Date**: 2026-03-10
**Status**: Completed

---

## Task Definitions

- **A1**: S3 Presigned Upload Service - create S3 service and uploads route with presigned URL generation
- **A7**: Empresa Route Admin Guard - apply `requireRole('ADMIN')` middleware to all empresa routes
- **A8**: Instrument Status Transition Validation - enforce state machine rules in `updateRecord`

---

## Plan

1. Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
2. Create `src/services/s3Service.ts` with upload/download presigned URL generators
3. Create `src/routes/uploads.routes.ts` with `POST /uploads/presigned-url` and `GET /uploads/download-url`
4. Register upload routes in `src/routes/index.ts`
5. Update `empresa.routes.ts` to import and apply `requireRole('ADMIN')` on GET and PUT
6. Update `instrumentService.ts` `updateRecord` to validate state transitions before writing

---

## Commands Run

```bash
cd /Users/jeik/ws/mi-empresa-app-development/backend && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
# added 108 packages
npx tsc --noEmit
# only pre-existing error in patients.routes.ts (unrelated)
```

---

## Files Created

- `/Users/jeik/ws/mi-empresa-app-development/backend/src/services/s3Service.ts`
  - `generateUploadUrl(key, contentType, expiresIn=300)` - returns PutObject presigned URL
  - `generateDownloadUrl(key, expiresIn=3600)` - returns GetObject presigned URL
  - Uses `config.aws.region` and `config.aws.s3Bucket` from existing env config

- `/Users/jeik/ws/mi-empresa-app-development/backend/src/routes/uploads.routes.ts`
  - `POST /uploads/presigned-url` - body: `{ contentType, folder?, filename? }`, returns `{ uploadUrl, key }`
  - `GET /uploads/download-url?key=...` - returns `{ downloadUrl }`
  - Protected by `authMiddleware()`
  - Uses `crypto.randomUUID()` (Node 18+ built-in) instead of `uuid` package (not in package.json)

---

## Files Modified

- `/Users/jeik/ws/mi-empresa-app-development/backend/src/routes/index.ts`
  - Added `import { uploadRoutes } from './uploads.routes.js'`
  - Added `router.use('/uploads', uploadRoutes)` before health check

- `/Users/jeik/ws/mi-empresa-app-development/backend/src/routes/empresa.routes.ts`
  - Changed `import { authMiddleware }` to `import { authMiddleware, requireRole }`
  - GET `/empresa` route: added `requireRole('ADMIN')` as second middleware argument
  - PUT `/:id` route: added `requireRole('ADMIN')` as second middleware argument, removed inline `user.rol !== 'ADMIN'` check

- `/Users/jeik/ws/mi-empresa-app-development/backend/src/services/instrumentService.ts`
  - `updateRecord` function: added state transition guard block before `updateData` construction
  - Valid transitions enforced:
    - PENDIENTE → COMPLETADO (requires `archivoCompletado`)
    - PENDIENTE → VENCIDO (allowed)
    - COMPLETADO → VENCIDO (allowed)
    - VENCIDO → anything: throws `Invalid state transition: cannot transition from VENCIDO to X`
    - COMPLETADO → PENDIENTE: throws `Invalid state transition: cannot transition from COMPLETADO to PENDIENTE`
    - COMPLETADO without `archivoCompletado`: throws `archivoCompletado is required to transition to COMPLETADO`

---

## Issues / Notes

- `uuid` package was not in `package.json`; used `crypto.randomUUID()` (Node 18+ built-in) in the uploads route to generate unique S3 keys. No extra dependency needed.
- Pre-existing TypeScript error in `patients.routes.ts` line 145 (`string | string[]` argument type mismatch) - unrelated to this task, not introduced here.
- AWS credentials are resolved at runtime via IAM role (EC2/Lambda instance profile) or local AWS profile (`config.aws.profile`). No credentials are hard-coded.
- `requireRole('ADMIN')` in `auth.ts` also short-circuits to `next()` if `req.user.rol === 'ADMIN'`, so passing `'ADMIN'` as the role argument is semantically redundant but explicit and clear.
