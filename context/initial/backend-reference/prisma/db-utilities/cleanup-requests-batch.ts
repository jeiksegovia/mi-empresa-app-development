/**
 * Batch Cleanup Functions for FOIA Requests
 * 
 * Exportable functions for programmatic cleanup of FOIA requests.
 * Can be imported and used in other scripts or applications.
 * 
 * @example
 * ```typescript
 * import { cleanupRequests, deleteRequestByRequestNumber } from './prisma/cleanup-requests-batch'
 * 
 * // Cleanup multiple requests
 * const stats = await cleanupRequests(['FOIA-001', 'FOIA-002'])
 * 
 * // Cleanup single request
 * const result = await deleteRequestByRequestNumber('FOIA-001', { dryRun: false })
 * ```
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { fromIni } from '@aws-sdk/credential-providers'
import { getPrisma } from '../../src/config/database'
import { config } from '../../src/config/env'

export interface CleanupOptions {
  dryRun?: boolean
  verbose?: boolean
}

export interface CleanupStats {
  requestsDeleted: number
  documentsDeleted: number
  notesDeleted: number
  packagesDeleted: number
  ticketsDeleted: number
  s3FilesDeleted: number
  s3Errors: number
}

export interface RequestCleanupResult {
  requestNumber: string
  success: boolean
  stats: CleanupStats
  error?: Error
}

/**
 * Get configured S3 client
 */
function getS3Client(): S3Client {
  let awsConfig: any = {
    region: config.aws.region,
    maxAttempts: 3
  }

  if (config.aws.profile !== '') {
    awsConfig.credentials = fromIni({ profile: config.aws.profile })
  }

  return new S3Client(awsConfig)
}

/**
 * Delete all objects in an S3 folder (prefix)
 */
async function deleteS3Folder(
  s3Client: S3Client,
  bucket: string,
  prefix: string,
  options: CleanupOptions = {}
): Promise<{ deleted: number; errors: number }> {
  const { dryRun = false, verbose = false } = options
  let deleted = 0
  let errors = 0
  let continuationToken: string | undefined

  try {
    do {
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
        if (verbose) {
          console.log(`  [DRY RUN] Would delete ${listResponse.Contents.length} objects from s3://${bucket}/${prefix}`)
        }
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

        if (verbose && deleteResponse.Errors && deleteResponse.Errors.length > 0) {
          console.error(`  ⚠️  ${deleteResponse.Errors.length} errors deleting objects from s3://${bucket}/${prefix}`)
        }
      }

      continuationToken = listResponse.NextContinuationToken
    } while (continuationToken)

    return { deleted, errors }
  } catch (error) {
    if (verbose) {
      console.error(`  ❌ Error deleting S3 folder s3://${bucket}/${prefix}:`, error)
    }
    return { deleted, errors: 1 }
  }
}

/**
 * Delete a single FOIA request by request number
 * 
 * @param requestNumber - The request number of the request to delete (e.g., FOIA-001)
 * @param options - Cleanup options
 * @returns Cleanup statistics
 */
export async function deleteRequestByRequestNumber(
  requestNumber: string,
  options: CleanupOptions = {}
): Promise<CleanupStats> {
  const { dryRun = false, verbose = false } = options
  const prisma = getPrisma()
  const s3Client = getS3Client()

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
      if (verbose) {
        console.log(`⚠️  Request not found: ${requestNumber}`)
      }
      return stats
    }

    if (verbose) {
      console.log(`\n📋 Request: ${request.requestNumber}`)
      console.log(`   Requester: ${request.requesterName}`)
      console.log(`   Status: ${request.status}`)
      console.log(`   Documents: ${request.documents.length}`)
      console.log(`   Notes: ${request.notes.length}`)
      console.log(`   Packages: ${request.packages.length}`)
      console.log(`   Support Tickets: ${request.supportTickets.length}`)
    }

    // Count associated records
    stats.documentsDeleted = request.documents.length
    stats.notesDeleted = request.notes.length
    stats.packagesDeleted = request.packages.length
    stats.ticketsDeleted = request.supportTickets.length

    // Delete S3 files from main bucket
    const mainBucketResult = await deleteS3Folder(
      s3Client,
      config.aws.s3Bucket,
      `${request.id}/`,
      options
    )
    stats.s3FilesDeleted += mainBucketResult.deleted
    stats.s3Errors += mainBucketResult.errors

    // Delete S3 files from Hyperscience input bucket
    const hsInputResult = await deleteS3Folder(
      s3Client,
      config.aws.hsInputBucket,
      `json/${request.requestNumber}`,
      options
    )
    stats.s3FilesDeleted += hsInputResult.deleted
    stats.s3Errors += hsInputResult.errors

    // Delete S3 files from Hyperscience output bucket
    const hsOutputResult = await deleteS3Folder(
      s3Client,
      config.aws.hsOutputBucket,
      `${request.requestNumber}/`,
      options
    )
    stats.s3FilesDeleted += hsOutputResult.deleted
    stats.s3Errors += hsOutputResult.errors

    // Delete from database (cascades to all related records)
    if (dryRun) {
      if (verbose) {
        console.log(`\n  [DRY RUN] Would delete request from database: ${request.requestNumber}`)
      }
      stats.requestsDeleted = 1
    } else {
      await prisma.fOIARequest.delete({
        where: { id: request.id }
      })
      stats.requestsDeleted = 1
      
      if (verbose) {
        console.log(`✅ Deleted request from database: ${request.requestNumber}`)
      }
    }

  } catch (error) {
    if (verbose) {
      console.error(`❌ Error deleting request ${requestNumber}:`, error)
    }
    throw error
  }

  return stats
}

