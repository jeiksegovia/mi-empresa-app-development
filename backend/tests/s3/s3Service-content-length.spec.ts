/**
 * S4 — `ContentLengthRange` in the presigned POST policy.
 *
 * The route-level presign test (upload-ownership-idor.spec.ts) verifies
 * the response carries the `url` + `fields` shape. This spec verifies the
 * actual content-length condition is encoded in the signed POST policy:
 *
 *   1. `generateUploadUrl` returns `{ url, fields }` (no string-only).
 *   2. The base64-decoded `Policy` form field contains a
 *      `["content-length-range", 0, N]` condition where N matches
 *      `config.upload.maxFileSizeBytes`.
 *   3. The Content-Type equality condition is also present so an attacker
 *      cannot swap the MIME after presigning.
 *   4. The default upload expiry (300s) shows up in the policy as
 *      `expiration` ≈ now+300s when credentials have plenty of lifetime.
 */

import './_env-setup.js' // MUST come first — loads backend/.env into process.env
import { test, expect } from '@playwright/test'
import {
  generateUploadUrl,
  __setProviderForTest,
} from '../../src/services/s3Service.js'
import { config } from '../../src/config/env.js'
import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@aws-sdk/types'

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function fixedProvider(identity: AwsCredentialIdentity): AwsCredentialIdentityProvider {
  return async () => identity
}

function futureCreds(ttlSec = 60 * 60): AwsCredentialIdentity {
  return {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    sessionToken: 'session-token',
    expiration: new Date(Date.now() + ttlSec * 1000),
  }
}

function decodePolicy(policy: string): { expiration: string; conditions: any[] } {
  const decoded = Buffer.from(policy, 'base64').toString('utf8')
  return JSON.parse(decoded)
}

test.beforeEach(() => __setProviderForTest(undefined))
test.afterEach(() => __setProviderForTest(undefined))

// -------------------------------------------------------------------------
// Suite
// -------------------------------------------------------------------------

test.describe('s3Service — S4 ContentLengthRange', () => {
  test('generateUploadUrl returns { url, fields } (presigned POST shape)', async () => {
    __setProviderForTest(fixedProvider(futureCreds()))
    const presigned = await generateUploadUrl(
      'user-1/documents/test.pdf',
      'application/pdf',
    )

    expect(typeof presigned.url).toBe('string')
    expect(presigned.url).toMatch(/^https?:\/\//)
    expect(typeof presigned.fields).toBe('object')
    // Required AWS POST-policy fields
    expect(presigned.fields.bucket).toBe(config.aws.s3Bucket)
    expect(presigned.fields.key).toBe('user-1/documents/test.pdf')
    expect(presigned.fields['Content-Type']).toBe('application/pdf')
    expect(presigned.fields.Policy).toBeTruthy()
    expect(presigned.fields['X-Amz-Signature']).toBeTruthy()
    expect(presigned.fields['X-Amz-Algorithm']).toBe('AWS4-HMAC-SHA256')
    expect(presigned.fields['X-Amz-Credential']).toMatch(/^AKIAIOSFODNN7EXAMPLE\//)
    expect(presigned.fields['X-Amz-Date']).toMatch(/^\d{8}T\d{6}Z$/)
  })

  test('policy includes [content-length-range, 0, maxFileSizeBytes]', async () => {
    __setProviderForTest(fixedProvider(futureCreds()))
    const presigned = await generateUploadUrl(
      'user-1/documents/test.pdf',
      'application/pdf',
    )

    const { conditions } = decodePolicy(presigned.fields.Policy)
    const lengthRange = conditions.find(
      (c: any) =>
        Array.isArray(c) &&
        c[0] === 'content-length-range' &&
        typeof c[1] === 'number' &&
        typeof c[2] === 'number',
    )
    expect(lengthRange).toBeTruthy()
    expect(lengthRange[1]).toBe(0)
    expect(lengthRange[2]).toBe(config.upload.maxFileSizeBytes)
  })

  test('policy pins Content-Type equality to the requested MIME', async () => {
    __setProviderForTest(fixedProvider(futureCreds()))
    const presigned = await generateUploadUrl(
      'user-1/documents/test.pdf',
      'application/pdf',
    )

    const { conditions } = decodePolicy(presigned.fields.Policy)
    const contentTypeCond = conditions.find(
      (c: any) => Array.isArray(c) && c[0] === 'eq' && c[1] === '$Content-Type',
    )
    expect(contentTypeCond).toBeTruthy()
    expect(contentTypeCond[2]).toBe('application/pdf')
  })

  test('policy expiration ≈ now + 300s with default upload expiry', async () => {
    __setProviderForTest(fixedProvider(futureCreds()))
    const before = Date.now()
    const presigned = await generateUploadUrl(
      'user-1/documents/test.pdf',
      'application/pdf',
    )
    const { expiration } = decodePolicy(presigned.fields.Policy)
    const expMs = new Date(expiration).getTime()
    expect(expMs - before).toBeGreaterThanOrEqual(295 * 1000)
    expect(expMs - before).toBeLessThanOrEqual(305 * 1000)
  })

  test('explicit expiresIn is honored in the policy expiration', async () => {
    __setProviderForTest(fixedProvider(futureCreds()))
    const before = Date.now()
    const presigned = await generateUploadUrl(
      'user-1/documents/test.pdf',
      'application/pdf',
      60, // 1 minute policy
    )
    const { expiration } = decodePolicy(presigned.fields.Policy)
    const expMs = new Date(expiration).getTime()
    expect(expMs - before).toBeGreaterThanOrEqual(55 * 1000)
    expect(expMs - before).toBeLessThanOrEqual(65 * 1000)
  })
})