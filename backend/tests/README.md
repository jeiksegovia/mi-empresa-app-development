# Backend API Testing

This directory contains the API testing infrastructure for the Mi Empresa backend service.

## Overview

We use two complementary testing approaches:

1. **Bash Scripts** - Lightweight, quick API tests using curl
2. **Playwright** - Comprehensive API testing with TypeScript

## Directory Structure

```
backend/tests/
├── setup.sh                  # Test environment setup script
├── auth/
│   ├── auth.test.sh         # Bash-based auth API tests
│   └── auth.spec.ts         # Playwright auth API tests
├── playwright.config.ts      # Playwright configuration
└── README.md                # This file
```

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL (running on port 5432)
- Backend server (running on port 3001)
- Playwright installed: `npm install --save-dev @playwright/test`

## Quick Start

### 1. Setup Test Environment

```bash
# From backend directory
./tests/setup.sh
```

This script will:
- Check if PostgreSQL is running
- Check if backend server is running
- Run database migrations
- Seed test data
- Export test environment variables

### 2. Run Bash Tests

```bash
# Run all bash tests
./tests/auth/auth.test.sh

# Or use npm script
npm run test:bash
```

### 3. Run Playwright Tests

```bash
# Run all Playwright tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test file
npx playwright test tests/auth/auth.spec.ts

# Or use npm script
npm run test:api
```

## Test Scripts

### Bash Tests (`*.test.sh`)

**Pros:**
- Fast execution
- No dependencies beyond curl
- Easy to understand and debug
- Great for CI/CD pipelines
- Minimal setup required

**Cons:**
- Limited assertion capabilities
- Manual JSON parsing
- Less sophisticated error handling

**Usage:**
```bash
# Make executable (if not already)
chmod +x tests/auth/auth.test.sh

# Run test
./tests/auth/auth.test.sh
```

### Playwright Tests (`*.spec.ts`)

**Pros:**
- Rich assertion library
- Built-in retry logic
- Detailed HTML reports
- Cookie/session management
- TypeScript support
- Parallel execution

**Cons:**
- Requires npm dependencies
- Slower than bash tests
- More complex setup

**Usage:**
```bash
# Run all tests
npx playwright test

# Run with headed browser (for debugging)
npx playwright test --headed

# Run specific test
npx playwright test tests/auth/auth.spec.ts

# Show report
npx playwright show-report
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
# API Configuration
TEST_API_URL=http://localhost:3001
TEST_TIMEOUT=30000

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=miempresa_db

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

## NPM Scripts

Add these scripts to `backend/package.json`:

```json
{
  "scripts": {
    "test": "npm run test:bash && npm run test:api",
    "test:bash": "./tests/auth/auth.test.sh",
    "test:api": "playwright test",
    "test:api:ui": "playwright test --ui",
    "test:api:debug": "playwright test --debug",
    "test:report": "playwright show-report"
  }
}
```

## Writing New Tests

### Bash Test Template

```bash
#!/bin/bash

# Source common functions
source "$(dirname "${BASH_SOURCE[0]}")/../test-helpers.sh"

print_test "Test description"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/endpoint")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status 200 $HTTP_CODE "Test name"
assert_json_key "$BODY" "key" "Check for key in response"
```

### Playwright Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ request }) => {
    const response = await request.get('/api/v1/endpoint');
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body).toHaveProperty('key');
  });
});
```

## Authentication Testing

The auth tests cover:

- ✅ Login with valid credentials
- ✅ Login with invalid credentials
- ✅ Login validation (email format, missing fields)
- ✅ Get current user (authenticated/unauthenticated)
- ✅ Refresh access token
- ✅ Logout
- ✅ Security (SQL injection, XSS attempts)

## Test Coverage

Current coverage:

- **Authentication**: POST /login, GET /me, POST /refresh, POST /logout
- **Validation**: Email format, required fields, error responses
- **Security**: SQL injection, XSS, long inputs

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Setup test environment
  run: |
    cd backend
    ./tests/setup.sh

- name: Run Bash tests
  run: |
    cd backend
    npm run test:bash

- name: Run Playwright tests
  run: |
    cd backend
    npx playwright test
```

## Troubleshooting

### PostgreSQL not running
```bash
# Start with Docker
npm run db:up

# Or start manually
pg_ctl start -D /usr/local/var/postgres
```

### Backend server not running
```bash
# Start in development mode
npm run dev

# Or build and start
npm run build && npm start
```

### Tests failing with 401
- Check if JWT secrets are set in `.env`
- Verify database has seed data
- Check if tokens are being properly stored

### Connection refused errors
- Ensure backend is running on port 3001
- Check `TEST_API_URL` environment variable
- Verify no firewall blocking localhost

## Best Practices

1. **Always run setup.sh first** - Ensures environment is ready
2. **Use descriptive test names** - Makes failures easy to identify
3. **Test both success and failure cases** - Don't just test happy path
4. **Clean up test data** - Use transactions or cleanup scripts
5. **Keep tests independent** - Each test should work in isolation
6. **Use appropriate tool** - Bash for quick checks, Playwright for complex flows

## Resources

- [Playwright API Testing](https://playwright.dev/docs/api-testing)
- [Bash Testing Guide](https://github.com/sstephenson/bats)
- [REST API Testing Best Practices](https://restfulapi.net/rest-api-testing/)

## Contributing

When adding new tests:

1. Create both bash and Playwright versions
2. Update this README with coverage info
3. Add npm scripts if needed
4. Document any new environment variables
5. Ensure tests pass in CI environment
