# Presigned-URL security analysis (user question, 2026-07-11)

**Question**: if creds are invalid, shouldn't the presign generation fail at the AWS API call? Instead an outdated URL was returned "like a static presign" — are STS creds exposed in the URL and exploitable?

## Finding 1 — There is no AWS API call in presigning (the premise is false, by AWS design)

`getSignedUrl()` (`s3Service.ts:40,48`) is a **purely local cryptographic computation**: the SDK derives a SigV4 HMAC signature from the credentials it holds in memory. No network request to AWS happens, so invalid/expired credentials CANNOT fail at generation time — AWS only validates the signature when the URL is *used* against S3. This is standard AWS behavior in every SDK, not a bad practice in our code.

## Finding 2 — Why an "outdated" URL was returned (not a static presign)

During the incident the SDK held **cached expired STS creds** (the memoizeChain bug). Every request minted a **fresh** signature (X-Amz-Date changes per request — verified) but cryptographically bound to the expired session token. So: not static, not cached URLs — freshly signed from stale material. Root cause fixed by P0 (`awsCredentials.ts`) + stopgap-B.

## Finding 3 — Credential exposure: SAFE (verified by live dissection)

Dissected a live download URL (local, 2026-07-11):
```
X-Amz-Credential: AKIA_REDACTED/20260711/us-east-1/s3/aws4_request   ← access key ID + scope
X-Amz-Signature:  787b6300…  (64 hex)                                       ← HMAC-SHA256 derivative
X-Amz-Expires: 3600 · X-Amz-Date · X-Amz-SignedHeaders: host
```
- **The secret access key is NEVER in the URL** — `X-Amz-Signature` is a one-way HMAC derivation; the secret is not recoverable from it.
- `X-Amz-Credential` contains only the access key **ID** — a public identifier by AWS design, not a secret.
- On staging (temp creds) URLs additionally carry `X-Amz-Security-Token` — the STS **session token**, which AWS explicitly designs as the public third component of temporary credentials. **The token alone is not exploitable**: signing any new AWS request requires the matching secret key, which never leaves the server. Possessing token + key ID grants nothing.
- The only capability a presigned URL confers: **one operation (GET or PUT) on one object key until expiry** — a bearer capability. Leak impact = access to that single object within the window.
- Bounding fact: for temp creds, effective validity = **min(X-Amz-Expires, STS session expiry)** — staging download URLs die when the ≤1h session ends regardless of the 3600s stamp (this is jul-5's MED-2, now understood precisely).

**Verdict: no credential exploitation is possible from these URLs. Current mechanism is safe per AWS's threat model.**

## Improvement evaluation (download + upload presigns)

| # | Improvement | Value | Effort |
|---|---|---|---|
| I1 | **Fail-fast cred check** in `s3Service`: resolve provider creds before signing; if `expiration` is past (or within a 60s margin), throw a typed 503 error instead of returning a doomed URL. Converts any future cred failure from silent corruption into a visible, monitorable error | HIGH (defense-in-depth; the incident's UX would have been "clear error" not "mystery token expirado") | S |
| I2 | **Clamp expiry to cred lifetime**: `expiresIn = min(requested, credExpiration − now − 60s)` — URL never promises more than the session can deliver (closes MED-2 properly) | MED | S |
| I3 | **Download expiry 3600 → 900s default** (original MED-2 rec; ample for open-in-tab, quarters the leak window) | MED | S |
| I4 | **`ResponseContentDisposition`** on download presigns (`attachment; filename="<original>"`) — closes MED-3 (uuid.pdf filenames); callers pass stored `nombre` where available | MED (UX) | M (touch call sites) |
| I5 | Upload presign: already good — 300s, ContentType is signed (prevents type-swap). Server-side size enforcement would require S3 POST policies (PUT presigns can't sign Content-Length) — defer unless abuse appears | LOW | — |
| I6 | Ops hygiene: never log full presigned URLs (verified: morgan logs paths only ✓); HTTPS-only (✓ bucket URLs) | — (already OK) | — |

**Recommended package**: I1+I2+I3 as one small backend change (+unit tests in `tests/s3/`), I4 as a follow-on touching download call sites.
