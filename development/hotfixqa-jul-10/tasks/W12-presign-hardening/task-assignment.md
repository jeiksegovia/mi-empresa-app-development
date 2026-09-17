# task-assignment — I1-I3 presign hardening (W12, pt-backend-eng)

## Task Type
IMPLEMENTATION

## Task ID
`20`. `TaskUpdate(taskId: "20", status: "in_progress")` on start.

## Spec (source of truth)
`development/hotfixqa-jul-10/orchestration-ctx/decisions/presign-security-analysis.md` §Improvement evaluation — items I1, I2, I3 ONLY (I4-I6 out of scope).

## Context to read
1. `backend/src/services/s3Service.ts` (50 lines — the target)
2. `backend/src/config/awsCredentials.ts` (the P0 provider — exposes creds with `expiration` when rotated; returns undefined for local default-chain)
3. `backend/tests/s3/awsCredentials.spec.ts` (test patterns to extend)
4. `backend/src/routes/uploads.routes.ts` (how s3Service errors surface — follow existing error-shape patterns)

## Scope

### I1 — Fail-fast credential-expiry check before signing
In `s3Service.ts` (or a small helper in `awsCredentials.ts` — your call, document):
- Before `getSignedUrl`, resolve the effective credentials. If they carry an `expiration` and `expiration <= now + 60s`, THROW a typed error (e.g. `Object.assign(new Error('AWS credentials expired — presign refused'), { status: 503, code: 'CREDS_EXPIRED' })`).
- Route layer: uploads routes catch it → `503 { success:false, message:'Servicio de archivos temporalmente no disponible', code:'CREDS_EXPIRED' }` (Spanish user-facing message per convention). Follow the existing structured-error pattern.
- **Local default-chain case** (resolveS3Credentials → undefined): no expiration knowable → skip the check (unchanged behavior). Only rotated-cred environments get the guard.

### I2 — Clamp expiry to remaining cred lifetime
When creds carry `expiration`: `effectiveExpiresIn = min(requestedExpiresIn, floor((expiration - now)/1000) - 60)`. If the clamp result is <= 0, that's the I1 path (503). Apply to BOTH upload and download presigns.

### I3 — Download default 3600 → 900
`generateDownloadUrl(key, expiresIn = 900)`. Check call sites for explicit 3600 overrides (grep) — none expected; update if found. Note in result.md that MED-2 (jul-5) is hereby CLOSED.

## Tests (`backend/tests/s3/` — extend existing patterns; pure unit where possible)
1. I1: creds with past expiration → generateDownloadUrl/generateUploadUrl rejects with code CREDS_EXPIRED (mock/inject the provider — refactor s3Service minimally for injectability if needed, e.g. accept an optional provider in a factory; keep the public API unchanged)
2. I2: creds expiring in 10 min + requested 3600 → URL X-Amz-Expires <= 540
3. I3: default download presign → X-Amz-Expires=900
4. Local default-chain (no expiration): behavior unchanged, no clamp, no fail-fast
5. Route-level: forced CREDS_EXPIRED → 503 with code (supertest/curl pattern per existing route tests)
Also re-run `tests/s3/awsCredentials.spec.ts` + `tests/uploads/` — no regressions.

## Constraints
- Do NOT change the P0 provider semantics (awsCredentials.ts logic stays; you may EXPORT additional helpers)
- Local backend :3101 live (tsx watch) — verify local presign still works after (curl upload+download round-trip, X-Amz-Expires=900 visible)
- No frontend changes; no git commit; typecheck clean

## Deliverables
1. Source changes + tests green (verbatim run output in result.md)
2. `tasks/W12-presign-hardening/{result.md,progress-report.md,completion-report.md}` — completion report includes deploy notes for W13 (backend-only; what to verify live: fresh presign 200, X-Amz-Expires=900, and if practical a clamped-expiry observation near a rotation boundary)

## Reporting
Standard. On done: `SendMessage(to: "main", "COMPLETE: I1-I3 done. {test counts}. See tasks/W12-presign-hardening/result.md", summary: "W12 complete")`. Stay PARKED.
