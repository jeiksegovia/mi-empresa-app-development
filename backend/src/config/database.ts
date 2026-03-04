import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/index.js'

const { Pool } = pg

let prisma: PrismaClient | null = null

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
