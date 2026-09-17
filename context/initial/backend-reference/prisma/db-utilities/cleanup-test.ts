#!/usr/bin/env tsx
/**
 * Quick Test Script for Cleanup Utilities
 * 
 * Run this to verify the cleanup scripts are working correctly.
 * This uses DRY RUN mode by default - no data will be deleted.
 */

import { cleanupRequests } from './cleanup-requests-batch'
import { getPrisma } from '../../src/config/database'

const prisma = getPrisma()

async function test() {
  console.log('🧪 Testing Cleanup Utilities\n')

  // Find an actual request number from the database to test with
  const sampleRequest = await prisma.fOIARequest.findFirst({
    select: {
      requestNumber: true,
      requesterName: true
    }
  })

  if (!sampleRequest?.requestNumber) {
    console.log('⚠️  No requests found in database to test with')
    console.log('   Run "yarn db:seed" first to create sample data')
    return
  }

  console.log('Found sample request:')
  console.log(`  Request Number: ${sampleRequest.requestNumber}`)
  console.log(`  Requester: ${sampleRequest.requesterName}`)
  console.log('\nTesting cleanup in DRY RUN mode...\n')

  // Test with a single request
  const results = await cleanupRequests([sampleRequest.requestNumber], {
    dryRun: true,
    verbose: true
  })

  if (results[0].success) {
    console.log('\n✅ Test PASSED - Cleanup utilities are working correctly')
    console.log('\nTo perform actual cleanup:')
    console.log(`  yarn tsx prisma/cleanup-requests.ts ${sampleRequest.requestNumber}`)
  } else {
    console.log('\n❌ Test FAILED')
    console.error('Error:', results[0].error)
  }
}

test()
  .catch((error) => {
    console.error('❌ Test error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
