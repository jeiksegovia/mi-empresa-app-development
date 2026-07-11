/**
 * W11 P0 — unit tests for the env-aware AWS credential provider.
 *
 * Covers (per task assignment §Hard requirements):
 *   • creds-without-session-token → resolveS3Credentials() returns
 *     undefined (default chain) — preserves local-dev behavior.
 *   • creds-with-session-token in env → returns a provider whose
 *     yielded identity carries an `expiration` derived from the file mtime.
 *   • creds-with-session-token in the file → same as above.
 *   • AWS_CREDS_ROTATED=1 override → always returns the provider.
 *   • Provider can re-read across cycles; the second invocation sees the
 *     rotated file contents.
 */

import { test, expect } from '@playwright/test'
import {
  parseDefaultBlock,
  resolveS3Credentials,
  makeRotatedCredentialsProvider,
} from '../../src/config/awsCredentials.js'

// A canonical sample of an AWS credentials file with no session token
// (local dev / IAM user keys).
const INI_NO_SESSION = `
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
`

const INI_WITH_SESSION = `
[default]
aws_access_key_id = ASIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
aws_session_token = FQoGZXIvYXdzEPL//////////wEaDExampleSessionToken==
`

const NEXT_DAY = new Date('2026-07-10T12:00:00Z').getTime()
const NEXT_DAY_PLUS_45 = NEXT_DAY + 45 * 60 * 1000

