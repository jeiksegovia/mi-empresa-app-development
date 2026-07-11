import { readFileSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@aws-sdk/types'

/**
 * awsCredentials — env-aware AWS credential resolution for the S3 client.
 *
 * Background (see W8 forensics result):
 *   - Staging uses STS session credentials minted by `refresh-credentials.sh` every
 *     45 minutes. The cron writes `/home/ec2-user/.aws/credentials` with key+secret+token
 *     but NO expiration field.
 *   - The AWS SDK's default provider memoizes credentials forever when no
 *     `expiration` is present. The PM2 process (long-lived) thus keeps using
 *     stale STS creds until restart, and signed URLs become `ExpiredToken`.
 *
 * Strategy:
 *   - Local dev (AWS_PROFILE set, or `AWS_CREDS_ROTATED` unset + no
 *     `aws_session_token` in env): keep the SDK default chain (long-lived
 *     `disruptive` profile keys or static env vars). DO NOT auto-rotate.
 *   - Rotated environments (presence of `AWS_CREDS_ROTATED=1`, OR the env
 *     contains `AWS_SESSION_TOKEN`, OR the loaded credentials file contains
 *     a session token): provide a custom provider that re-reads
 *     `~/.aws/credentials` on every cycle and synthesizes an `expiration`
 *     field 5 minutes before the file's mtime+55 min. The SDK then
 *     auto-invalidates its cache (it expires credentials 5 min BEFORE the
 *     declared `expiration`), forcing a fresh re-read on every presign
 *     after the STS rotation.
 *
 * This module is unit-testable: pass an injected credentials-file reader
 * and an mtime resolver for deterministic tests.
 */

const SESSION_CRED_LIFETIME_SEC = 55 * 60 // STS-style 55 min validity window

export interface CredentialsFileBlock {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

export interface CredentialsProviderDeps {
  /** Read raw text of the credentials file. */
  readCredsFile?: () => string
  /** Return the file mtime in ms-since-epoch. */
  readCredsMtimeMs?: () => number
  /** env-var lookup, injectable for tests. */
  getEnv?: (name: string) => string | undefined
}

function defaultReadCredsFile(): string {
  // Common locations for the STS-rotated file. refresh-credentials.sh writes
  // to BOTH `$HOME/.aws/credentials` and the home of the PM2 user.
  const candidates = [
    join(process.env.HOME || homedir(), '.aws', 'credentials'),
    join(homedir(), '.aws', 'credentials'),
  ]
  for (const p of candidates) {
    try {
      return readFileSync(p, 'utf8')
    } catch {
      // try next
    }
  }
  return ''
}

function defaultReadCredsMtimeMs(): number {
  const candidates = [
    join(process.env.HOME || homedir(), '.aws', 'credentials'),
    join(homedir(), '.aws', 'credentials'),
  ]
  for (const p of candidates) {
    try {
      return statSync(p).mtimeMs
    } catch {
      // try next
    }
  }
  return 0
}

/**
 * Parse the [default] block from a credentials file.
 * Mirrors the SDK's `fromIni` parsing for the few fields we care about.
 */
export function parseDefaultBlock(ini: string): CredentialsFileBlock | null {
  const block = ini.match(/\[default\]([\s\S]*?)(?=\[|$)/)?.[1]
  if (!block) return null
  const accessKeyId = block.match(/^\s*aws_access_key_id\s*=\s*(\S+)/m)?.[1]
  const secretAccessKey = block.match(/^\s*aws_secret_access_key\s*=\s*(\S+)/m)?.[1]
  const sessionToken = block.match(/^\s*aws_session_token\s*=\s*(\S+)/m)?.[1]
  if (!accessKeyId || !secretAccessKey) return null
  return { accessKeyId, secretAccessKey, sessionToken }
}

/**
 * Detect whether the runtime is using rotated STS session credentials.
 * Heuristic:
 *   1. `AWS_CREDS_ROTATED=1` explicit opt-in (env flag set by SSM / env.sh /
 *      ops runbook for staging+prod where the refresh-credentials cron
 *      runs and STS AssumeRole is in play).
 *   2. The standard AWS env vars `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
 *      are set AND `AWS_SESSION_TOKEN` is also set (so a session is in play
 *      even if the explicit flag was forgotten).
 *   3. The credentials file has a `aws_session_token` in the [default]
 *      block — same signal, found regardless of where creds were sourced.
 *
 * For each detection source we treat "session present" as "rotated": the
 * STS refresh-credentials.sh only writes session tokens when it has minted
 * them via AssumeRole.
 */
function shouldUseRotatedProvider(deps: Required<CredentialsProviderDeps>): boolean {
  const env = deps.getEnv
  if (env('AWS_CREDS_ROTATED') === '1') return true
  if (env('AWS_ACCESS_KEY_ID') && env('AWS_SECRET_ACCESS_KEY') && env('AWS_SESSION_TOKEN')) {
    return true
  }
  // Only fall back to file scan when the explicit signal isn't present, so
  // a local-dev `~/.aws/credentials` with stale leftover session tokens
  // doesn't accidentally trigger rotated mode. We only consult the file if
  // the env vars are NOT set (i.e. the env didn't already answer).
  if (!env('AWS_ACCESS_KEY_ID') && !env('AWS_PROFILE')) {
    const fileBlock = parseDefaultBlock(deps.readCredsFile())
    if (fileBlock?.sessionToken) return true
  }
  return false
}

/**
 * Build a credential provider that re-reads the file on every cycle. The
 * provider returns an `expiration` derived from the file's mtime so the SDK
 * properly invalidates its memoized cache.
 *
 * The provider is invoked by the SDK with no arguments; it returns an
 * `AwsCredentialIdentity` whose `expiration` is `mtime + 55 min`. The
 * SDK's `memoizeChain` expires 5 min before `expiration`, so creds are
 * re-read every ~50 min — well within the ~45 min cron cadence.
 */
export function makeRotatedCredentialsProvider(
  deps: CredentialsProviderDeps = {},
): AwsCredentialIdentityProvider {
  const resolvedDeps: Required<CredentialsProviderDeps> = {
    readCredsFile: deps.readCredsFile ?? defaultReadCredsFile,
    readCredsMtimeMs: deps.readCredsMtimeMs ?? defaultReadCredsMtimeMs,
    getEnv: deps.getEnv ?? ((name: string) => process.env[name]),
  }

  return async (): Promise<AwsCredentialIdentity> => {
    const ini = resolvedDeps.readCredsFile()
    const block = parseDefaultBlock(ini)
    if (!block) {
      throw new Error(
        'rotated-credentials provider could not parse [default] block from AWS credentials file',
      )
    }
    const mtimeMs = resolvedDeps.readCredsMtimeMs()
    // If mtime is unavailable, default to "fresh" → expire in 55 min from now.
    const base = mtimeMs > 0 ? mtimeMs : Date.now()
    const expiration = new Date(base + SESSION_CRED_LIFETIME_SEC * 1000)
    const identity: AwsCredentialIdentity = {
      accessKeyId: block.accessKeyId,
      secretAccessKey: block.secretAccessKey,
      ...(block.sessionToken ? { sessionToken: block.sessionToken } : {}),
      expiration,
    }
    return identity
  }
}

/**
 * Decide which credential resolution mode this process should use, and
 * optionally return a custom provider (only when rotated mode applies).
 *
 * @returns `undefined` → the caller should NOT pass `credentials` to the
 *          S3Client, letting the SDK use its default provider chain
 *          (preserves local-dev behavior).
 *          An `AwsCredentialIdentityProvider` → pass it to `new S3Client`,
 *          which uses the provider on every credential refresh cycle and
 *          correctly invalidates the memoized cache as the file rotates.
 */
export function resolveS3Credentials(
  deps: CredentialsProviderDeps = {},
): AwsCredentialIdentityProvider | undefined {
  const resolvedDeps: Required<CredentialsProviderDeps> = {
    readCredsFile: deps.readCredsFile ?? defaultReadCredsFile,
    readCredsMtimeMs: deps.readCredsMtimeMs ?? defaultReadCredsMtimeMs,
    getEnv: deps.getEnv ?? ((name: string) => process.env[name]),
  }
  if (!shouldUseRotatedProvider(resolvedDeps)) return undefined
  return makeRotatedCredentialsProvider(resolvedDeps)
}
