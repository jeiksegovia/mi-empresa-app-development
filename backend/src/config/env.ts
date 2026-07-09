import dotenv from 'dotenv'
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  dotenv.config()
}

export const config = {
  port: parseInt(process.env.PORT || '3101', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiration: process.env.JWT_EXPIRATION || '24h',
  },

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    // No fallback on purpose: a wrong default silently breaks uploads
    // (presigning succeeds locally even when the bucket doesn't exist).
    s3Bucket: process.env.AWS_S3_BUCKET || '',
    profile: process.env.AWS_PROFILE || '',
  },

  cors: {
    origins: (process.env.CORS_ORIGIN || 'http://localhost:3100,http://localhost:3101,http://localhost:3102').split(',').map(s => s.trim()),
  },

  // Shared secret CloudFront injects as the x-origin-verify header.
  // Empty (local dev, CI) disables the check entirely.
  originVerifySecret: process.env.ORIGIN_VERIFY_SECRET || '',

  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10),
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) * 1024 * 1024,
  },
}
