import dotenv from 'dotenv'
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  dotenv.config()
}

const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'

/**
 * S1 (cheap code hardening): refuse to boot in production if `JWT_SECRET`
 * is unset. A signed cookie/JWT defaulting to a hard-coded fallback would
 * let an attacker forge tokens. Crash-fast here so the misconfiguration
 * surfaces at startup, not at first /login.
 *
 * Local dev (NODE_ENV !== 'production') keeps a deterministic placeholder
 * so contributors don't have to set one just to boot the API. Tests that
 * need to assert the throw pass NODE_ENV=production explicitly.
 */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim()
  if (fromEnv) return fromEnv
  if (isProduction) {
    throw new Error(
      'JWT_SECRET is required when NODE_ENV=production — refusing to boot with an unset signing key',
    )
  }
  return 'dev-secret-change-me'
}

export const config = {
  port: parseInt(process.env.PORT || '3101', 10),
  nodeEnv,
  isDev: !isProduction,

  database: {
    url: process.env.DATABASE_URL || 'postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev',
  },

  jwt: {
    secret: resolveJwtSecret(),
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
