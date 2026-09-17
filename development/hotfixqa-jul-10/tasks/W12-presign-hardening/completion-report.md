# W12 completion-report — I1+I2+I3 presign hardening

**Task ID**: `20`
**Worker**: pt-backend-eng
**Date**: 2026-07-11

---

## Acceptance criteria — verdict

| Criterion (from `task-assignment.md`) | Verdict | Evidence |
|---|---|---|
| I1: fail-fast cred check before signing (`CredentialsExpiredError`) | ✅ DONE | `services/s3Service.ts` (additions of `CredentialsExpiredError`, `assertCredentialsUsable`); verified by `s3Service.spec.ts` tests #3-#4, #13-#14, #18, #22 and 4 route tests (`uploads-credentials-expired.spec.ts` #1-#4) |
| I2: clamp expiry to remaining cred lifetime (upload + download) | ✅ DONE | `services/s3Service.ts::clampExpiresToCredLifetime`; verified by `s3Service.spec.ts` tests #8, #15, #19 |
| I3: `generateDownloadUrl` default `expiresIn = 900` | ✅ DONE | `services/s3Service.ts:194`; verified by `s3Service.spec.ts` test #17 (`X-Amz-Expires=900`) and live curl returning `X-Amz-Expires=900` |
| Local default-chain byte-identical (no guard, no clamp) | ✅ DONE | `s3Service.spec.ts` tests #1-#2, #6-#7, #16 plus live curl shows unchanged behavior (no 503); helpers early-return / passthrough on no-`expiration` creds |
| Route maps `CREDS_EXPIRED` → 503 with Spanish message | ✅ DONE | `routes/uploads.routes.ts` `isCredsExpired` + 503 branch; verified by 4 happy-path + 1 negative tests in `uploads-credentials-expired.spec.ts` |
| P0 provider semantics (`awsCredentials.ts`) UNTOUCHED | ✅ DONE | `awsCredentials.ts` not in diff; all 14 existing `tests/s3/awsCredentials.spec.ts` tests still pass |
| No regressions in `tests/s3/` + `tests/uploads/` | ✅ DONE | 51/51 tests pass (`14 awsCredentials + 22 s3Service + 6 uploads-creds-expired + 9 uploads`) |
| Typecheck clean | ✅ DONE | `tsc --noEmit -p backend/tsconfig.json` exit=0 |
| No git commit | ✅ DONE | No `git commit` invoked; uncommitted working tree is the expected deliverable shape |

---

## Source diff summary

### `backend/src/services/s3Service.ts` (rewritten)

- Added `CredentialsExpiredError` class (typed; carries
  `code='CREDS_EXPIRED'` and `status=503`).
- Added `throwCredentialsExpired()` convenience thrower.
- Added pure helpers:
  - `assertCredentialsUsable(creds, now): void` — throws if creds
    carry `expiration` and it's ≤ `now + EXPIRY_MARGIN_SEC*1000`.
  - `clampExpiresToCredLifetime(requested, creds, now): number` —
    clamps to `min(requested, (expiration - now)/1000 - margin)`;
    throws if clamp result ≤ 0.
- Added `EXPIRY_MARGIN_SEC = 60` (matches SDK's invalidation
  cadence).
- Added `__setProviderForTest(provider)` test seam + a mutable
  module-level `_s3Client` that the seam rebuilds when the
  provider changes.
- `generateUploadUrl(key, contentType, expiresIn = 300)` — now
  resolves creds → asserts → clamps → `getSignedUrl`.
- `generateDownloadUrl(key, expiresIn = 900)` — same chain; **NEW
  default 900s** (was 3600).

### `backend/src/routes/uploads.routes.ts` (refactored + extended)

- Converted module singleton `router` → factory `createUploadRoutes(authMw)`.
  Production default still `authMiddleware()`; routes/index.ts path
  unchanged.
- Exported `isCredsExpired(error)` predicate (enables unit tests
  without DB).
