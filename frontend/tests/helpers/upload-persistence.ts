import { expect, type APIRequestContext } from '@playwright/test'

/**
 * Upload-persistence & S3 round-trip helpers  (W10 hardening — BS-1 / BS-2).
 *
 * These helpers exist because two blind spots let the jul-10 S3 outage through
 * QA while the suite stayed 33/33 green:
 *
 *  BS-1 (time-dependence): the app signs presigned URLs with a MODULE-LEVEL
 *       S3 client (backend/src/services/s3Service.ts:5). The instance's STS
 *       creds file carries no expiration, so the SDK pins the creds read at
 *       process start; ~1h after each deploy every presign is "born expired"
 *       (403 ExpiredToken) even though cron keeps rotating the file. All these
 *       helpers deliberately flow through the APP's own presign endpoints so
 *       they observe the SAME pinned creds — a fresh `aws s3 presign` from a
 *       new process would use fresh creds and miss the bug.
 *
 *  BS-2 (persistence/download not asserted): `useFileUpload.uploadFile` does
 *       `await fetch(uploadUrl,{PUT})` and returns the key WITHOUT checking the
 *       PUT status — so a 403 looks like success and the entity saves a key
 *       whose object never landed. Every assertion below checks PUT **and**
 *       GET status, which the app never does.
 *
 * The bucket-host regex matches BOTH the local `-dev` bucket and the `-staging`
 * bucket, so specs using these helpers are green locally and meaningful on
 * staging without change.
 */

export const UPLOADS_BUCKET_HOST = /miempresa-uploads-\d+-(dev|staging)\.s3[.-]/

export interface RoundtripResult {
  key: string
  uploadUrl: string
  downloadUrl: string
  putStatus: number
  getStatus: number
  getBody: string
  /** true when the presigned URL was signed with STS temp creds (staging) */
  hasSecurityToken: boolean
  /** access-key id extracted from X-Amz-Credential (freshness diagnostics) */
  accessKeyId: string | null
}

/**
 * presign → PUT → download-presign → GET, all through the app's own endpoints.
 * Returns raw statuses/body — the caller decides what to assert. `contentType`
 * is signed into the PUT presign, so the PUT sends the exact matching header.
 */
export async function presignRoundtrip(
  request: APIRequestContext,
  apiBase: string,
  opts: { folder?: string; contentType?: string; body?: string } = {},
): Promise<RoundtripResult> {
  const folder = opts.folder ?? 'qa-canary'
  const contentType = opts.contentType ?? 'application/octet-stream'
  const body = opts.body ?? `qa-roundtrip ${new Date().toISOString()} ${Math.random()}`

  // 1) presign (the app process signs — reflects its pinned cred state)
  const presignRes = await request.post(`${apiBase}/uploads/presigned-url`, {
    data: { contentType, folder },
  })
  expect(presignRes.status(), `presign POST failed: ${await presignRes.text()}`).toBe(200)
  const { uploadUrl, key } = (await presignRes.json()).data as { uploadUrl: string; key: string }

  // Freshness signals from the signed URL (diagnostics; not host-specific asserts)
  const u = new URL(uploadUrl)
  const cred = u.searchParams.get('X-Amz-Credential')
  const accessKeyId = cred ? decodeURIComponent(cred).split('/')[0] : null
  const hasSecurityToken = u.searchParams.has('X-Amz-Security-Token')

  // 2) PUT the object — the app code never checks this; born-expired shows here
  const putRes = await request.put(uploadUrl, {
    headers: { 'Content-Type': contentType },
    data: Buffer.from(body),
  })

  // 3) download presign (3600s — the surface where expiry appears first)
  const dlRes = await request.get(`${apiBase}/uploads/download-url?key=${encodeURIComponent(key)}`)
  expect(dlRes.status(), `download-url presign failed: ${await dlRes.text()}`).toBe(200)
  const { downloadUrl } = (await dlRes.json()).data as { downloadUrl: string }

  // 4) GET the object back — proves the object exists AND creds still valid
  const getRes = await request.get(downloadUrl)
  const getBody = await getRes.text()

  return {
    key,
    uploadUrl,
    downloadUrl,
    putStatus: putRes.status(),
    getStatus: getRes.status(),
    getBody,
    hasSecurityToken,
    accessKeyId,
  }
}

/**
 * Assert the full round-trip succeeds with NON-EXPIRED credentials.
 * The functional PUT-200 + GET-200 (+ byte round-trip) IS the freshness
 * assertion: if the process's STS creds are pinned+expired, S3 returns 403
 * ExpiredToken and these fail with a diagnostic message.
 */
export async function assertPresignRoundtripFresh(
  request: APIRequestContext,
  apiBase: string,
  opts: { folder?: string; contentType?: string; body?: string } = {},
): Promise<RoundtripResult> {
  const r = await presignRoundtrip(request, apiBase, opts)
  expect(
    r.putStatus,
    `S3 PUT failed (status ${r.putStatus}). The app never checks this — a 403 here means the signing creds are ` +
      `expired/pinned (W10 BS-1). GET body/err: ${r.getBody?.slice(0, 240)}`,
  ).toBe(200)
  expect(
    r.getStatus,
    `S3 GET failed (status ${r.getStatus}) — download presign likely born-expired. Body: ${r.getBody?.slice(0, 240)}`,
  ).toBe(200)
  if (opts.body !== undefined) {
    expect(r.getBody, 'round-trip body mismatch — object stored is not what we PUT').toBe(opts.body)
  }
  return r
}

/**
 * Assert an entity persisted a non-null upload key after save+reload, and that
 * the key resolves to a real, downloadable object (GET 200). Closes W10 BS-2
 * (the HIGH-1 "persisted *_url non-null after upload" half that jul-5 never
 * implemented — the direct cause of S7 "file gone after reload").
 *
 * `entityGetUrl` is re-fetched fresh (the reload). `keyPath` extracts the key.
 */
export async function assertUploadPersisted(
  request: APIRequestContext,
  apiBase: string,
  opts: { entityGetUrl: string; keyPath: (data: any) => string | null | undefined; label?: string },
): Promise<string> {
  const label = opts.label ?? 'entity'
  const res = await request.get(opts.entityGetUrl)
  expect(res.status(), `${label} GET failed: ${opts.entityGetUrl}`).toBe(200)
  const data = (await res.json()).data
  const key = opts.keyPath(data)
  expect(
    key,
    `${label}: persisted key is null after reload — the upload key was not saved (W10 S7 / HIGH-1 persistence half)`,
  ).toBeTruthy()

  const dlRes = await request.get(`${apiBase}/uploads/download-url?key=${encodeURIComponent(key as string)}`)
  expect(dlRes.status(), `${label}: download presign failed for key ${key}`).toBe(200)
  const { downloadUrl } = (await dlRes.json()).data as { downloadUrl: string }
  const getRes = await request.get(downloadUrl)
  expect(
    getRes.status(),
    `${label}: persisted key ${key} does not download (object missing or presign expired — W10 S6/S7)`,
  ).toBe(200)
  return key as string
}

/** Most recent business day as YYYY-MM-DD (today, or the prior Friday on a
 *  weekend) — always within the backend's "last 2 business days" note window. */
export function recentBusinessDay(now: Date = new Date()): string {
  const d = new Date(now)
  const dow = d.getDay() // 0=Sun,6=Sat
  if (dow === 0) d.setDate(d.getDate() - 2)
  else if (dow === 6) d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
