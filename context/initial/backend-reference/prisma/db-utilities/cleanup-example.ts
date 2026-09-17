#!/usr/bin/env tsx
/**
 * Example: Batch Cleanup of FOIA Requests
 * 
 * This example shows how to use the cleanup functions programmatically.
 * Edit the requestNumbers array below with the requests you want to delete.
 */

import { cleanupRequests, getTotalStats } from './cleanup-requests-batch'
import { getPrisma } from '../../src/config/database'

const prisma = getPrisma()

async function main() {
  // ⚠️  EDIT THIS ARRAY with the request numbers you want to delete
  const requestNumbers = [
    'FOIA-1759939815839',
    'FOIA-1759940440260',
    'FOIA-1759936391404'
    // Add more request numbers here...
  ]

  // Set to true to preview without deleting
  const dryRun = true

  console.log('🧹 Batch Cleanup Example')
  console.log('='.repeat(60))
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '⚠️  LIVE DELETE'}`)
  console.log(`Request Numbers: ${requestNumbers.length}`)
  console.log('='.repeat(60))

  if (!dryRun) {
    console.log('\n⚠️  WARNING: This will permanently delete data!')
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  // Execute cleanup
  const results = await cleanupRequests(requestNumbers, {
    dryRun,
    verbose: true
  })

  // Print detailed results
  console.log('\n' + '='.repeat(60))
  console.log('📊 Detailed Results')
  console.log('='.repeat(60))

  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.requestNumber}`)
      console.log(`   - Requests: ${result.stats.requestsDeleted}`)
      console.log(`   - Documents: ${result.stats.documentsDeleted}`)
      console.log(`   - Notes: ${result.stats.notesDeleted}`)
      console.log(`   - Packages: ${result.stats.packagesDeleted}`)
      console.log(`   - Tickets: ${result.stats.ticketsDeleted}`)
      console.log(`   - S3 Files: ${result.stats.s3FilesDeleted}`)
    } else {
      console.log(`❌ ${result.requestNumber}`)
      console.log(`   Error: ${result.error?.message}`)
    }
  }

  // Print totals
  const totals = getTotalStats(results)
  console.log('\n' + '='.repeat(60))
  console.log('📈 Grand Total')
  console.log('='.repeat(60))
  console.log(`Total Requests:          ${totals.requestsDeleted}`)
  console.log(`Total Documents:         ${totals.documentsDeleted}`)
  console.log(`Total Notes:             ${totals.notesDeleted}`)
  console.log(`Total Packages:          ${totals.packagesDeleted}`)
  console.log(`Total Support Tickets:   ${totals.ticketsDeleted}`)
  console.log(`Total S3 Files:          ${totals.s3FilesDeleted}`)
  
  if (totals.s3Errors > 0) {
    console.log(`⚠️  S3 Errors:              ${totals.s3Errors}`)
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length
  
  console.log(`\nSuccess Rate: ${successCount}/${results.length} (${Math.round(successCount / results.length * 100)}%)`)
  
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No data was actually deleted')
    console.log('   Set dryRun = false in the script to perform actual deletion')
  } else {
    console.log('\n✅ Cleanup completed!')
  }
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
