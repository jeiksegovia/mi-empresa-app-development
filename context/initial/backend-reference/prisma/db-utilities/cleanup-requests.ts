#!/usr/bin/env tsx
/**
 * Cleanup Script for FOIA Requests
 * 
 * Deletes FOIA requests by request number including:
 * - Database records (cascades to documents, notes, packages, support tickets)
 * - S3 folders and files under /{requestId}/*
 * 
 * Usage:
 *   yarn tsx prisma/cleanup-requests.ts FOIA-001 FOIA-002 FOIA-003
 *   yarn tsx prisma/cleanup-requests.ts --dry-run FOIA-001 FOIA-002
 * 
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { fromIni } from '@aws-sdk/credential-providers'
import { getPrisma } from '../../src/config/database'
import { config } from '../../src/config/env'

const prisma = getPrisma()

// Configure S3 client
let awsConfig: any = {
  region: config.aws.region,
  maxAttempts: 3
}

if (config.aws.profile !== '') {
  awsConfig.credentials = fromIni({ profile: config.aws.profile })
}

const s3Client = new S3Client(awsConfig)
const bucketName = config.aws.s3Bucket
const hsInputBucket = config.aws.hsInputBucket
const hsOutputBucket = config.aws.hsOutputBucket

interface CleanupStats {
  requestsDeleted: number
  documentsDeleted: number
  notesDeleted: number
  packagesDeleted: number
  ticketsDeleted: number
  s3FilesDeleted: number
  s3Errors: number
}

/**
 * Delete all objects in an S3 folder (prefix)
 */
async function deleteS3Folder(bucket: string, prefix: string, dryRun: boolean = false): Promise<{ deleted: number; errors: number }> {
  let deleted = 0
  let errors = 0
  let continuationToken: string | undefined

  try {
    do {
      // List objects with the prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken
      })

      const listResponse = await s3Client.send(listCommand)

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        break
      }

      if (dryRun) {
        console.log(`  [DRY RUN] Would delete ${listResponse.Contents.length} objects from s3://${bucket}/${prefix}`)
        deleted += listResponse.Contents.length
      } else {
        // Delete objects in batches of 1000 (S3 limit)
        const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key! }))

        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objectsToDelete,
            Quiet: true
          }
        })

        const deleteResponse = await s3Client.send(deleteCommand)
        deleted += objectsToDelete.length - (deleteResponse.Errors?.length || 0)
        errors += deleteResponse.Errors?.length || 0

        if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
          console.error(`  ⚠️  ${deleteResponse.Errors.length} errors deleting objects from s3://${bucket}/${prefix}`)
          deleteResponse.Errors.forEach(err => {
            console.error(`     - ${err.Key}: ${err.Message}`)
          })
        }
      }

      continuationToken = listResponse.NextContinuationToken
    } while (continuationToken)

    return { deleted, errors }
  } catch (error) {
    console.error(`  ❌ Error deleting S3 folder s3://${bucket}/${prefix}:`, error)
    return { deleted, errors: 1 }
  }
}

/**
 * Delete FOIA request and all associated data
 */
async function deleteRequest(requestNumber: string, dryRun: boolean = false): Promise<CleanupStats> {
  const stats: CleanupStats = {
    requestsDeleted: 0,
    documentsDeleted: 0,
    notesDeleted: 0,
    packagesDeleted: 0,
    ticketsDeleted: 0,
    s3FilesDeleted: 0,
    s3Errors: 0
  }

  try {
    // Find the request by request number
    const request = await prisma.fOIARequest.findFirst({
      where: { requestNumber },
      include: {
        documents: true,
        notes: true,
        packages: true,
        supportTickets: {
          include: {
            messages: true
          }
        }
      }
    })

    if (!request) {
      console.log(`⚠️  Request not found: ${requestNumber}`)
      return stats
    }

    console.log(`\n📋 Request: ${request.requestNumber}`)
    console.log(`   Requester: ${request.requesterName}`)
    console.log(`   Status: ${request.status}`)
    console.log(`   Documents: ${request.documents.length}`)
    console.log(`   Notes: ${request.notes.length}`)
    console.log(`   Packages: ${request.packages.length}`)
    console.log(`   Support Tickets: ${request.supportTickets.length}`)

    // Count associated records
    stats.documentsDeleted = request.documents.length
    stats.notesDeleted = request.notes.length
    stats.packagesDeleted = request.packages.length
    stats.ticketsDeleted = request.supportTickets.length

    // Delete S3 files for main bucket (requestId folder)
    console.log(`\n🗑️  Deleting S3 files for request ID: ${request.id}`)
    const mainBucketResult = await deleteS3Folder(bucketName, `${request.id}/`, dryRun)
    stats.s3FilesDeleted += mainBucketResult.deleted
    stats.s3Errors += mainBucketResult.errors

    // Delete S3 files from Hyperscience input bucket (if any)
    console.log(`🗑️  Deleting S3 files from HS input bucket: ${hsInputBucket}`)
    const hsInputResult = await deleteS3Folder(hsInputBucket, `json/${request.requestNumber}`, dryRun)
    stats.s3FilesDeleted += hsInputResult.deleted
    stats.s3Errors += hsInputResult.errors

    // Delete S3 files from Hyperscience output bucket (if any)
    console.log(`🗑️  Deleting S3 files from HS output bucket: ${hsOutputBucket}`)
    const hsOutputResult = await deleteS3Folder(hsOutputBucket, `${request.requestNumber}/`, dryRun)
    stats.s3FilesDeleted += hsOutputResult.deleted
    stats.s3Errors += hsOutputResult.errors

    // Delete from database (cascades to documents, notes, packages, support tickets)
    if (dryRun) {
      console.log(`\n  [DRY RUN] Would delete request from database: ${request.requestNumber}`)
      stats.requestsDeleted = 1
    } else {
      await prisma.fOIARequest.delete({
        where: { id: request.id }
      })
      stats.requestsDeleted = 1
      console.log(`✅ Deleted request from database: ${request.requestNumber}`)
    }

  } catch (error) {
    console.error(`❌ Error deleting request ${requestNumber}:`, error)
    throw error
  }

  return stats
}

