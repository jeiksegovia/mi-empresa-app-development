import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/index.js'

const { Pool } = pg

let prisma: PrismaClient | null = null
// Test seam: lets unit tests inject a stub Prisma client (see
// `tests/uploads/_prisma-stub.ts` for the stub shape and the
// `__setPrismaForTest` setter). Production code never sets this.
let _testPrisma: PrismaClient | null = null

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME
  const pool = new Pool({
    connectionString,
    max: isLambda ? 1 : 10,
    idleTimeoutMillis: isLambda ? 10000 : 30000,
    connectionTimeoutMillis: 5000,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })
}

export function getPrisma(): PrismaClient {
  if (_testPrisma) return _testPrisma
  if (!prisma) {
    prisma = createPrismaClient()
  }
  return prisma
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}

/** @internal — test seam. Pass `undefined` to restore default behavior. */
export function __setPrismaForTest(stub: PrismaClient | null | undefined): void {
  _testPrisma = stub ?? null
}