/**
 * Delete multiple FOIA requests by request numbers
 * 
 * @param requestNumbers - Array of request numbers to delete (e.g., ['FOIA-001', 'FOIA-002'])
 * @param options - Cleanup options
 * @returns Array of cleanup results for each request
 */
export async function cleanupRequests(
  requestNumbers: string[],
  options: CleanupOptions = {}
): Promise<RequestCleanupResult[]> {
  const { verbose = false } = options
  const results: RequestCleanupResult[] = []

  if (verbose) {
    console.log('🧹 FOIA Request Cleanup')
    console.log('='.repeat(50))
    console.log(`Request Numbers: ${requestNumbers.join(', ')}`)
    console.log(`AWS Profile: ${config.aws.profile || '(default)'}`)
    console.log(`S3 Bucket: ${config.aws.s3Bucket}`)
    console.log(`HS Input Bucket: ${config.aws.hsInputBucket}`)
    console.log(`HS Output Bucket: ${config.aws.hsOutputBucket}`)
  }

  for (const requestNumber of requestNumbers) {
    try {
      const stats = await deleteRequestByRequestNumber(requestNumber, options)
      results.push({
        requestNumber,
        success: true,
        stats
      })
    } catch (error) {
      results.push({
        requestNumber,
        success: false,
        stats: {
          requestsDeleted: 0,
          documentsDeleted: 0,
          notesDeleted: 0,
          packagesDeleted: 0,
          ticketsDeleted: 0,
          s3FilesDeleted: 0,
          s3Errors: 0
        },
        error: error as Error
      })
      
      if (verbose) {
        console.error(`Failed to delete request ${requestNumber}:`, error)
      }
    }
  }

  // Calculate totals
  const totals = results.reduce(
    (acc, result) => ({
      requestsDeleted: acc.requestsDeleted + result.stats.requestsDeleted,
      documentsDeleted: acc.documentsDeleted + result.stats.documentsDeleted,
      notesDeleted: acc.notesDeleted + result.stats.notesDeleted,
      packagesDeleted: acc.packagesDeleted + result.stats.packagesDeleted,
      ticketsDeleted: acc.ticketsDeleted + result.stats.ticketsDeleted,
      s3FilesDeleted: acc.s3FilesDeleted + result.stats.s3FilesDeleted,
      s3Errors: acc.s3Errors + result.stats.s3Errors
    }),
    {
      requestsDeleted: 0,
      documentsDeleted: 0,
      notesDeleted: 0,
      packagesDeleted: 0,
      ticketsDeleted: 0,
      s3FilesDeleted: 0,
      s3Errors: 0
    }
  )

  if (verbose) {
    console.log('\n' + '='.repeat(50))
    console.log('📊 Cleanup Summary')
    console.log('='.repeat(50))
    console.log(`Requests deleted:        ${totals.requestsDeleted}`)
    console.log(`Documents deleted:       ${totals.documentsDeleted}`)
    console.log(`Notes deleted:           ${totals.notesDeleted}`)
    console.log(`Packages deleted:        ${totals.packagesDeleted}`)
    console.log(`Support tickets deleted: ${totals.ticketsDeleted}`)
    console.log(`S3 files deleted:        ${totals.s3FilesDeleted}`)
    
    if (totals.s3Errors > 0) {
      console.log(`⚠️  S3 errors:              ${totals.s3Errors}`)
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length
    console.log(`\n✅ Success: ${successCount} / ${results.length}`)
    if (failureCount > 0) {
      console.log(`❌ Failed: ${failureCount} / ${results.length}`)
    }

    if (options.dryRun) {
      console.log('\n⚠️  DRY RUN - No data was actually deleted')
    }
  }

  return results
}

/**
 * Get total cleanup statistics from results
 */
export function getTotalStats(results: RequestCleanupResult[]): CleanupStats {
  return results.reduce(
    (acc, result) => ({
      requestsDeleted: acc.requestsDeleted + result.stats.requestsDeleted,
      documentsDeleted: acc.documentsDeleted + result.stats.documentsDeleted,
      notesDeleted: acc.notesDeleted + result.stats.notesDeleted,
      packagesDeleted: acc.packagesDeleted + result.stats.packagesDeleted,
      ticketsDeleted: acc.ticketsDeleted + result.stats.ticketsDeleted,
      s3FilesDeleted: acc.s3FilesDeleted + result.stats.s3FilesDeleted,
      s3Errors: acc.s3Errors + result.stats.s3Errors
    }),
    {
      requestsDeleted: 0,
      documentsDeleted: 0,
      notesDeleted: 0,
      packagesDeleted: 0,
      ticketsDeleted: 0,
      s3FilesDeleted: 0,
      s3Errors: 0
    }
  )
}

// Backward compatibility alias
export const deleteRequestByTrackingNumber = deleteRequestByRequestNumber