/**
 * Main cleanup function
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  yarn tsx prisma/cleanup-requests.ts [OPTIONS] REQUEST_NUMBER [REQUEST_NUMBER...]

Options:
  --dry-run    Show what would be deleted without actually deleting
  --help, -h   Show this help message

Examples:
  yarn tsx prisma/cleanup-requests.ts FOIA-001
  yarn tsx prisma/cleanup-requests.ts --dry-run FOIA-001 FOIA-002 FOIA-003
  yarn tsx prisma/cleanup-requests.ts FOIA-1759939815839 FOIA-1759940440260

Environment:
  AWS_PROFILE: ${config.aws.profile || '(default)'}
  AWS_REGION: ${config.aws.region}
  S3_BUCKET: ${bucketName}
  HS_INPUT_BUCKET: ${hsInputBucket}
  HS_OUTPUT_BUCKET: ${hsOutputBucket}
`)
    process.exit(0)
  }

  const dryRun = args.includes('--dry-run')
  const requestNumbers = args.filter(arg => !arg.startsWith('--'))

  if (requestNumbers.length === 0) {
    console.error('❌ No request numbers provided')
    process.exit(1)
  }

  console.log('🧹 FOIA Request Cleanup Script')
  console.log('=' .repeat(50))
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be deleted\n')
  } else {
    console.log('⚠️  WARNING: This will permanently delete data!\n')
  }

  console.log(`Request Numbers: ${requestNumbers.join(', ')}`)
  console.log(`AWS Profile: ${config.aws.profile || '(default)'}`)
  console.log(`S3 Bucket: ${bucketName}`)
  console.log(`HS Input Bucket: ${hsInputBucket}`)
  console.log(`HS Output Bucket: ${hsOutputBucket}`)

  const totalStats: CleanupStats = {
    requestsDeleted: 0,
    documentsDeleted: 0,
    notesDeleted: 0,
    packagesDeleted: 0,
    ticketsDeleted: 0,
    s3FilesDeleted: 0,
    s3Errors: 0
  }

  // Process each request number
  for (const requestNumber of requestNumbers) {
    try {
      const stats = await deleteRequest(requestNumber, dryRun)
      totalStats.requestsDeleted += stats.requestsDeleted
      totalStats.documentsDeleted += stats.documentsDeleted
      totalStats.notesDeleted += stats.notesDeleted
      totalStats.packagesDeleted += stats.packagesDeleted
      totalStats.ticketsDeleted += stats.ticketsDeleted
      totalStats.s3FilesDeleted += stats.s3FilesDeleted
      totalStats.s3Errors += stats.s3Errors
    } catch (error) {
      console.error(`Failed to delete request ${requestNumber}`)
      // Continue with next request
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Cleanup Summary')
  console.log('='.repeat(50))
  console.log(`Requests deleted:        ${totalStats.requestsDeleted}`)
  console.log(`Documents deleted:       ${totalStats.documentsDeleted}`)
  console.log(`Notes deleted:           ${totalStats.notesDeleted}`)
  console.log(`Packages deleted:        ${totalStats.packagesDeleted}`)
  console.log(`Support tickets deleted: ${totalStats.ticketsDeleted}`)
  console.log(`S3 files deleted:        ${totalStats.s3FilesDeleted}`)
  
  if (totalStats.s3Errors > 0) {
    console.log(`⚠️  S3 errors:              ${totalStats.s3Errors}`)
  }

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No data was actually deleted')
    console.log('   Run without --dry-run to perform the deletion')
  } else {
    console.log('\n✅ Cleanup completed')
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
