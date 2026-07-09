import { expect, type Page } from '@playwright/test'

/**
 * Login as the default admin user for local-qa runs.
 * Backend dev seed creates admin@miempresa.com / password123.
 *
 * Cookie scope:
 *   The session cookie is set by the BACKEND with `sameSite=Strict`. If we
 *   log in via the IP the SPA uses (e.g. 100.85.193.33:3101) and then
 *   navigate via a different origin (e.g. localhost:3100), the SPA's
 *   `/auth/me` fetch is cross-site and won't include the cookie → 401.
 *
 *   To match the user's manual testing flow, we derive the
 *   frontend-base URL from the same env var the SPA itself reads
 *   (NUXT_PUBLIC_API_BASE), extract the host origin, and use it for both
 *   the page navigation AND the login POST.
 */
let cachedBase: string | null = null

export function getApiOrigin(): string {
  // Returns e.g. "http://100.85.193.33:3101" (no trailing /api/v1).
  // Resolved at module load — Playwright config sets TEST_API_URL.
  const v = process.env.TEST_API_URL || 'http://localhost:3101'
  return v.replace(/\/api\/v1$/, '').replace(/\/$/, '')
}

export function getFrontendOrigin(): string {
  // Returns e.g. "http://100.85.193.33:3100" — same host as the API.
  const api = getApiOrigin()
  return api.replace(':3101', ':3100')
}

export async function getApiBase(_page?: Page): Promise<string> {
  if (cachedBase) return cachedBase
  cachedBase = `${getApiOrigin()}/api/v1`
  return cachedBase
}

export async function loginAsAdmin(page: Page): Promise<void> {
  const base = await getApiBase(page)
  // Clear any existing session cookie so a stale cookie from a previous
  // test doesn't conflict with a new login (the backend may 409 on
  // concurrent sessions).
  await page.context().clearCookies({ name: 'session' }).catch(() => {})
  const resp = await page.request.post(`${base}/auth/login`, {
    data: { email: 'admin@miempresa.com', password: 'password123' },
  })
  if (resp.status() !== 200) {
    throw new Error(`Login failed at ${base}: HTTP ${resp.status()}`)
  }
  const cookies = await page.context().cookies()
  if (!cookies.some((c) => c.name === 'session')) {
    throw new Error('Session cookie not set after login')
  }
}