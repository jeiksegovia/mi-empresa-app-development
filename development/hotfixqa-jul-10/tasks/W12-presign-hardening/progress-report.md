# W12 progress-report — I1+I2+I3 presign hardening

**Worker**: pt-backend-eng
**Started**: 2026-07-11
**Task ID**: `20`
**Scope**: I1 + I2 + I3 from `presign-security-analysis.md` (I4-I6 out of scope)

---

## What I did (chronological)

1. **Read context** — `presign-security-analysis.md`, `s3Service.ts`,
   `awsCredentials.ts`, `uploads.routes.ts`, `awsCredentials.spec.ts`,
   `uploads.spec.ts`, `env.ts`.
2. **Confirmed no other call sites of `generateDownloadUrl` /
   `generateUploadUrl`** — `grep -rn` shows only the service itself +
   uploads.routes.ts. No hard-coded 3600 outside `s3Service.ts`.
3. **Implemented I1 + I2 + I3 in `services/s3Service.ts`**:
   - Added typed `CredentialsExpiredError` (`.code='CREDS_EXPIRED'`,
     `.status=503`).
   - Added pure helpers `assertCredentialsUsable` and
     `clampExpiresToCredLifetime`.
   - Added `EXPIRY_MARGIN_SEC=60` constant.
   - `generateUploadUrl` and `generateDownloadUrl` now both:
     a) resolve active credentials, b) run the I1 guard, c) clamp via
     I2 helper, d) call `getSignedUrl`.
   - `generateDownloadUrl` default `expiresIn = 900` (was 3600).
   - **Local default-chain behavior is byte-identical**: helpers
     early-return / passthrough when `creds?.expiration` is missing.
   - P0 provider semantics in `awsCredentials.ts` UNCHANGED — only
     additional exports from `s3Service.ts`.
4. **Refactored `routes/uploads.routes.ts`**:
   - Converted the module-singleton `router` into a factory
     `createUploadRoutes(authMw = authMiddleware())`.
   - The default export (`uploadRoutes`) still mounts the real auth
     middleware — backward-compat preserved for `routes/index.ts`.
   - Added `isCredsExpired(error)` predicate; both routes catch the
     error and return 503 with Spanish user message
     `'Servicio de archivos temporalmente no disponible'` and
     `code: 'CREDS_EXPIRED'`.
   - Non-cred errors keep the legacy 500 shape.
5. **Added unit tests `tests/s3/s3Service.spec.ts`** (22 tests):
   - 11 pure-helper assertions (`assertCredentialsUsable`,
     `clampExpiresToCredLifetime`, `throwCredentialsExpired`,
     margin edges, default-chain passthrough).
   - 4 upload e2e tests through `__setProviderForTest` (I1 past,
     I1 inside margin, I2 clamp, default-chain passthrough).
   - 6 download e2e tests (I3 default=900, I1 past, I2 clamp 10min,
     I2 passthrough 30min, I2 upload passthrough, I1+I2 combined).
   - Test seam `__setProviderForTest` (prefixed `__` to signal
     test-only intent; production code does not use it).
6. **Added route-level tests `tests/uploads/uploads-credentials-expired.spec.ts`**
   (6 tests) using supertest against a small Express app built with
   `createUploadRoutes(passThroughAuth)` — verifies 503 + correct
   body shape on POST/GET for both past-creds and inside-margin
   cases, plus a 500-legacy-path test for non-cred errors.
7. **Live curl verification on local backend :3101**:
   - POST `/uploads/presigned-url` returned 200, `X-Amz-Expires=300`
     (unchanged, matches spec default).
   - GET `/uploads/download-url` returned 200, `X-Amz-Expires=900`
     (NEW — was 3600, now quartered).
   - Default-chain path produces NO I1 throw — confirmed byte-identical
     to legacy behavior.
8. **Final test runs** — see `result.md`.

---

## Decisions captured

- **Test seam (`__setProviderForTest`)**: kept the public API of
  `s3Service.ts` unchanged; added a `__`-prefixed setter to swap the
  internal provider so tests can deterministically feed the
  fail-fast path. Provider swaps also rebuild the module-level
  `S3Client` so the actual signature path goes through the real SDK.
- **Refactor of route to factory** (`createUploadRoutes`): needed to
  bypass the DB-bound `authMiddleware()` in the route-level
  supertest harness. Backward-compat preserved via default export.
- **`EXPIRY_MARGIN_SEC = 60`** — matches AWS SDK's own
  `memoizeChain` invalidation window (~5 min for STS sessions is
  wider than we need; 60s is the strict "safe to sign" margin per
  the analysis).
- **Default-chain behavior MUST stay byte-identical**: constraint
  from the spec. Verified by both the helper unit tests AND the live
  curl on `~/.aws/credentials`-backed local dev.
- **No P0 changes** — `awsCredentials.ts` semantics and exports
  preserved; all `tests/s3/awsCredentials.spec.ts` P0 tests still
  pass verbatim.

---

## Blockers / open items

None.
