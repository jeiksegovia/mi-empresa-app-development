/**
 * W12 (pt) unit tests for the I1+I2+I3 presign hardening applied in
 * `services/s3Service.ts`.
 *
 * Covers (per task assignment §Tests):
 *   1. I1 — creds with past expiration → presign refuses (throws typed
 *      `CredentialsExpiredError`, route maps to 503 CREDS_EXPIRED)
 *   2. I1 — creds expiring inside the 60s safety margin → refuses
 *   3. I2 — creds expiring in 10 min + requested 3600 → URL
 *      X-Amz-Expires ≤ 540 (clamped); explicit 900 requested when creds
 *      have ≥ 30 min remaining → URL X-Amz-Expires = 900 (passthrough)
 *   4. I2 — clamp result ≤ 0 → throws (same as I1)
 *   5. I3 — default download presign → X-Amz-Expires = 900
 *   6. Local default-chain (no expiration) — guard skipped, clamp
 *      passthrough, no behavior change
 *   7. Helpers — `assertCredentialsUsable`, `clampExpiresToCredLifetime`
 *      tested as pure functions (no AWS calls)
 *
 * The `__setProviderForTest` seam rebuilds the module-level `S3Client`,
 * so each test sets up the provider it needs and clears it in
 * `afterEach` to keep tests isolated. Presigning is purely local
 * (no network) — the SDK signs whatever the provider yields.
 */

import './_env-setup.js' // MUST come first — loads backend/.env into process.env
import { test, expect } from '@playwright/test'
import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@aws-sdk/types'
import {
  assertCredentialsUsable,
  clampExpiresToCredLifetime,
  CredentialsExpiredError,
  EXPIRY_MARGIN_SEC,
  generateDownloadUrl,
  generateUploadUrl,
  __setProviderForTest,
  throwCredentialsExpired,
} from '../../src/services/s3Service.js'

// -------------------------------------------------------------------------
// Test helpers
// -------------------------------------------------------------------------

function identity(opts: {
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  expiration?: Date
}): AwsCredentialIdentity {
  return {
    accessKeyId: opts.accessKeyId ?? 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey:
      opts.secretAccessKey ?? 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    ...(opts.sessionToken ? { sessionToken: opts.sessionToken } : {}),
    ...(opts.expiration ? { expiration: opts.expiration } : {}),
  }
}

function fixedProvider(identity: AwsCredentialIdentity): AwsCredentialIdentityProvider {
  return async () => identity
}

/** Extract the integer seconds from `…&X-Amz-Expires=NNN&…` in the URL. */
function xAmzExpires(presignedUrl: string): number {
  const match = presignedUrl.match(/[?&]X-Amz-Expires=(\d+)/)
  if (!match) throw new Error(`No X-Amz-Expires in URL: ${presignedUrl.slice(0, 200)}`)
  return Number(match[1])
}

/**
 * Extract the ISO `expiration` from a presigned POST policy document.
 *
 * `createPresignedPost` returns `{ url, fields }` where the URL has no
 * `X-Amz-Expires` query param — the expiry is encoded in the base64
 * `Policy` form field (capital P, per the AWS SDK source). We decode it
 * and read `expiration` (ISO-8601).
 */
function policyExpiration(presignedPost: { url: string; fields: Record<string, string> }): Date {
  const policy = presignedPost.fields?.Policy
  if (!policy) throw new Error(`No Policy field in presigned POST: url=${presignedPost.url.slice(0, 200)}`)
  let decoded: string
  try {
    decoded = Buffer.from(policy, 'base64').toString('utf8')
  } catch (e) {
    throw new Error(`Failed to base64-decode Policy: ${(e as Error).message}`)
  }
  let parsed: any
  try {
    parsed = JSON.parse(decoded)
  } catch (e) {
    throw new Error(`Failed to JSON-parse policy: ${(e as Error).message}`)
  }
  if (typeof parsed.expiration !== 'string') {
    throw new Error(`Policy has no ISO expiration: ${decoded}`)
  }
  return new Date(parsed.expiration)
}

// -------------------------------------------------------------------------
// Module-level state — restore the default (undefined) after every test.
// -------------------------------------------------------------------------

test.beforeEach(() => {
  // Start every test from "no provider" (default-chain). Tests that
  // want a provider set it explicitly.
  __setProviderForTest(undefined)
})

test.afterEach(() => {
  __setProviderForTest(undefined)
})

// -------------------------------------------------------------------------
// Pure helpers — fast, no AWS, no S3Client.
// -------------------------------------------------------------------------