- Both routes (POST `/presigned-url`, GET `/download-url`) now
  catch `CredentialsExpiredError` and return
  `503 { success:false, code:'CREDS_EXPIRED', message:'Servicio de
  archivos temporalmente no disponible' }`.
- Non-cred errors retain the legacy 500 behavior.

### `backend/src/config/awsCredentials.ts` — UNTOUCHED

### `backend/tests/s3/_env-setup.ts` (NEW)

- Tiny side-effect-only helper that loads `backend/.env` via
  dotenv-before any test imports `services/s3Service.ts` (which
  reads `config.aws.s3Bucket` at module init). Must remain the
  first import in any spec that exercises `generateUploadUrl` /
  `generateDownloadUrl` end-to-end.

### `backend/tests/s3/s3Service.spec.ts` (NEW — 22 tests)

- Pure helper unit tests (assertions across passthrough / clamped /
  thrown / margin-edge cases).
- `generateUploadUrl` and `generateDownloadUrl` e2e through the
  `__setProviderForTest` seam — exercises the real
  `getSignedUrl` SDK path with deterministic creds.

### `backend/tests/uploads/uploads-credentials-expired.spec.ts` (NEW — 6 tests)

- supertest harness on a small Express app, with auth stubbed via
  `createUploadRoutes(passThroughAuth)`.
- Confirms 503 status, `code:'CREDS_EXPIRED'`, Spanish message,
  no `data` field.
- Includes a control test that an arbitrary `Error` falls through
  to the legacy 500 path.

---

## Local verification

- Backend started on :3101 with the new code; auth via
  `admin@miempresa.com`.
- POST `/uploads/presigned-url` → 200, URL contains
  `X-Amz-Expires=300` (upload default, unchanged).
- GET `/uploads/download-url` → 200, URL contains
  `X-Amz-Expires=900` (I3 verified live).
- Default-chain path did NOT throw (helpers skipped) — local byte-
  identical to pre-W12 behavior.
- Backend cleanly stopped after verification.

---

## Counts

- Tests added: **28** (22 in `tests/s3/s3Service.spec.ts` + 6 in
  `tests/uploads/uploads-credentials-expired.spec.ts`).
- Tests passing after change: **51** (14 awsCredentials + 22
  s3Service + 6 uploads-creds-expired + 9 uploads).
- Type errors introduced: **0**.
- Files modified: 4 (`s3Service.ts`, `uploads.routes.ts`, plus 2
  new specs).
- Files added: 2 (`s3Service.spec.ts`,
  `uploads-credentials-expired.spec.ts` + `_env-setup.ts` helper).

---

## Deploy notes for W13 (backend-only)

1. Build / restart only the backend service on staging — no
   frontend rebuild, no DB migration.
2. Smoke (post-deploy):
   - `POST /api/v1/uploads/presigned-url` → 200 with
     `X-Amz-Expires=300`.
   - `GET  /api/v1/uploads/download-url?key=...` → 200 with
     `X-Amz-Expires=900` (this is the visible change from jul-5).
3. **Optional — clamp verification**: near a cred rotation
   boundary, hit the download endpoint. Expect `X-Amz-Expires`
   strictly less than 900 if the session has < ~16 min remaining.
4. **Optional — fail-fast verification**: pause
   `refresh-credentials.sh` cron on staging, wait one full STS
   cycle (~55 min past last rotation), then hit the download
   endpoint. Expect `503 { success:false, code:'CREDS_EXPIRED',
   message:'Servicio de archivos temporalmente no disponible' }`
   instead of a doomed 200 URL — that's the I1 deliverable working
   end-to-end.
5. Rollback: `git revert` the four-file diff; no schema or env
   changes to undo. PM2 restart brings the prior behavior back.

---

## What I did NOT do (per scope)

- I4 (`ResponseContentDisposition`) — explicitly OUT of scope per
  the task assignment; remains a follow-on.
- I5/I6 — analyzed as already-OK in
  `presign-security-analysis.md`; no change.
- No git commit (per scope).
- No frontend changes (per scope).
