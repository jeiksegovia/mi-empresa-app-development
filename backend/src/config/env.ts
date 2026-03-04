import dotenv from 'dotenv'
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  dotenv.config()
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
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
    s3Bucket: process.env.AWS_S3_BUCKET || 'mi-empresa-uploads',
    profile: process.env.AWS_PROFILE || '',
  },

  cors: {
    origins: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001,http://localhost:3002').split(',').map(s => s.trim()),
  },

  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10),
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) * 1024 * 1024,
  },
}
