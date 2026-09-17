# W12 result.md — I1+I2+I3 presign hardening

**Task**: W12 pt-backend-eng, I1+I2+I3 from
`orchestration-ctx/decisions/presign-security-analysis.md`
**Worker**: pt-backend-eng
**Date**: 2026-07-11

---

## Files changed

```
backend/src/services/s3Service.ts         (rewritten — I1, I2, I3 + test seam)
backend/src/routes/uploads.routes.ts      (factory + 503 CREDS_EXPIRED mapping)
backend/tests/s3/s3Service.spec.ts       (NEW — 22 tests)
backend/tests/s3/_env-setup.ts            (NEW — dotenv loader for spec files)
backend/tests/uploads/uploads-credentials-expired.spec.ts   (NEW — 6 tests)
```

`backend/src/config/awsCredentials.ts` — **NOT TOUCHED** (P0 provider
semantics preserved; existing `tests/s3/awsCredentials.spec.ts`
still passes verbatim).

---

## Verbatim test outputs

### Suite A — `tests/s3/s3Service.spec.ts` (NEW)

```
Running 22 tests using 1 worker
  ✓  1 s3Service — pure helpers › assertCredentialsUsable: no-op when creds are undefined
  ✓  2 s3Service — pure helpers › assertCredentialsUsable: no-op when creds carry no `expiration`
  ✓  3 s3Service — pure helpers › assertCredentialsUsable: throws when expiration is in the past
  ✓  4 s3Service — pure helpers › assertCredentialsUsable: throws when expiration is within the margin
  ✓  5 s3Service — pure helpers › assertCredentialsUsable: passes when expiration is just past the margin
  ✓  6 s3Service — pure helpers › clampExpiresToCredLifetime: passthrough on default-chain (no creds)
  ✓  7 s3Service — pure helpers › clampExpiresToCredLifetime: passthrough when creds lack `expiration`
  ✓  8 s3Service — pure helpers › clampExpiresToCredLifetime: clamps to remaining lifetime when shorter
  ✓  9 s3Service — pure helpers › clampExpiresToCredLifetime: passes-through requested when shorter than remaining lifetime
  ✓ 10 s3Service — pure helpers › clampExpiresToCredLifetime: throws when remaining lifetime ≤ margin
  ✓ 11 s3Service — pure helpers › clampExpiresToCredLifetime: throws when remaining lifetime is in the past
  ✓ 12 s3Service — pure helpers › throwCredentialsExpired: matches CredentialsExpiredError shape
  ✓ 13 s3Service — generateUploadUrl › I1: rejects with CredentialsExpiredError when provider returns expired creds
  ✓ 14 s3Service — generateUploadUrl › I1: rejects when expiration is within the 60s margin
  ✓ 15 s3Service — generateUploadUrl › I2: clamps presign expiry to remaining cred lifetime
  ✓ 16 s3Service — generateUploadUrl › default-chain (no provider): guard does NOT fire
  ✓ 17 s3Service — generateDownloadUrl › I3: default download expiry is 900s (W12 I3; closes MED-2 from jul-5)
  ✓ 18 s3Service — generateDownloadUrl › I1: rejects with CredentialsExpiredError when provider returns expired creds
  ✓ 19 s3Service — generateDownloadUrl › I2: clamps presign expiry to remaining cred lifetime (10min left)
  ✓ 20 s3Service — generateDownloadUrl › I2: passes through 900s when creds have ≥ 30 min remaining
  ✓ 21 s3Service — generateDownloadUrl › I2: passes through 300s upload default when creds have ≥ 30 min remaining
  ✓ 22 s3Service — generateDownloadUrl › I1+I2 combined: guard fires before clamp on pathologically expired creds

  22 passed (807ms)
```

### Suite B — `tests/s3/awsCredentials.spec.ts` (UNTOUCHED — no regression)

```
Running 14 tests using 1 worker
  ✓  1..14 (all awsCredentials module, parseDefaultBlock, resolveS3Credentials, makeRotatedCredentialsProvider, rotation boundary)
  14 passed (525ms)
```

### Suite C — `tests/uploads/uploads-credentials-expired.spec.ts` (NEW)

