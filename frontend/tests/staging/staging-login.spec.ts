import { test, expect } from '@playwright/test';

/**
 * Staging Smoke / Integration — Frontend tier (real browser, deployed SPA)
 *
 * Runs against the LIVE staging site (Amplify) and proves the full chain:
 * Amplify SPA → HTTPS XHR → CloudFront API → Lightsail backend → PostgreSQL.
 *
 * Uses the dedicated QA user (see backend/prisma/test-db/) — no other data
 * is created or modified.
 *
 * Required env (exported by run-staging-qa.sh from SSM):
 *   TEST_FRONTEND_URL   e.g. https://miempresa-stg.disruptiveexp.com
 *   QA_USER_EMAIL / QA_USER_PASSWORD
 *
 * NOTE: must run against the CUSTOM domain, not *.amplifyapp.com — the
 * session cookie is SameSite=Strict, which only works because frontend and
 * API share the disruptiveexp.com site.
 */

const QA_EMAIL = process.env.QA_USER_EMAIL || 'qa@miempresa.com';
const QA_PASSWORD = process.env.QA_USER_PASSWORD || '';

test.describe('Staging frontend smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('deployed SPA serves the login page with the app shell', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Mi Empresa');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('SPA fallback: deep link to a protected route redirects to login', async ({ page }) => {
    // Exercises the Amplify rewrite rule (no real /empleados file exists)
    await page.goto('/empleados');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('full login flow against the staging backend', async ({ page }) => {
    expect(QA_PASSWORD, 'QA_USER_PASSWORD must be set (run via run-staging-qa.sh)').toBeTruthy();

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.locator('#email').fill(QA_EMAIL);
    await page.locator('#password input').fill(QA_PASSWORD);

    // Assert the XHR actually hits the STAGING API and succeeds (proves the
    // baked apiBase + CORS + SameSite cookie chain, not just UI state)
    const loginResponse = page.waitForResponse(
      (res) => res.url().includes('/api/v1/auth/login') && res.request().method() === 'POST',
      { timeout: 15000 }
    );
    await page.click('button[type="submit"]');
    const res = await loginResponse;
    expect(res.url()).toContain('miempresa-api-stg');
    expect(res.status()).toBe(200);

    // Lands on the dashboard, header shows the QA user
    await expect(page).toHaveURL('/', { timeout: 15000 });
    await expect(page.locator('header').getByText('QA Staging')).toBeVisible({ timeout: 10000 });
  });

  test('invalid credentials show an error and stay on login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.locator('#email').fill(QA_EMAIL);
    await page.locator('#password input').fill('definitely-wrong-password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.p-message-error, [role="alert"]')).toBeVisible({ timeout: 10000 });
  });

  test('logout returns to login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.locator('#email').fill(QA_EMAIL);
    await page.locator('#password input').fill(QA_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 15000 });

    // The sidebar (holding "Cerrar Sesión") is off-canvas until toggled
    await page.getByRole('button', { name: /toggle menu/i }).click();
    const logoutButton = page.getByRole('button', { name: /cerrar sesión|logout/i }).first();
    await logoutButton.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
