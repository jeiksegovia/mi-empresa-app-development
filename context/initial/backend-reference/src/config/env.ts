import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

type Config = {
  port: number
  env: string
  databaseUrl: string
  jwt: {
    secret: string
    expiresIn: string
  }
  uploadsDir: string
  maxFileSizeMB: number
  allowedOrigins: string[]
  aws: {
    profile: string
    region: string
    s3Bucket: string
    hsInputBucket: string
    hsOutputBucket: string
  }
  services: {
    hsToken: string
    hsApiKey: string
    hsClientId: string
    hsClientSecret: string
    hsBaseUrl: string
    hsDefaultFlow: string
    hsApiTimeoutMs: number
    redactionMaxFileMB: number
    servicesApiKey: string
    servicesAllowedIps: string[]
  }
}



export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  uploadsDir: process.env.FILE_UPLOAD_DIR || 'public/uploads',
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '20', 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  aws: {
    profile: process.env.AWS_PROFILE || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'foia-documents',
    hsInputBucket: process.env.HS_INPUT_BUCKET || 'foia-dev-public-requests',
    hsOutputBucket: process.env.HS_OUTPUT_BUCKET || 'foia-dev-redacted'
  },
  services: {
    hsToken: process.env.HS_TOKEN || '',
    hsApiKey: process.env.HS_API_KEY || '',
    hsClientId: process.env.HS_CLIENT_ID || '',
    hsClientSecret: process.env.HS_CLIENT_SECRET || '',
    hsBaseUrl: process.env.HS_HOST || process.env.HS_BASE_URL || 'https://api.hyperscience.com',
    hsDefaultFlow: process.env.HS_FLOW_DEFAULT || 'ACME_FOIA_DEMO_FLOW',
    hsApiTimeoutMs: parseInt(process.env.HS_API_TIMEOUT_MS || '60000', 10),
    redactionMaxFileMB: parseInt(process.env.REDACTION_MAX_FILE_MB || '200', 10),
    servicesApiKey: process.env.SERVICES_API_KEY || '',
    servicesAllowedIps: (process.env.SERVICES_ALLOWED_IPS || '').split(',').filter(Boolean)
  }
}

if (!config.databaseUrl) {
  // eslint-disable-next-line no-console
  console.warn('DATABASE_URL is not set')
}
