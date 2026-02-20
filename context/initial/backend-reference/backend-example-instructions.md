# FOIA API Layer - AI Coding Agent Instructions

## Architecture Overview

This is a **Node.js 22.18.0 Express API** for managing FOIA (Freedom of Information Act) requests, built as a bridge between public portals and agency systems. The stack includes:

- **Backend**: Express.js with TypeScript, Prisma ORM 6.13.0, PostgreSQL
- **Authentication**: Dual auth system - ID.me OAuth for public users, username/password for agency staff
- **Deployment**: AWS Lambda (SAM) + EC2 CodeDeploy configurations available
- **File handling**: AWS S3 integration for document storage
- **External integration**: Hyperscience redaction workflow via S3 bucket watching

## Critical Development Patterns

### Database & Prisma
- **Generated client location**: `src/generated/prisma` (NOT default `node_modules/.prisma`)
- **Always run after schema changes**: `yarn db:generate` then `yarn build`
- **Migration pattern**: Use `yarn db:migrate --create-only` for new migrations, commit before applying
- **Connection**: Uses `getPrisma()` from `src/config/database.ts` with PrismaPg adapter - import this, not direct Prisma client
- **Schema location**: `prisma/schema.prisma` with `output = "../src/generated/prisma"`

```typescript
// Correct pattern - ALWAYS use this
import { getPrisma } from '../config/database'
const prisma = getPrisma()

// NEVER do this
import { PrismaClient } from '@prisma/client'
```

### Route Structure (3-tier API)
Routes are organized by user type in `src/routes/index.ts`:
- `/api/v1/public` - Public FOIA requesters (ID.me auth required)
- `/api/v1/agency` - Internal agency staff (username/password auth required) 
- `/api/v1/services` - Service-to-service workflows (API key auth + IP whitelist)

Each tier has separate route files in `src/routes/{public,agency,services}/` with corresponding controllers.

### Validation & Services Pattern
- **All input validation**: Use Zod schemas from `src/utils/validation.ts`
- **Dual schemas**: Public vs Agency schemas restrict field access (e.g., `foiaRequestPublicCreateSchema` vs `foiaRequestCreateSchema`)
- **Service layer**: Controllers delegate to services in `src/services/` - business logic lives there
- **Date handling**: Use `dateStr()` transform in Zod schemas for proper date validation

```typescript
// Service pattern example
export async function createRequest(data: z.infer<typeof foiaRequestCreateSchema>) {
  const parsed = foiaRequestCreateSchema.parse(data) // Always validate first
  // Transform dates, handle nulls, then prisma call
  return prisma.fOIARequest.create({ data: createData })
}
```

### Authentication Middleware
- **Session-based**: Uses `req.cookies.session` with database-stored `UserSession` table
- **Role-based permissions**: Users have roles → permissions through junction tables (`UserRole`, `RolePermission`)
- **Group permissions**: Users can also inherit permissions from groups (`UserGroup`, `GroupPermission`)
- **Request interface**: Extend `AuthenticatedRequest` for typed user access with `req.user.permissions` array
- **Administrator role**: Automatically gets all permissions - see `src/middleware/auth.ts` lines 88-95

## Essential Commands

### Local Development
```bash
# First time setup
curl https://get.volta.sh | bash  # Install Volta for Node version management
volta install node@22.18.0        # Respects package.json volta config
yarn install
yarn db:up                         # Docker PostgreSQL on port 15432
yarn db:generate                   # Generate Prisma client to src/generated/prisma
yarn db:migrate                    # Apply migrations
yarn db:seed                       # Seed test data from prisma/seed-data/*.json

# Daily workflow  
yarn dev                           # Start dev server with tsx watch on port 3000
yarn test                          # Jest tests
yarn typecheck                     # TypeScript validation
yarn lint                          # ESLint
yarn db:studio                     # Open Prisma Studio for database inspection

# Database management
yarn db:stop                       # Stop Docker database
yarn db:down                       # Stop and remove volumes
yarn db:migrate --create-only      # Create migration without applying (commit first!)
```

### Production Build (EC2/Lambda)
```bash
# EC2 deployment (via CodeDeploy scripts in scripts/)
yarn build                         # TypeScript compilation to dist/
yarn serve                         # PM2 cluster mode (--time flag for logging)
yarn stop                          # PM2 graceful shutdown

# Note: build-ExpressFunction does production yarn install and copies src/generated to dist/src/generated
```

## Environment Configuration

### Local (.env)
Copy `.env.example` and set `DATABASE_URL=postgresql://postgres:postgres@localhost:15432/foia`

### Production (SSM Parameter Store)
Environment loaded from SSM paths like `/foia/{dev|prod}/api/DATABASE_URL`. Scripts:
- `scripts/env.sh` - Fetches params from SSM and generates `.env` (used by CodeDeploy)
- `scripts/create-ssm-params.sh` - Creates all SSM parameters (one-time setup)
- Get secure params: `aws ssm get-parameter --name "/path" --with-decryption --query "Parameter.Value" --output text`

