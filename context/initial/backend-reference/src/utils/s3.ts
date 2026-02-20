import { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { fromIni } from '@aws-sdk/credential-providers'
import { config } from '../config/env'
import { Readable } from 'stream'

// S3 bucket name from config
const bucketName = config.aws.s3Bucket

// Configure awsconfig with optional profile
let awsConfig: any = {};
if (config.aws.profile !== '') {
  awsConfig = {
    region: config.aws.region,
    credentials: fromIni({ profile: config.aws.profile }),
    maxAttempts: 3
  }
}
// Configure AWS SDK v3 S3 client with profile
const s3Client = new S3Client(awsConfig)

/**
 * Upload JSON object to S3
 */
export async function putJson(bucket: string, key: string, obj: any): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(obj, null, 2),
    ContentType: 'application/json'
  })
  
  await s3Client.send(command)
}

/**
 * Move object from source to destination (copy then delete)
 */
export async function copyObject(srcBucket: string, srcKey: string, destBucket: string, destKey: string): Promise<void> {
  // Copy object to destination
  const copyCommand = new CopyObjectCommand({
    Bucket: destBucket,
    CopySource: `${srcBucket}/${srcKey}`,
    Key: destKey
  })
  
  await s3Client.send(copyCommand)
}

/**
 * Copy object from source to destination (copy then delete)
 */
export async function moveObject(srcBucket: string, srcKey: string, destBucket: string, destKey: string): Promise<void> {
  // Copy object to destination
  const copyCommand = new CopyObjectCommand({
    Bucket: destBucket,
    CopySource: `${srcBucket}/${srcKey}`,
    Key: destKey
  })

  await s3Client.send(copyCommand)

  // Delete original object
  const deleteCommand = new DeleteObjectCommand({
    Bucket: srcBucket,
    Key: srcKey
  })

  await s3Client.send(deleteCommand)
}

/**
 * Upload stream to S3 with multipart support for large files
 */
export async function uploadStream(
  bucket: string, 
  key: string, 
  readStream: Readable, 
  contentType: string = 'application/octet-stream'
): Promise<void> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: readStream,
      ContentType: contentType
    },
    // Use multipart upload for files larger than 5MB
    partSize: 5 * 1024 * 1024, // 5MB
    queueSize: 4
  })
  
  await upload.done()
}

/**
 * Check if object exists in S3
 */
export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    })
    
    await s3Client.send(command)
    return true
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false
    }
    throw error
  }
}

/**
 * Get object metadata from S3
 */
export async function getObjectMetadata(bucket: string, key: string): Promise<any> {
  const command = new HeadObjectCommand({
    Bucket: bucket,
    Key: key
  })
  
  const response = await s3Client.send(command)
  return {
    contentLength: response.ContentLength,
    contentType: response.ContentType,
    lastModified: response.LastModified,
    etag: response.ETag
  }
}
