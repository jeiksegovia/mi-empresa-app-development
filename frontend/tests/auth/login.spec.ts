import { test, expect } from '@playwright/test';

test.describe('Frontend Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test.describe('Login Page', () => {
    test('should render login page correctly', async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('h1')).toContainText('Mi Empresa');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
  });

  test.describe('Login Flow', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('#email').fill('admin@miempresa.com');
      await page.locator('input[placeholder="Ingresa tu contraseña"]').fill('password123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/', { timeout: 10000 });
      // Verify we're on dashboard: header shows user name (scope to header to avoid ambiguity)
      await expect(page.locator('header').getByText('Admin Sistema')).toBeVisible({ timeout: 5000 });
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('#email').fill('admin@miempresa.com');
      await page.locator('input[placeholder="Ingresa tu contraseña"]').fill('wrongpassword');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/login');
      await expect(page.locator('.p-message-error, [role="alert"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL('/login', { timeout: 5000 });
    });

    test('should allow access to dashboard after login', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('#email').fill('admin@miempresa.com');
      await page.locator('input[placeholder="Ingresa tu contraseña"]').fill('password123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/', { timeout: 10000 });
    });
  });

  test.describe('Logout Flow', () => {
    test('should logout successfully', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('#email').fill('admin@miempresa.com');
      await page.locator('input[placeholder="Ingresa tu contraseña"]').fill('password123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/', { timeout: 10000 });

      const logoutButton = page.getByRole('button', { name: /cerrar sesión|logout/i });
      await logoutButton.click();
      await expect(page).toHaveURL('/login', { timeout: 5000 });
    });
  });
});