test.describe('awsCredentials module (W11 P0)', () => {
  test.describe('parseDefaultBlock', () => {
    test('parses access keys + secret', async () => {
      const block = parseDefaultBlock(INI_NO_SESSION)
      expect(block).not.toBeNull()
      expect(block?.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE')
      expect(block?.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
      expect(block?.sessionToken).toBeUndefined()
    })

    test('parses session token when present', async () => {
      const block = parseDefaultBlock(INI_WITH_SESSION)
      expect(block?.sessionToken).toBe('FQoGZXIvYXdzEPL//////////wEaDExampleSessionToken==')
    })

    test('returns null when [default] is absent', async () => {
      expect(parseDefaultBlock('[other]\nfoo=bar')).toBeNull()
      expect(parseDefaultBlock('')).toBeNull()
    })
  })

  test.describe('resolveS3Credentials (env-aware)', () => {
    test('no session token anywhere → undefined (default chain)', async () => {
      const provider = resolveS3Credentials({
        readCredsFile: () => INI_NO_SESSION,
        readCredsMtimeMs: () => NEXT_DAY,
        getEnv: () => undefined,
      })
      expect(provider).toBeUndefined()
    })

    test('AWS_CREDS_ROTATED=1 → provider (env flag overrides everything)', async () => {
      const provider = resolveS3Credentials({
        readCredsFile: () => INI_NO_SESSION,
        readCredsMtimeMs: () => NEXT_DAY,
        getEnv: (name) => (name === 'AWS_CREDS_ROTATED' ? '1' : undefined),
      })
      expect(provider).toBeDefined()
      const identity = await provider!()
      expect(identity.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE')
      expect(identity.expiration).toBeInstanceOf(Date)
      // Default chain has no session token; provider must NOT synthesize one.
      expect(identity.sessionToken).toBeUndefined()
    })

    test('AWS_SESSION_TOKEN env → provider', async () => {
      const env: Record<string, string> = {
        AWS_ACCESS_KEY_ID: 'ASIAENVSESSIONEXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'env-secret',
        AWS_SESSION_TOKEN: 'env-session-token',
      }
      const provider = resolveS3Credentials({
        readCredsFile: () => INI_NO_SESSION,
        readCredsMtimeMs: () => NEXT_DAY,
        getEnv: (name) => env[name],
      })
      expect(provider).toBeDefined()
    })

    test('session token in credentials file + no env vars + no profile → provider', async () => {
      const provider = resolveS3Credentials({
        readCredsFile: () => INI_WITH_SESSION,
        readCredsMtimeMs: () => NEXT_DAY,
        getEnv: () => undefined,
      })
      expect(provider).toBeDefined()
    })

    test('session token in file BUT AWS_PROFILE is set → undefined (local-dev override)', async () => {
      const provider = resolveS3Credentials({
        readCredsFile: () => INI_WITH_SESSION,
        readCredsMtimeMs: () => NEXT_DAY,
        getEnv: (name) => (name === 'AWS_PROFILE' ? 'disruptive' : undefined),
      })
      // Profile-based local dev wins over stale leftover session tokens in
      // the credentials file.
      expect(provider).toBeUndefined()
    })

    test('AWS_ACCESS_KEY_ID without AWS_SESSION_TOKEN AND AWS_PROFILE set → undefined (local dev)', async () => {
      const env: Record<string, string> = {
        AWS_PROFILE: 'disruptive',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      }
      const provider = resolveS3Credentials({
        readCredsFile: () => INI_NO_SESSION,
        readCredsMtimeMs: () => NEXT_DAY,
        getEnv: (name) => env[name],
      })
      expect(provider).toBeUndefined()
    })
  })

  test.describe('makeRotatedCredentialsProvider (yielded identity)', () => {
    test('yields an expiration derived from file mtime + 55 min', async () => {
      const provider = makeRotatedCredentialsProvider({
        readCredsFile: () => INI_WITH_SESSION,
        readCredsMtimeMs: () => NEXT_DAY,
        getEnv: () => undefined,
      })
      const identity = await provider()
      expect(identity.accessKeyId).toBe('ASIAIOSFODNN7EXAMPLE')
      expect(identity.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
      expect(identity.sessionToken).toBe('FQoGZXIvYXdzEPL//////////wEaDExampleSessionToken==')
      expect(identity.expiration).toBeInstanceOf(Date)
      // expiration = mtime + 55 minutes
      expect(identity.expiration!.getTime()).toBe(NEXT_DAY + 55 * 60 * 1000)
    })

    test('re-reads the file across calls — sees rotated STS credentials', async () => {
      let current = INI_WITH_SESSION
      const provider = makeRotatedCredentialsProvider({
        readCredsFile: () => current,
        readCredsMtimeMs: () => Date.now(),
        getEnv: () => undefined,
      })
      const before = await provider()
      expect(before.accessKeyId).toBe('ASIAIOSFODNN7EXAMPLE')

      // Simulate a 45-min-later rotation: new STS session token.
      current = INI_WITH_SESSION
        .replace('ASIAIOSFODNN7EXAMPLE', 'ASIAROTATEDKEYEXAMPLE')
        .replace(
          'FQoGZXIvYXdzEPL//////////wEaDExampleSessionToken==',
          'NEW_SESSION_TOKEN_AFTER_ROTATION==',
        )

      const after = await provider()
      expect(after.accessKeyId).toBe('ASIAROTATEDKEYEXAMPLE')
      expect(after.sessionToken).toBe('NEW_SESSION_TOKEN_AFTER_ROTATION==')
      // Different identity across re-invocation ⇒ cache self-invalidates
      // when the previously-yielded expiration passes (SDK rules).
    })

    test('expires gracefully when credentials file is missing', async () => {
      const provider = makeRotatedCredentialsProvider({
        readCredsFile: () => '',
        readCredsMtimeMs: () => NEXT_DAY,
        getEnv: () => undefined,
      })
      await expect(provider()).rejects.toThrow(/could not parse/)
    })

    test('falls back to Date.now() when mtime is zero (defensive)', async () => {
      const provider = makeRotatedCredentialsProvider({
        readCredsFile: () => INI_WITH_SESSION,
        readCredsMtimeMs: () => 0,
        getEnv: () => undefined,
      })
      const before = Date.now()
      const identity = await provider()
      const after = Date.now()
      const exp = identity.expiration!.getTime()
      // 55 min from "now" — should be between before+55min and after+55min.
      expect(exp).toBeGreaterThanOrEqual(before + 55 * 60 * 1000 - 1000)
      expect(exp).toBeLessThanOrEqual(after + 55 * 60 * 1000 + 1000)
    })
  })

  test.describe('rotation boundary (the bug W8 documented)', () => {
    test('after the SDK marks creds as expired (mtime+55min + 5min grace), next provider call sees fresh creds', async () => {
      // Step 1: mtime is at T0 → fresh STS session
      let currentFile = INI_WITH_SESSION
      let mtime = 1_700_000_000_000 // arbitrary T0
      const provider = makeRotatedCredentialsProvider({
        readCredsFile: () => currentFile,
        readCredsMtimeMs: () => mtime,
        getEnv: () => undefined,
      })

      const fresh = await provider()
      // SDK's memoizeChain invalidates ~5 min before `expiration`.
      // So if a presign is requested at T0+50min, the SDK should re-invoke.
      // Step 2: the cron rotates the file at T0+45min — different access key.
      mtime += 45 * 60 * 1000
      currentFile = currentFile.replace(
        'ASIAIOSFODNN7EXAMPLE',
        'ASIAPOSTROTATIONEXAMPLE',
      )

      // SDK-invalidation simulation: re-invoke (cache miss after expiration).
      const rotated = await provider()
      expect(rotated.accessKeyId).toBe('ASIAPOSTROTATIONEXAMPLE')
      // expiration advances with the new mtime, never frozen at T0.
      expect(rotated.expiration!.getTime()).toBeGreaterThan(fresh.expiration!.getTime())
    })
  })
})
