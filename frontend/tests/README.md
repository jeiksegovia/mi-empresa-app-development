# Frontend E2E Testing

This directory contains the end-to-end testing infrastructure for the Mi Empresa frontend application.

## Overview

We use two complementary testing approaches:

1. **Bash Scripts** - Quick HTML/HTTP validation tests
2. **Playwright** - Comprehensive browser-based E2E tests

## Directory Structure

```
frontend/tests/
├── setup.sh                    # Test environment setup script
├── auth/
│   ├── auth-flow.test.sh      # Bash-based frontend tests
│   └── login.spec.ts          # Playwright E2E login tests
├── playwright.config.ts        # Playwright configuration
└── README.md                  # This file
```

## Prerequisites

- Node.js 18+ and npm
- Backend API (running on port 3001)
- Frontend app (running on port 3000)
- Playwright installed: `npm install --save-dev @playwright/test`
- Playwright browsers: `npx playwright install`

## Quick Start

### 1. Setup Test Environment

```bash
# From frontend directory
./tests/setup.sh
```

This script will:
- Check if backend API is running
- Check if frontend server is running
- Export test environment variables

### 2. Run Bash Tests

```bash
# Run all bash tests
./tests/auth/auth-flow.test.sh

# Or use npm script
npm run test:bash
```

### 3. Run Playwright Tests

```bash
# Install browsers first (one-time)
npx playwright install

# Run all Playwright tests
npx playwright test

# Run with UI mode (recommended for development)
npx playwright test --ui

# Run specific test file
npx playwright test tests/auth/login.spec.ts

# Or use npm script
npm run test:e2e
```

## Test Scripts

### Bash Tests (`*.test.sh`)

**Pros:**
- Very fast execution
- No browser overhead
- Great for CI/CD pipelines
- Tests basic HTML/HTTP functionality

**Cons:**
- Cannot test JavaScript interactions
- No visual validation
- Limited to HTTP checks

**What they test:**
- Page loads successfully
- HTML structure is valid
- Routes are accessible
- Security headers
- Basic XSS protection

**Usage:**
```bash
chmod +x tests/auth/auth-flow.test.sh
./tests/auth/auth-flow.test.sh
```

### Playwright Tests (`*.spec.ts`)

**Pros:**
- Full browser testing
- JavaScript execution
- Visual validation
- User interaction simulation
- Screenshot/video on failure
- Accessibility testing

**Cons:**
- Slower than bash tests
- Requires browser installation
- More resource intensive

**What they test:**
- Login form rendering
- Form validation
- Successful authentication
- Protected route access
- Session persistence
- Logout functionality
- Keyboard navigation
- Accessibility

**Usage:**
```bash
# Run all tests
npx playwright test

# Watch mode (re-run on file changes)
npx playwright test --ui

# Debug mode
npx playwright test --debug

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test
npx playwright test -g "should successfully login"
```

## Environment Variables

Create a `.env` file in the frontend directory:

```env
# Frontend Configuration
TEST_FRONTEND_URL=http://localhost:3000
NUXT_PUBLIC_SITE_URL=http://localhost:3000

# Backend API Configuration
TEST_BACKEND_URL=http://localhost:3001
NUXT_PUBLIC_API_URL=http://localhost:3001

# Test Configuration
TEST_TIMEOUT=30000
```

## NPM Scripts

Add these scripts to `frontend/package.json`:

```json
{
  "scripts": {
    "test": "npm run test:bash && npm run test:e2e",
    "test:bash": "./tests/auth/auth-flow.test.sh",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:report": "playwright show-report"
  }
}
```

## Test Coverage

### Login Page
- ✅ Page rendering
- ✅ Form validation (empty, invalid email)
- ✅ Error messages (invalid credentials)
- ✅ Successful login flow
- ✅ Session persistence
- ✅ Password visibility toggle
- ✅ Network error handling

### Authentication Flow
- ✅ Protected route redirects
- ✅ Logout functionality
- ✅ Token expiration handling
- ✅ Post-logout route protection

### Accessibility
- ✅ ARIA labels
- ✅ Keyboard navigation
- ✅ Focus management

## Writing New Tests

### Bash Test Template

```bash
#!/bin/bash
source "$(dirname "${BASH_SOURCE[0]}")/../test-helpers.sh"

print_test "Test description"
RESPONSE=$(curl -s -w "\n%{http_code}" "$FRONTEND_URL/path")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status 200 $HTTP_CODE "Test name"
assert_contains "$BODY" "expected text" "Check for content"
```

### Playwright Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/path');
    
    await expect(page.getByRole('heading')).toBeVisible();
    await page.getByLabel('Input').fill('value');
    await page.getByRole('button').click();
    
    await expect(page).toHaveURL(/success/);
  });
});
```

## Debugging Tests

### Playwright UI Mode
```bash
npx playwright test --ui
```
- See all tests
- Run/debug individual tests
- Inspect DOM
- See network requests
- View console logs

### Debug Mode
```bash
npx playwright test --debug
```
- Step through tests
- Pause execution
- Inspect elements
- Modify selectors

### Visual Debug
```bash
npx playwright test --headed --slow-mo=1000
```
- See browser actions
- Slow down execution
- Watch interactions

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Install Playwright Browsers
        run: |
          cd frontend
          npx playwright install --with-deps
      
      - name: Start backend
        run: |
          cd backend
          npm ci
          npm run dev &
          sleep 5
      
      - name: Start frontend
        run: |
          cd frontend
          npm run dev &
          sleep 5
      
      - name: Run tests
        run: |
          cd frontend
          npm run test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

## Troubleshooting

### Backend not running
```bash
cd ../backend
npm run dev
```

### Frontend not running
```bash
npm run dev
```

### Playwright browsers not installed
```bash
npx playwright install
```

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if server is responsive
- Look for slow network requests

### Tests flaky
- Use proper wait strategies (`waitForSelector`, `waitForURL`)
- Avoid hardcoded timeouts
- Use `test.retry()` for unstable tests

### Screenshots not working
- Check `playwright.config.ts` has `screenshot: 'only-on-failure'`
- Look in `playwright-report/` or `test-results/`

## Best Practices

1. **Use proper selectors**
   - Prefer `getByRole`, `getByLabel`, `getByText`
   - Avoid CSS selectors that break easily
   - Use `data-testid` for dynamic content

2. **Wait for elements properly**
   - Use `waitForSelector` not `waitForTimeout`
   - Use `waitForURL` for navigation
   - Use `waitForLoadState` for page loads

3. **Keep tests independent**
   - Each test should work in isolation
   - Use `beforeEach` for setup
   - Don't rely on test order

4. **Use descriptive test names**
   - Clear what is being tested
   - Easy to identify failures
   - Follow "should" pattern

5. **Test real user scenarios**
   - Not just happy paths
   - Include error cases
   - Test edge cases

6. **Keep tests fast**
   - Minimize navigation
   - Use API for setup when possible
   - Run in parallel when safe

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Nuxt Testing Guide](https://nuxt.com/docs/getting-started/testing)
- [E2E Testing Best Practices](https://testingjavascript.com/)

## Contributing

When adding new tests:

1. Create both bash and Playwright versions (when applicable)
2. Update this README with coverage info
3. Add npm scripts if needed
4. Document any new environment variables
5. Ensure tests pass in CI environment
6. Add screenshots/videos of important flows