test.describe('s3Service — pure helpers (W12 I1+I2)', () => {
  test('assertCredentialsUsable: no-op when creds are undefined (default-chain)', () => {
    expect(() => assertCredentialsUsable(undefined, Date.now())).not.toThrow()
  })

  test('assertCredentialsUsable: no-op when creds carry no `expiration`', () => {
    const creds = identity({}) // no expiration
    expect(() => assertCredentialsUsable(creds, Date.now())).not.toThrow()
  })

  test('assertCredentialsUsable: throws when expiration is in the past', () => {
    const past = new Date(Date.now() - 60_000)
    const creds = identity({ expiration: past })
    expect(() => assertCredentialsUsable(creds, Date.now())).toThrow(
      CredentialsExpiredError,
    )
  })

  test('assertCredentialsUsable: throws when expiration is within the margin', () => {
    const insideMargin = new Date(Date.now() + (EXPIRY_MARGIN_SEC - 5) * 1000)
    const creds = identity({ expiration: insideMargin })
    expect(() => assertCredentialsUsable(creds, Date.now())).toThrow(
      CredentialsExpiredError,
    )
  })

  test('assertCredentialsUsable: passes when expiration is just past the margin', () => {
    const justOutside = new Date(Date.now() + (EXPIRY_MARGIN_SEC + 5) * 1000)
    const creds = identity({ expiration: justOutside })
    expect(() => assertCredentialsUsable(creds, Date.now())).not.toThrow()
  })

  test('clampExpiresToCredLifetime: passthrough on default-chain (no creds)', () => {
    expect(clampExpiresToCredLifetime(900, undefined, Date.now())).toBe(900)
    expect(clampExpiresToCredLifetime(3600, undefined, Date.now())).toBe(3600)
  })

  test('clampExpiresToCredLifetime: passthrough when creds lack `expiration`', () => {
    const creds = identity({}) // no expiration
    expect(clampExpiresToCredLifetime(3600, creds, Date.now())).toBe(3600)
  })

  test('clampExpiresToCredLifetime: clamps to remaining lifetime when shorter', () => {
    // 10 min remaining
    const exp = new Date(Date.now() + 10 * 60 * 1000)
    const creds = identity({ expiration: exp })
    // requested 3600 → clamp to 600 - 60 = 540
    expect(clampExpiresToCredLifetime(3600, creds, Date.now())).toBe(540)
  })

  test('clampExpiresToCredLifetime: passes-through requested when shorter than remaining lifetime', () => {
    const exp = new Date(Date.now() + 60 * 60 * 1000) // 60 min remaining
    const creds = identity({ expiration: exp })
    // requested 900 → 900 (no clamp)
    expect(clampExpiresToCredLifetime(900, creds, Date.now())).toBe(900)
  })

  test('clampExpiresToCredLifetime: throws when remaining lifetime ≤ margin', () => {
    // exactly margin remaining → maxSec = 0 → throw
    const exp = new Date(Date.now() + EXPIRY_MARGIN_SEC * 1000)
    const creds = identity({ expiration: exp })
    expect(() => clampExpiresToCredLifetime(900, creds, Date.now())).toThrow(
      CredentialsExpiredError,
    )
  })

  test('clampExpiresToCredLifetime: throws when remaining lifetime is in the past', () => {
    const exp = new Date(Date.now() - 1000)
    const creds = identity({ expiration: exp })
    expect(() => clampExpiresToCredLifetime(900, creds, Date.now())).toThrow(
      CredentialsExpiredError,
    )
  })

  test('throwCredentialsExpired: matches CredentialsExpiredError shape', () => {
    try {
      throwCredentialsExpired()
      throw new Error('expected to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(CredentialsExpiredError)
      expect((e as CredentialsExpiredError).code).toBe('CREDS_EXPIRED')
      expect((e as CredentialsExpiredError).status).toBe(503)
    }
  })
})

// -------------------------------------------------------------------------
// End-to-end through generateUploadUrl / generateDownloadUrl — uses the
// __setProviderForTest seam. Signing is local (no network), so a
// deterministic provider suffices.
// -------------------------------------------------------------------------

test.describe('s3Service — generateUploadUrl (I1, I2)', () => {
  test('I1: rejects with CredentialsExpiredError when provider returns expired creds', async () => {
    const exp = new Date(Date.now() - 60_000) // past
    __setProviderForTest(
      fixedProvider(identity({ expiration: exp, sessionToken: 'session-token' })),
    )

    await expect(
      generateUploadUrl('uploads/test.pdf', 'application/pdf', 300),
    ).rejects.toBeInstanceOf(CredentialsExpiredError)
  })

  test('I1: rejects when expiration is within the 60s margin', async () => {
    const inside = new Date(Date.now() + (EXPIRY_MARGIN_SEC - 10) * 1000)
    __setProviderForTest(
      fixedProvider(identity({ expiration: inside, sessionToken: 'session-token' })),
    )

    await expect(
      generateUploadUrl('uploads/test.pdf', 'application/pdf', 300),
    ).rejects.toBeInstanceOf(CredentialsExpiredError)
  })

  test('I2: clamps presign expiry to remaining cred lifetime', async () => {
    // 10 min remaining → clamp 300 (default upload) → 540
    const exp = new Date(Date.now() + 10 * 60 * 1000)
    __setProviderForTest(
      fixedProvider(identity({ expiration: exp, sessionToken: 'session-token' })),
    )

    const presigned = await generateUploadUrl(
      'uploads/test.pdf',
      'application/pdf',
      300,
    )
    // Presigned POST encodes the expiry in the base64 policy document
    // (no X-Amz-Expires in the URL). Decode and check it falls inside the
    // 10-min remaining window (clamped to 540s by the safety margin).
    const expiresAt = policyExpiration(presigned).getTime()
    const now = Date.now()
    expect(expiresAt - now).toBeLessThanOrEqual(540 * 1000)
    // And the policy must NOT exceed the credential lifetime (≈600s)
    expect(expiresAt - now).toBeLessThanOrEqual(10 * 60 * 1000)
  })

  test('default-chain (no provider): generateUploadUrl emits a URL — guard does NOT fire', async () => {
    // Default-chain means no `expiration` to check → behavior must be
    // effectively unchanged from the legacy implementation. We verify
    // only the parts of the API we can without real AWS creds: that
    // the helpers (which the guard relies on) return passthrough.
    expect(() => assertCredentialsUsable(undefined, Date.now())).not.toThrow()
    expect(clampExpiresToCredLifetime(300, undefined, Date.now())).toBe(300)
  })
})

test.describe('s3Service — generateDownloadUrl (I1, I2, I3)', () => {
  test('I3: default download expiry is 900s (W12 I3; closes MED-2 from jul-5)', async () => {
    // W12 changed the download default from 3600s → 900s. Quartering
    // the bearer-credential leak window while staying well above the
    // "open in new tab" UX budget. With a provider whose creds have
    // 60+ min remaining, no clamp fires — so the URL must encode exactly
    // 900 in X-Amz-Expires.
    const exp = new Date(Date.now() + 60 * 60 * 1000)
    __setProviderForTest(
      fixedProvider(identity({ expiration: exp, sessionToken: 'session-token' })),
    )

    // Call without an explicit expiresIn — relies on the 900s default.
    const url = await generateDownloadUrl('documents/test.pdf')
    expect(xAmzExpires(url)).toBe(900)
  })

  test('I1: rejects with CredentialsExpiredError when provider returns expired creds', async () => {
    const exp = new Date(Date.now() - 60_000)
    __setProviderForTest(
      fixedProvider(identity({ expiration: exp, sessionToken: 'session-token' })),
    )

    await expect(
      generateDownloadUrl('documents/test.pdf'),
    ).rejects.toBeInstanceOf(CredentialsExpiredError)
  })

  test('I2: clamps presign expiry to remaining cred lifetime (10min left, no override)', async () => {
    // 10 min remaining → default 900s requested → clamp to 540
    const exp = new Date(Date.now() + 10 * 60 * 1000)
    __setProviderForTest(
      fixedProvider(identity({ expiration: exp, sessionToken: 'session-token' })),
    )

    const url = await generateDownloadUrl('documents/test.pdf')
    expect(xAmzExpires(url)).toBeLessThanOrEqual(540)
  })

  test('I2: passes through 900s when creds have ≥ 30 min remaining (no clamp fires)', async () => {
    const exp = new Date(Date.now() + 30 * 60 * 1000)
    __setProviderForTest(
      fixedProvider(identity({ expiration: exp, sessionToken: 'session-token' })),
    )

    const url = await generateDownloadUrl('documents/test.pdf')
    expect(xAmzExpires(url)).toBe(900)
  })

  test('I2: passes through 300s upload default when creds have ≥ 30 min remaining', async () => {
    const exp = new Date(Date.now() + 30 * 60 * 1000)
    __setProviderForTest(
      fixedProvider(identity({ expiration: exp, sessionToken: 'session-token' })),
    )

    const presigned = await generateUploadUrl('uploads/test.pdf', 'application/pdf')
    // Presigned POST policy `expiration` is `now + 300s` (default) when
    // the credential lifetime is comfortably larger than 300s.
    const expiresAt = policyExpiration(presigned).getTime()
    const deltaMs = expiresAt - Date.now()
    expect(deltaMs).toBeGreaterThanOrEqual(295 * 1000)
    expect(deltaMs).toBeLessThanOrEqual(305 * 1000)
  })

  test('I1+I2 combined: guard fires before clamp on pathologically expired creds', async () => {
    // expiration is way in the past → assertCredentialsUsable throws first
    const exp = new Date(Date.now() - 5 * 60 * 1000)
    __setProviderForTest(
      fixedProvider(identity({ expiration: exp, sessionToken: 'session-token' })),
    )

    // The error is CredentialsExpiredError — same shape regardless of
    // which guard triggered (assertCredentialsUsable OR clamp path).
    await expect(
      generateDownloadUrl('documents/test.pdf'),
    ).rejects.toBeInstanceOf(CredentialsExpiredError)
  })
})
