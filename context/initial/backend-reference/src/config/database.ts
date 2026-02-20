import { connect } from 'http2'
import { PrismaClient } from '../generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

// Create a function to get the Prisma client with the correct database URL
let prismaInstance: PrismaClient | null = null

export const getPrismaClient = () => {
  if (!prismaInstance) {
    // For tests, use the main database URL directly
    const databaseUrl = process.env.DATABASE_URL
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set')
    }

    const adapter = new PrismaPg({ connectionString: databaseUrl });

    prismaInstance = new PrismaClient({ adapter })

  }
  return prismaInstance
}

// Export a function that gets the client when needed
export const getPrisma = () => getPrismaClient()
