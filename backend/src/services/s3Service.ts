import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@aws-sdk/types'
import { config } from '../config/env.js'
import { resolveS3Credentials } from '../config/awsCredentials.js'

// W11 (P0): use an env-aware credential resolution.
//   • Local dev (AWS_PROFILE set, OR no session token in env/credentials-file)
//     → `resolveS3Credentials()` returns undefined; we omit `credentials` so
//     the SDK uses its default provider chain (long-lived disruptive profile
//     keys, static env vars, IMDS, etc.).
//   • Rotated staging/prod (AWS_CREDS_ROTATED=1, OR env has session token,
//     OR credentials-file has session token) → custom async provider that
//     re-reads `~/.aws/credentials` on every refresh cycle and synthesizes
//     an `expiration` from the file mtime. The SDK's `memoizeChain` then
//     self-invalidates ~5 min before expiry, so we never sign a URL with
//     stale STS creds again (recurring ~1h breakage that W8 documented).

/**
 * Module-level provider state.
 *
 * `_provider` is the value resolved once at startup from the env-aware
 * `resolveS3Credentials()` helper. In local dev it is `undefined` (SDK
 * uses its default provider chain — there is no expiration knowable).
 * In rotated environments it is an async provider that returns an
 * `AwsCredentialIdentity` carrying an `expiration` derived from the
 * credentials-file mtime.
 *
 * `__setProviderForTest` exists only as a test seam (prefixed `__` to
 * make intent obvious). Production code does NOT use it.
 */
let _provider: AwsCredentialIdentityProvider | undefined = resolveS3Credentials()

/** @internal — test seam. Pass `undefined` to restore default-chain behavior. */
export function __setProviderForTest(
  provider: AwsCredentialIdentityProvider | undefined,
): void {
  _provider = provider
  _s3Client = buildS3Client(provider)
}

function buildS3Client(
  provider: AwsCredentialIdentityProvider | undefined,
): S3Client {
  return new S3Client({
    region: config.aws.region,
    ...(provider ? { credentials: provider } : {}),
  })
}

let _s3Client: S3Client = buildS3Client(_provider)

/**
 * Safety margin applied when checking credential freshness: any cred whose
 * `expiration` is ≤ `now + MARGIN_SEC` is treated as effectively-expired.
 * This matches the AWS SDK's own `memoizeChain` invalidation window (it
 * expires 5 min before `expiration`) so we refuse to sign at roughly the
 * same boundary the SDK would.
 */
export const EXPIRY_MARGIN_SEC = 60

/**
 * Typed error thrown when presigning is refused because the active
 * credentials are missing, expiring, or already expired. Routes map it
 * to a 503 with a Spanish user-facing message and a stable `CREDS_EXPIRED`
 * code for monitoring/alerting.
 *
 * The throw-site error message is English / ops-facing; the user-facing
 * translation lives in the route layer (single source of truth for
 * localized copy).
 */
export class CredentialsExpiredError extends Error {
  readonly code = 'CREDS_EXPIRED'
  readonly status = 503
  constructor(
    message = 'AWS credentials expired — presign refused',
  ) {
    super(message)
    this.name = 'CredentialsExpiredError'
  }
}

/**
 * Convenience throw-helper for callers / tests that want to throw the
 * same typed error without importing the class. Equivalent to
 * `throw new CredentialsExpiredError()` but reads better in guard
 * expressions.
 */
export function throwCredentialsExpired(): never {
  throw new CredentialsExpiredError()
}

/**
 * I1 (fail-fast): if the resolved credentials carry an `expiration` and
 * that expiration is at or before `now + EXPIRY_MARGIN_SEC`, throw
 * `CredentialsExpiredError` instead of letting `getSignedUrl` produce a
 * doomed URL.
 *
 * Local default-chain behavior: when `creds` is `undefined` (the SDK
 * default-chain resolved against long-lived static keys / IMDS / etc.
 * with no knowable expiration) we return silently — the guard applies
 * only to rotated-credential environments.
 *
 * Exported for unit testing.
 */
export function assertCredentialsUsable(
  creds: AwsCredentialIdentity | undefined,
  now: number,
): void {
  if (!creds?.expiration) return // default-chain / no-expiration case
  const msUntilExpiry = creds.expiration.getTime() - now
  if (msUntilExpiry <= EXPIRY_MARGIN_SEC * 1000) {
    throwCredentialsExpired()
  }
}

/**
 * I2 (clamp): when creds have an `expiration`, the presign's
 * `X-Amz-Expires` must never exceed the session's remaining lifetime
 * (minus the safety margin). Otherwise the SDK produces a URL that
 * advertises more validity than the underlying bearer credentials
 * actually carry — which closes MED-2 (jul-5) properly: the bearer
 * capability dies when the STS session dies, not at the URL's stamp.
 *
 * Returns the effective `expiresIn` to pass to `getSignedUrl`.
 *
 * If the clamp result would be ≤ 0, throws `CredentialsExpiredError`
 * (the same typed error as I1 — same observable outcome to the caller).
 *
 * Default-chain / no-expiration case: returns `requestedExpiresIn`
 * unchanged (byte-identical to legacy behavior).
 *
 * Exported for unit testing.
 */
export function clampExpiresToCredLifetime(
  requestedExpiresIn: number,
  creds: AwsCredentialIdentity | undefined,
  now: number,
): number {
  if (!creds?.expiration) return requestedExpiresIn
  const msUntilExpiry = creds.expiration.getTime() - now
  const maxSec = Math.floor(msUntilExpiry / 1000) - EXPIRY_MARGIN_SEC
  if (maxSec <= 0) throwCredentialsExpired()
  return Math.min(requestedExpiresIn, maxSec)
}

// Presigning is local computation — it succeeds even against a bucket that
// doesn't exist, and the browser PUT then fails with NoSuchBucket. Guarding
// here surfaces a misconfigured AWS_S3_BUCKET at request time with a clear error.
function requireBucket(): string {
  if (!config.aws.s3Bucket) {
    throw new Error('AWS_S3_BUCKET is not configured — set it in backend/.env (see .env.example)')
  }
  return config.aws.s3Bucket
}

async function resolveActiveCredentials(): Promise<
  AwsCredentialIdentity | undefined
> {
  if (!_provider) return undefined
  return _provider()
}

/**
 * I3 (default expiry): download presigns default to **900s (15 min)** —
 * ample for "open in new tab" UX while quartering the bearer leak window
 * compared with the legacy 3600s. Callers may still pass an explicit
 * `expiresIn`, but anything within `clampExpiresToCredLifetime` will be
 * further reduced to the cred-remaining lifetime (I2).
 */
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const now = Date.now()
  const creds = await resolveActiveCredentials()
  assertCredentialsUsable(creds, now)
  const effectiveExpiresIn = clampExpiresToCredLifetime(expiresIn, creds, now)

  const command = new PutObjectCommand({
    Bucket: requireBucket(),
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(_s3Client, command, { expiresIn: effectiveExpiresIn })
}

export async function generateDownloadUrl(
  key: string,
  expiresIn = 900,
): Promise<string> {
  const now = Date.now()
  const creds = await resolveActiveCredentials()
  assertCredentialsUsable(creds, now)
  const effectiveExpiresIn = clampExpiresToCredLifetime(expiresIn, creds, now)

  const command = new GetObjectCommand({
    Bucket: requireBucket(),
    Key: key,
  })
  return getSignedUrl(_s3Client, command, { expiresIn: effectiveExpiresIn })
}
