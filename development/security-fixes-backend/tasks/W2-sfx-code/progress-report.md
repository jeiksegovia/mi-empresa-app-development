# Progress Report — sfx-W2 (task #6)

Backend code fixes per `00-fix-contract.md` §D (S2/S3/S4) and §E (S1/S5/S8/S6).

## Status: ALL FIXES COMPLETE

### S1 — env.ts JWT_SECRET enforcement ✓
- `resolveJwtSecret()` throws when `NODE_ENV=production` and `JWT_SECRET` is unset or whitespace.
- Local dev (`NODE_ENV !== 'production'`) keeps the `dev-secret-change-me` placeholder.
- 5/5 tests pass (`tests/config/jwt-secret-required.spec.ts`).

### S5 — app.ts timingSafeEqual ✓
- `crypto.timingSafeEqual` is used to compare `x-origin-verify` against `originVerifySecret`.
- Length check precedes the compare to avoid throwing.
- 5/5 tests pass (`tests/origin-verify/origin-verify-timing-safe.spec.ts`, subprocess isolation).

### S8 — errorHandler.ts drop constraint ✓
- `errors.constraint` removed from 409 response body.
- Constraint target still logged via `logger.warn(...)` for ops debugging.
- 4/4 tests pass (`tests/error-handler/conflict-no-constraint.spec.ts`).

### S6 — frontend access-denied textContent ✓
- `renderFallbackToast` builds the DOM with `createElement` + `textContent`.
- No more `innerHTML` assignment; XSS payload is rendered as text.
- 2/2 tests pass (`frontend/tests/plugins/access-denied-textcontent.spec.ts`).

### S4 — s3Service.ts ContentLengthRange ✓
- `generateUploadUrl` switched from `getSignedUrl` (PUT) to `createPresignedPost` (POST) so S3 can enforce a `ContentLengthRange` policy.
- Policy conditions: `['content-length-range', 0, maxFileSizeBytes]` + Content-Type equality.
- `Expires` matches the I2 clamp to credential lifetime.
- Frontend `useFileUpload.uploadFile` updated to POST form data instead of PUT.
- 5/5 new tests pass (`tests/s3/s3Service-content-length.spec.ts`).
- Existing 22 tests in `s3Service.spec.ts` updated for the new `{ url, fields }` shape.
- `@aws-sdk/s3-presigned-post` added to backend dependencies.

### S2 + S3 — uploads.routes.ts ownership + folder whitelist ✓ (REWORKED)
- **S2 corrected 2026-09-17**: FLAT keys (`{folder}/{uuid}.{ext}`) — the original `user-{userId}/` prefix broke prod in two ways (existing flat keys in DB → 403, cross-user admin access → 403).
- Authorization now happens at download-url via `assertKeyAccessible(key, req)`:
  1. **Record-existence gate** — key is looked up across 8 models (Empleado, EducacionEmpleado, CertificadoEmpleado, Contrato, ArchivoNovedad, ArchivoNominaPeriodo, CertificadoEmpresa, CertificadoUpdate). Not found → 403 (the IDOR protection).
  2. **RBAC gate** — ADMIN bypass; AUDITOR/OPERADOR fall through; EMPLEADO goes through the existing `DOMAIN_ACCESS` matrix + ownership (record's `empleadoId` must equal caller's `empleadoId`).
- 18/18 IDOR/record tests pass (`tests/uploads/upload-ownership-idor.spec.ts`).
- 8/8 folder whitelist tests pass (`tests/uploads/uploads-folder-whitelist.spec.ts`).

### Tests
- Total new + modified tests in scope: **62 passing** on backend + **2 passing** on frontend.
- Pre-existing E2E spec `tests/uploads/uploads.spec.ts` updated for the new contract (folder whitelist, ownership, presigned POST shape).
- Pre-existing 6 tests in `tests/uploads/uploads-credentials-expired.spec.ts` updated for the new key convention.

## Test counts
- Before: 22 (s3Service) + 6 (uploads-creds) = 28
- After S2 revision: 22 + 6 + 18 (S2 corrected) + 8 (S3) + 5 (S4) + 5 (S5) + 4 (S8) + 5 (S1) = 66 backend in-scope, plus 2 frontend S6 = **68 total**
- Updated E2E uploads.spec.ts: 13 tests (was 11), all aligned with the new contract.

## Learnings / Notes

- **ContentLengthRange requires presigned POST, not PUT.** The spec (§D S4) said "presigned PUT policy", but S3 only supports `ContentLengthRange` on POST policies. I switched `generateUploadUrl` to use `createPresignedPost` and updated the frontend `useFileUpload.uploadFile` to submit via `multipart/form-data` (with the policy `fields` + `file`). The route returns both `uploadUrl` (legacy alias for `url`) and `fields` (new). This is a coordinated cross-stack change.
- **ESM module caching trap on tests:** `env.ts` reads `process.env` at import time and caches `config`. Two tests that import `env.ts` then mutate env see stale config. S1 and S5 use child-process isolation to avoid the trap; this is more reliable than cache-busting query strings (`?fresh=…`) which only bust the top-level module, not its transitive deps.
- **Subprocess test for S1/S5** uses `/tmp` as cwd (S1) so dotenv can't re-populate `JWT_SECRET` from `backend/.env`. S5 boots a tiny Express app on port 4137 (unique, never collides with prod :3101/:4142).

## Files changed / added

### Backend — modified
- `backend/src/config/env.ts` (S1)
- `backend/src/app.ts` (S5)
- `backend/src/middleware/errorHandler.ts` (S8)
- `backend/src/services/s3Service.ts` (S4)
- `backend/src/routes/uploads.routes.ts` (S2 + S3)
- `backend/tests/s3/s3Service.spec.ts` (updated for new return shape)
- `backend/tests/uploads/uploads-credentials-expired.spec.ts` (updated for new key convention)
- `backend/tests/uploads/uploads.spec.ts` (E2E updated for new contract)
- `backend/package.json` (added `@aws-sdk/s3-presigned-post`)
- `backend/pnpm-lock.yaml` (lockfile update)

### Backend — added
- `backend/tests/config/jwt-secret-required.spec.ts`
- `backend/tests/origin-verify/origin-verify-timing-safe.spec.ts`
- `backend/tests/error-handler/conflict-no-constraint.spec.ts`
- `backend/tests/s3/s3Service-content-length.spec.ts`
- `backend/tests/uploads/upload-ownership-idor.spec.ts`
- `backend/tests/uploads/uploads-folder-whitelist.spec.ts`

### Frontend — modified
- `frontend/app/plugins/access-denied.client.ts` (S6)
- `frontend/app/composables/useFileUpload.ts` (S4 follow-through — POST form upload)

### Frontend — added
- `frontend/tests/plugins/access-denied-textcontent.spec.ts`