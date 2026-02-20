# Testing Strategy Update

## Test Organization

### Bash Scripts (DevOps/Infrastructure Only)
- **Purpose**: Test artifacts, build commands, network setup, Docker, deployment scripts
- **Location**: `{project}/tests/setup.sh` and similar infrastructure scripts
- **Use Cases**:
  - Docker container health checks
  - Database connectivity
  - Environment setup verification
  - Build artifact validation
  - Network/port availability
  - Service dependencies

### Playwright Tests (Application Testing)
- **Purpose**: All application-level testing (API, E2E, integration)
- **Location**: `{project}/tests/**/*.spec.ts`
- **Use Cases**:
  - API endpoint testing (backend)
  - UI/E2E testing (frontend)
  - Authentication flows
  - Business logic validation
  - Response validation
  - Error handling

## Current Test Structure

### Backend (`backend/tests/`)
```
tests/
├── setup.sh           # ✅ DevOps - Check Docker, DB, server
├── auth/
│   └── auth.spec.ts   # ✅ Playwright - API endpoint tests
└── README.md
```

### Frontend (`frontend/tests/`)
```
tests/
├── setup.sh           # ✅ DevOps - Check backend API, frontend server
├── auth/
│   └── login.spec.ts  # ✅ Playwright - E2E login/auth tests
└── README.md
```

## Removed
- ❌ `backend/tests/auth/auth.test.sh` - Redundant (Playwright covers this)
- ❌ `frontend/tests/auth/auth-flow.test.sh` - Redundant (Playwright covers this)

## Test Execution

### Quick Check (DevOps)
```bash
# Backend
cd backend && ./tests/setup.sh

# Frontend
cd frontend && ./tests/setup.sh
```

### Full Test Suite (Playwright)
```bash
# Backend API tests
cd backend && npm test

# Frontend E2E tests
cd frontend && npm test
```

---

**Updated**: 2026-02-18
**Principle**: Bash for DevOps/artifacts, Playwright for application testing
