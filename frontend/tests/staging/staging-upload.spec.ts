import { test, expect } from '@playwright/test';

/**
 * Staging upload e2e — proves the FULL storage chain against the live stage:
 * browser → POST presigned-url (CloudFront API) → PUT direct to the STAGING
 * S3 bucket → 200.
 *
 * Closes item 5 of storage-validation-report-jul5.md. Guards CRITICAL-1
 * (bucket exists / config points at it) and CRITICAL-2 (composable unwraps
 * res.data) in the deployed bundle.
 *
 * KEY ASSERTION RULE: the PUT must land on the staging uploads bucket host —
 * NOT just "some request returned 200". A PUT to .../undefined also returns
 * 200 from the SPA host (that was CRITICAL-2).
 *
 * Creates one throwaway empleado via API (cookie-authenticated) and deletes
 * it at the end.
 *
 * Required env (exported by run-staging-qa.sh from SSM):
 *   TEST_FRONTEND_URL, QA_USER_EMAIL, QA_USER_PASSWORD
 */

const QA_EMAIL = process.env.QA_USER_EMAIL || 'qa@miempresa.com';
const QA_PASSWORD = process.env.QA_USER_PASSWORD || '';
const API_BASE = process.env.TEST_API_URL || 'https://miempresa-api-stg.disruptiveexp.com/api/v1';
const UPLOADS_BUCKET_HOST = /miempresa-uploads-\d+-staging\.s3[.-]/;

test('real upload on staging: S3 PUT to the staging uploads bucket returns 200', async ({ page }) => {
  expect(QA_PASSWORD, 'QA_USER_PASSWORD must be set (run via run-staging-qa.sh)').toBeTruthy();
  await page.context().clearCookies();

  // Login through the deployed SPA (session cookie lands on the API host)
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(QA_EMAIL);
  await page.locator('input[type="password"]').fill(QA_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/$/, { timeout: 15000 });

  // Throwaway empleado (page.request shares the session cookie jar)
  const uniq = `STG-UPLOAD-${Date.now()}`;
  const created = await page.request.post(`${API_BASE}/employees`, {
    data: {
      nombre: 'QA',
      apellido: 'UploadProbe',
      tipoDocumento: 'CC',
      numeroDocumento: uniq,
      genero: 'MASCULINO',
      fechaNacimiento: '1990-01-01',
    },
  });
  expect(created.status(), `POST /employees failed: ${await created.text()}`).toBe(201);
  const empId = (await created.json()).data.id;

  try {
    await page.goto(`/empleados/${empId}/editar`);
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: /^certificados$/i }).first().click();
    await page.waitForTimeout(400);
    await page.locator('button', { hasText: /agregar certificado/i }).first().click();
    await page.waitForTimeout(300);

    // Register BEFORE triggering; pin the destination host (CRITICAL-2 lesson)
    const s3Put = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && UPLOADS_BUCKET_HOST.test(r.url()),
      { timeout: 20000 },
    );
    await page.locator('input[id^="cert-archivo-"]').first().setInputFiles({
      name: 'staging-upload-proof.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 staging-upload-proof jul5-release'),
    });
    const resp = await s3Put;
    expect(
      resp.status(),
      'S3 PUT to the staging bucket failed — check bucket CORS + AWS_S3_BUCKET SSM param',
    ).toBe(200);
  } finally {
    await page.request.delete(`${API_BASE}/employees/${empId}`);
  }
});