**Critical env vars:**
- `HS_TOKEN` - Hyperscience API token (SecureString)
- `HS_INPUT_BUCKET` / `HS_OUTPUT_BUCKET` - S3 buckets for redaction workflow
- `HS_FLOW_DEFAULT` - Default Hyperscience flow name (e.g., `ACME_FOIA_DEMO_FLOW`)

## File Organization Conventions

- **Controllers**: Route handlers only - delegate to services (e.g., `src/controllers/documents.controller.ts`)
- **Services**: Business logic and database operations (e.g., `src/services/documents.service.ts`, `src/services/redaction.service.ts`)
- **Types**: Custom TypeScript interfaces in `src/types/` extending Express types
- **Middleware**: `auth.ts` (session-based), `errorHandler.ts`, `notFound.ts`
- **Validation**: Zod schemas in `src/utils/validation.ts` - use for all API input validation
- **Generated**: Prisma client outputs to `src/generated/prisma` (configured in schema.prisma)
- **Utils**: Helper functions - `src/utils/s3.ts` for S3 operations, `src/utils/jwt.ts` for auth

## Deployment Contexts

### EC2 CodeDeploy  
- AppSpec: Root-level `appspec.yml` copies full repo to `/home/ec2-user/app`
- Scripts: `scripts/{before,after}-install.sh`, `start/stop-service.sh`, `validate.sh`
- PM2 management: `yarn serve` starts cluster mode, `yarn stop` for graceful shutdown
- Health check: `validate.sh` curls localhost:3000/health

## Hyperscience Redaction Integration

**Critical workflow** for document redaction via external service:

1. **Initiate**: `initiateRedaction(documentId)` in `src/services/redaction.service.ts`
   - Creates metadata JSON with requester info + document references
   - Uploads JSON sidecar to `HS_INPUT_BUCKET/json/{filename}.json`
   - Copies PDF to `HS_INPUT_BUCKET/json/{filename}` (Hyperscience watches this bucket)
   
2. **Processing**: Hyperscience picks up PDF + JSON, runs redaction flow
   
3. **Callback**: Hyperscience POSTs to `/api/v1/services/redaction/notifier` with results
   - `handleNotifier()` downloads redacted PDF from Hyperscience API
   - Stores to `HS_OUTPUT_BUCKET/{requestId}/redacted/{documentId}.pdf`
   - Updates document record with `redactedFilePath` and `redactedAt`

**Key metadata structure** (see `initiateRedaction`):
```typescript
{
  metadata: { agency, priority, LastName, FirstName, SSN, RequestID, ... },
  cases: [{ external_case_id: requestNumber, filenames: [filename] }],
  external_id: documentId  // Used for callback matching
}
```

## Common Gotchas

1. **Prisma client path**: Generated to `src/generated/prisma`, must copy to `dist/src/generated` after build (Makefile handles this)
2. **Date handling**: Use `dateStr()` transform in Zod schemas - it validates ISO strings and transforms to Date
3. **Dual auth system**: Public routes need ID.me user context, Agency routes need username/role context
4. **File uploads**: S3-based via `src/services/s3.service.ts` - use pre-signed URLs, NOT direct multer uploads
5. **Database migrations**: Never run `yarn db:migrate` against live databases - commit migrations, CI/CD applies them
6. **S3 utilities**: Import from `src/utils/s3.ts` (e.g., `putJson`, `copyObject`, `uploadStream`) not from services
7. **Always run `yarn db:generate`** after any schema changes to keep Prisma client up to date, or before running: `test` `build`

## When Adding New Features

1. **API endpoints**: Add route → controller → service → validate with appropriate Zod schema
   - Public schemas in `foiaRequestPublicCreateSchema` restrict fields vs internal `foiaRequestCreateSchema`
2. **Database changes**: 
   - `yarn db:migrate --create-only` with descriptive name
   - Edit generated SQL if needed, commit before applying
   - Run `yarn db:generate` after schema changes
3. **Authentication**: Use `authMiddleware` and check `req.user.permissions` array
   - Permission names: `review_documents`, `upload_documents`, `redact_documents`, etc.
4. **File handling**: 
   - Use S3 service for uploads (`generateUploadUrl` for pre-signed URLs)
   - Store metadata in `Document` table with `filePath` (S3 key)
5. **Testing**: Add tests in `tests/` directory - see `tests/setup.ts` for test DB config

## Code style and patterns
- Follow existing code patterns for consistency
- Use async/await for all asynchronous operations
- Use try/catch in controllers to forward errors to error handling middleware
- **Avoid using `else` or `else if ` patterns** if can be avoided with early returns, continue, break, separated if statements or separated functions.