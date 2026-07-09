import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config/env.js'

const s3Client = new S3Client({
  region: config.aws.region,
})

// Presigning is local computation — it succeeds even against a bucket that
// doesn't exist, and the browser PUT then fails with NoSuchBucket. Guarding
// here surfaces a misconfigured AWS_S3_BUCKET at request time with a clear error.
function requireBucket(): string {
  if (!config.aws.s3Bucket) {
    throw new Error('AWS_S3_BUCKET is not configured — set it in backend/.env (see .env.example)')
  }
  return config.aws.s3Bucket
}

export async function generateUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: requireBucket(),
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3Client, command, { expiresIn })
}

export async function generateDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: requireBucket(),
    Key: key,
  })
  return getSignedUrl(s3Client, command, { expiresIn })
}