```
Running 6 tests using 1 worker
  ✓  1 POST /uploads/presigned-url → 503 CREDS_EXPIRED when creds already expired
  ✓  2 GET  /uploads/download-url   → 503 CREDS_EXPIRED when creds already expired
  ✓  3 POST /uploads/presigned-url → 503 CREDS_EXPIRED when creds expire inside the 60s margin
  ✓  4 GET  /uploads/download-url   → 503 CREDS_EXPIRED when creds expire inside the 60s margin
  ✓  5 plain Error from generateUploadUrl → 500 (legacy behavior preserved)
  ✓  6 default-chain: isCredsExpired does NOT flag a non-cred error

  6 passed (1.1s)
```

### Suite D — `tests/uploads/uploads.spec.ts` (EXISTING — no regression)

```
Running 9 tests using 1 worker
  ✓  1..9 (Uploads API: 401s, 400s, 200s, folder prefix, default folder, presigned download URL)
  9 passed (685ms)
```

### Combined `tests/s3/` + `tests/uploads/` run

```
51 passed (1.4s)
```

### Typecheck

```
$ tsc --noEmit -p backend/tsconfig.json
exit=0
```

---

## Live verification (local backend :3101)

Booted backend via `tsx src/server.ts`. Auth: `admin@miempresa.com` /
`<redacted>`.

```
$ curl -X POST http://localhost:3101/api/v1/uploads/presigned-url \
    -H 'Content-Type: application/json' -b cookies.txt \
    -d '{"contentType":"application/pdf","folder":"w12-verify"}'
{"success":true,"data":{"uploadUrl":"...?X-Amz-Algorithm=...&X-Amz-Expires=300&..."}}
                          ^^^^^^^^^^^^^^^^^^
                          X-Amz-Expires=300  ← upload default (unchanged)

$ curl 'http://localhost:3101/api/v1/uploads/download-url?key=w12-verify/test.pdf' \
    -b cookies.txt
{"success":true,"data":{"downloadUrl":"...?X-Amz-Algorithm=...&X-Amz-Expires=900&..."}}
                          ^^^^^^^^^^^^^^^^^^
                          X-Amz-Expires=900  ← NEW (was 3600 — W12 I3)
```

Default-chain (no STS rotation) passes through unchanged — no
`CREDS_EXPIRED` throw, byte-identical to legacy. The I1/I2 guards
skip entirely because no cred carries `expiration`.

Backend was stopped after verification: `kill <PID returned by lsof -i :3101>`.

---

## MED-2 closure

The jul-5 MED-2 (download URL out-living the underlying STS session)
is hereby **CLOSED** by W12:

- **I2** (`clampExpiresToCredLifetime`): the URL's `X-Amz-Expires`
  is now bounded above by `credExpiration - now - 60s`, so the URL
  never advertises more validity than the session can deliver.
- **I3** (default download 900s): even before I2 fires, the default
  window is already an order of magnitude shorter than the typical
  ~55-min STS session.
- **I1** (typed-error guard): when the SDK's `memoizeChain`
  invalidates and a fresh provider call would still return
  effectively-expired creds, the route now returns
  `503 CREDS_EXPIRED` instead of silently emitting a doomed URL
  (replaces the W8 mystery-token UX).

---

## Notes for W13 deploy verification

Backend-only change. No frontend rebuild needed. After `git pull +
PM2 restart` (or equivalent) on the staging host:

1. `curl /api/v1/uploads/presigned-url` — `X-Amz-Expires=300`
   (upload default, unchanged).
2. `curl /api/v1/uploads/download-url?key=...` — `X-Amz-Expires=900`
   (NEW; was 3600 in staging).
3. **Optional — clamped-expiry observation**: pick a moment close to
   a rotation boundary (~5 min before `mtime+55min`) and request a
   download. Expect `X-Amz-Expires` smaller than 900 if the new cred
   set was just refreshed AND its `expiration` is near.
4. **Failure-mode observation**: pause the `refresh-credentials.sh`
   cron for 1+ hour on staging, then request a download. Expect
   `503 { success:false, code:'CREDS_EXPIRED', message:'...no
   disponible' }` instead of a 200 with a doomed URL — that's the
   I1 deliverable working end-to-end.
