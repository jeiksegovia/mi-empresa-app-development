import { test, expect } from '@playwright/test'
import { assertPresignRoundtripFresh } from '../helpers/upload-persistence'

/**
 * S3 CANARY — presign → PUT → download-presign → GET through the APP's own
 * upload endpoints (W10 hardening item 1, BS-1).
 *
 * WHY THROUGH THE APP: the backend signs with a MODULE-LEVEL S3 client
 * (backend/src/services/s3Service.ts:5). The instance STS creds file carries no
 * expiration, so the SDK pins the creds read at process start; ~1h after each
 * deploy every presign is "born expired" (403 ExpiredToken) while cron keeps
 * rotating the file. Hitting the app's /uploads/presigned-url + /download-url
 * makes the app process do the signing, so this canary observes the SAME pinned
 * creds. A fresh `aws s3 presign` from a new CLI process would use fresh creds
 * and MISS the bug.
 *
 * WHY IT IS MEANINGFUL AT A CRED-ROTATION BOUNDARY: the 33/33 QA runs ~1-3 min
 * post-deploy at the freshest-possible creds, so it can never see the ≤1h
 * expiry. Two ways to make this spec catch it:
 *
 *   RUNBOOK STOPGAP (manual, zero-infra): after a deploy, re-run THIS spec at
 *   `deploy_time + 65 min` (guaranteed past the first cred boundary):
 *       TEST_API_URL=https://miempresa-api-stg.disruptiveexp.com/api/v1 \
 *       QA_USER_EMAIL=<ssm> QA_USER_PASSWORD=<ssm> \
 *         npx playwright test tests/staging/staging-s3-canary.spec.ts
 *   A green run at +65min proves the process refreshes creds correctly.
 *
 *   DURABLE (recommended): an on-instance cron canary every 5-10 min hitting
 *   these same app endpoints and alerting on non-200 — see result-hardening.md.
 *
 * ENV: TEST_API_URL (defaults to staging), QA_USER_EMAIL, QA_USER_PASSWORD.
 *   LOCAL GREEN: TEST_API_URL=http://localhost:3101/api/v1 QA creds=admin —
 *   the local backend signs against the -dev bucket (works end-to-end).
 */

const QA_EMAIL = process.env.QA_USER_EMAIL || 'admin@miempresa.com'
const QA_PASSWORD = process.env.QA_USER_PASSWORD || 'password123'
const API_BASE = process.env.TEST_API_URL || 'https://miempresa-api-stg.disruptiveexp.com/api/v1'

test('S3 canary: presign→PUT→GET round-trips with non-expired credentials', async ({ page }) => {
  const login = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email: QA_EMAIL, password: QA_PASSWORD },
  })
  expect(login.status(), `login failed at ${API_BASE} (need QA_USER_* env)`).toBe(200)

  const body = `s3-canary ${new Date().toISOString()} ${Math.random()}`
  const r = await assertPresignRoundtripFresh(page.request, API_BASE, {
    folder: 'qa-canary',
    contentType: 'application/octet-stream',
    body,
  })

  // Freshness diagnostics (logged, not asserted — the local -dev bucket signs
  // with a long-lived IAM user and has NO security token, so asserting one
  // would break local-green; on staging it should always be present).
  // eslint-disable-next-line no-console
  console.log(
    `[s3-canary] host-ok put=${r.putStatus} get=${r.getStatus} ` +
      `stsToken=${r.hasSecurityToken} accessKeyId=${r.accessKeyId}`,
  )
})
