import { execSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface MigrationResult {
  statusCode: number
  body: string
}

export const handler = async (_event: any): Promise<MigrationResult> => {
  console.log('Starting Prisma migration...')
  console.log(
    'DATABASE_URL (masked):',
    process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, '://***@') ?? 'not set'
  )

  if (!process.env.DATABASE_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'DATABASE_URL environment variable is not set' }),
    }
  }

  try {
    const schemaPath = join(__dirname, '..', 'prisma', 'schema.prisma')

    const output = execSync(
      `npx prisma migrate deploy --schema="${schemaPath}"`,
      {
        env: {
          ...process.env,
          PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: 'true',
        },
        encoding: 'utf8',
        timeout: 240000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )

    console.log('Migration output:', output)
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Migrations applied successfully',
        output: output.trim(),
      }),
    }
  } catch (error: any) {
    const errorMessage = error.stderr || error.message || String(error)
    console.error('Migration failed:', errorMessage)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Migration failed',
        error: errorMessage,
      }),
    }
  }
}
