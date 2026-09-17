# FOIA Request Cleanup Scripts

This directory contains utility scripts for cleaning up FOIA requests and their associated data.

## Quick Start

```bash
# 1. Preview what would be deleted (recommended first step)
yarn tsx prisma/db-utilities/cleanup-requests.ts --dry-run FOIA-1759939815839

# 2. Delete a single request
yarn tsx prisma/db-utilities/cleanup-requests.ts FOIA-1759939815839

# 3. Batch delete multiple requests
yarn tsx prisma/db-utilities/cleanup-requests.ts FOIA-1759939815839 FOIA-1759940440260 FOIA-1759936391404

# 4. Use the example script for programmatic cleanup
# Edit prisma/cleanup-example.ts first, then run:
yarn tsx prisma/db-utilities/cleanup-example.ts
```

## Scripts Overview

### 1. cleanup-requests.ts (CLI)
Command-line tool for interactive cleanup with detailed output.

### 2. cleanup-requests-batch.ts (Library)
Reusable functions for programmatic cleanup - import into your own scripts.

### 3. cleanup-example.ts (Example)
Example showing how to use the batch cleanup functions.

---

## cleanup-requests.ts (CLI Tool)

Deletes FOIA requests by request number (e.g., `FOIA-1759939815839`), including:
- Database records (cascades to documents, notes, packages, support tickets, and messages)
- S3 files in main bucket under `/{requestId}/*`
- S3 files in Hyperscience input bucket under `/json/{requestNumber}*`
- S3 files in Hyperscience output bucket under `/{requestNumber}/*`

### Prerequisites

- Node.js 22.18.0 (managed by Volta)
- Configured AWS credentials (via profile or default credentials)
- Database connection configured in `.env`

### Usage

#### Command Line

```bash
# Delete a single request
yarn tsx prisma/cleanup-requests.ts FOIA-1759939815839

# Delete multiple requests
yarn tsx prisma/cleanup-requests.ts FOIA-1759939815839 FOIA-1759940440260 FOIA-1759936391404

# Dry run (preview what would be deleted)
yarn tsx prisma/cleanup-requests.ts --dry-run FOIA-1759939815839 FOIA-1759940440260

# Show help
yarn tsx prisma/cleanup-requests.ts --help
```

#### Programmatic Usage

You can also import and use the cleanup function in your own scripts:

```typescript
import { cleanupRequests } from './prisma/cleanup-requests-batch'

// Delete requests
const stats = await cleanupRequests(['FOIA-1759939815839', 'FOIA-1759940440260'], { dryRun: false })

console.log(`Deleted ${stats.requestsDeleted} requests`)
console.log(`Deleted ${stats.s3FilesDeleted} S3 files`)
```

### Options

- `--dry-run` - Show what would be deleted without actually deleting anything
- `--help`, `-h` - Show help message

### Examples

```bash
# Test cleanup with dry run first
yarn tsx prisma/cleanup-requests.ts --dry-run FOIA-1759939815839

# If everything looks good, run for real
yarn tsx prisma/cleanup-requests.ts FOIA-1759939815839

# Batch cleanup multiple requests from your data
yarn tsx prisma/cleanup-requests.ts FOIA-1759939815839 FOIA-1759940440260 FOIA-1759936391404 FOIA-1759952646701
```

### Output

The script provides detailed output including:
- Request details (request number, requester name, status)
- Number of associated records (documents, notes, packages, tickets)
- S3 files deleted from each bucket
- Summary statistics at the end

### Safety Features

1. **Dry Run Mode**: Use `--dry-run` to preview deletions without making changes
2. **Detailed Logging**: Shows exactly what will be deleted before deletion
3. **Error Handling**: Continues processing remaining requests if one fails
4. **Transaction Safety**: Database deletes use Prisma's cascade delete

### What Gets Deleted

1. **Database Records**:
   - FOIA Request record
   - Associated Documents (cascade)
   - Associated Notes (cascade, respects soft-delete)
   - Associated Release Packages (cascade)
   - Associated Support Tickets (cascade)
   - Associated Support Ticket Messages (cascade)

2. **S3 Files**:
   - Main bucket: `/{requestId}/*` (includes `/collected/`, `/ready/`, `/redacted/` subfolders)
   - HS Input bucket: `/json/{requestNumber}*` (includes both PDF and JSON sidecar)
   - HS Output bucket: `/{requestNumber}/*` (redacted files from Hyperscience)

### Troubleshooting

**"Request not found" warning**:
- The request number doesn't exist in the database
- Check the request number spelling/format (should be like `FOIA-1759939815839`)

**S3 errors**:
- Check AWS credentials are configured correctly
- Verify bucket permissions allow delete operations
- Check that the buckets exist and are accessible

**Database errors**:
- Verify DATABASE_URL is set correctly in `.env`
- Ensure database is running and accessible
- Check that foreign key constraints are properly configured

### Environment Variables

The script uses the following environment variables from `.env`:

```bash
DATABASE_URL=postgresql://user:pass@localhost:15432/foia
AWS_PROFILE=your-profile  # Optional, uses default if not set
AWS_REGION=us-east-1
AWS_S3_BUCKET=foia-documents
HS_INPUT_BUCKET=foia-dev-public-requests
HS_OUTPUT_BUCKET=foia-dev-redacted
```

### Batch Processing Script

For programmatic batch processing, see `cleanup-requests-batch.ts` which exports reusable functions:

```typescript
import { cleanupRequests, deleteRequestByRequestNumber } from './prisma/cleanup-requests-batch'

// Cleanup multiple requests
const requestNumbers = ['FOIA-1759939815839', 'FOIA-1759940440260', 'FOIA-1759936391404']
const stats = await cleanupRequests(requestNumbers)

// Or cleanup a single request
const requestStats = await deleteRequestByRequestNumber('FOIA-1759939815839', { dryRun: false })
```
