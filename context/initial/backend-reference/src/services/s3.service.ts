import { S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand, HeadObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { fromIni } from '@aws-sdk/credential-providers'
import { config } from '../config/env'

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

export interface UploadInitiationResponse {
  uploadUrl: string
  s3Key: string
}

export interface DownloadInitiationResponse {
  downloadUrl: string
  expiresAt: Date
}

export interface MultipartUploadInitiationResponse {
  uploadId: string
  s3Key: string
}

export interface MultipartUploadPartResponse {
  uploadUrl: string
  partNumber: number
}

// Utility function to parse filename and extension
function parseFileName(documentName: string): { baseName: string; extension: string } {
  const lastDotIndex = documentName.lastIndexOf('.')
  return {
    baseName: lastDotIndex > 0 ? documentName.substring(0, lastDotIndex) : documentName,
    extension: lastDotIndex > 0 ? documentName.substring(lastDotIndex + 1) : ''
  }
}

// Utility function to generate unique filename
function generateUniqueFileName(baseName: string, extension: string): string {
  const timestamp = Date.now().toString()
  return extension ? `${baseName}_${timestamp}.${extension}` : `${baseName}_${timestamp}`
}

export async function generateUploadUrl(requestId: string, documentName: string): Promise<UploadInitiationResponse> {
  try {
    // Parse filename and generate unique name
    const { baseName, extension } = parseFileName(documentName)
    const filename = generateUniqueFileName(baseName, extension)
    const key = `${requestId}/collected/${filename}`

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: 'application/octet-stream'
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour
    
    return { uploadUrl, s3Key: key }
  } catch (error) {
    console.error('Error generating pre-signed URL:', error)
    throw new Error('Failed to generate upload URL')
  }
}

export async function generateDownloadUrl(s3Key: string, filename: string, expiresIn: number = 3600): Promise<DownloadInitiationResponse> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ResponseContentDisposition: `attachment; filename="${filename}"`
    })

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn })
    const expiresAt = new Date(Date.now() + expiresIn * 1000)
    
    return { downloadUrl, expiresAt }
  } catch (error) {
    console.error('Error generating pre-signed download URL:', error)
    throw new Error('Failed to generate download URL')
  }
}

export async function getDocumentAsBase64(s3Key: string, client: S3Client = s3Client): Promise<{ base64: string; mimeType: string }> {
  try {
    // First, get the object metadata to determine content type
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    })
    
    const headResult = await client.send(headCommand)
    const mimeType = headResult.ContentType || 'application/octet-stream'
    
    // Get the object content
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    })
    
    const getResult = await client.send(getCommand)
    
    if (!getResult.Body) {
      throw new Error('Document body is empty')
    }
    
    // Convert the readable stream to buffer
    const chunks: Uint8Array[] = []
    const reader = getResult.Body.transformToWebStream().getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    
    // Combine chunks and convert to base64
    const buffer = Buffer.concat(chunks)
    const base64 = buffer.toString('base64')
    
    return { base64, mimeType }
  } catch (error) {
    console.error('Error retrieving document from S3:', error)
    if (error instanceof Error && error.message === 'Document body is empty') {
      throw error
    }
    throw new Error('Failed to retrieve document from S3')
  }
}

export async function handleDocumentWorkflowS3Action(document: any, action: string): Promise<string> {
  try {
    const requestId = document.foiaRequestId
    const currentS3Key = document.filePath
    const filename = document.filename
    let newS3Key: string

    switch (action) {
      case 'move_to_hyperscience_ready':
        // Move from collected to hyperscience/requestId/ready
        newS3Key = `${requestId}/ready/${filename}`
        await moveS3Object(currentS3Key, newS3Key)
        break

      default:
        throw new Error(`Invalid S3 action: ${action}`)
    }

    return newS3Key
  } catch (error) {
    console.error('Error handling S3 workflow action:', error)
    throw error
  }
}

export async function moveS3Object(sourceKey: string, destinationKey: string) {
  try {
    // Copy object to new location
    const copyCommand = new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: encodeURIComponent(`${bucketName}/${sourceKey}`),
      Key: destinationKey
    })

    await s3Client.send(copyCommand)

    // Delete original object
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: sourceKey
    })

    await s3Client.send(deleteCommand)

    console.log(`Successfully moved S3 object from ${sourceKey} to ${destinationKey}`)
  } catch (error) {
    console.error('Error moving S3 object:', error)
    throw error
  }
}

export async function copyS3Object(sourceKey: string, destinationKey: string) {
  try {
    // Copy object to new location without deleting original
    const copyCommand = new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: encodeURIComponent(`${bucketName}/${sourceKey}`),
      Key: destinationKey
    })

    await s3Client.send(copyCommand)

    console.log(`Successfully copied S3 object from ${sourceKey} to ${destinationKey}`)
  } catch (error) {
    console.error('Error copying S3 object:', error)
    throw error
  }
}

export async function copyS3ObjectToBucket(sourceKey: string, destinationBucket: string, destinationKey: string) {
  try {
    // Copy object to different bucket
    const copyCommand = new CopyObjectCommand({
      Bucket: destinationBucket,
      CopySource: encodeURIComponent(`${bucketName}/${sourceKey}`),
      Key: destinationKey
    })

    await s3Client.send(copyCommand)

    console.log(`Successfully copied S3 object from ${bucketName}/${sourceKey} to ${destinationBucket}/${destinationKey}`)
  } catch (error) {
    console.error('Error copying S3 object to different bucket:', error)
    throw error
  }
}

export async function uploadJsonToS3(bucket: string, key: string, data: any) {
  try {
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json'
    })

    await s3Client.send(putCommand)

    console.log(`Successfully uploaded JSON to S3: ${bucket}/${key}`)
  } catch (error) {
    console.error('Error uploading JSON to S3:', error)
    throw error
  }
}

export async function uploadBufferToS3(bucket: string, key: string, buffer: Buffer, contentType: string = 'application/octet-stream') {
  try {
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })

    await s3Client.send(putCommand)

    console.log(`Successfully uploaded buffer to S3: ${bucket}/${key}`)
  } catch (error) {
    console.error('Error uploading buffer to S3:', error)
    throw error
  }
}

export async function deleteS3Object(s3Key: string) {
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    })

    await s3Client.send(deleteCommand)

    console.log(`Successfully deleted S3 object: ${s3Key}`)
  } catch (error) {
    console.error('Error deleting S3 object:', error)
    throw error
  }
}

// Multipart Upload Functions
export async function initiateMultipartUpload(requestId: string, documentName: string): Promise<MultipartUploadInitiationResponse> {
  try {
    // Parse filename and generate unique name
    const { baseName, extension } = parseFileName(documentName)
    const filename = generateUniqueFileName(baseName, extension)
    const key = `${requestId}/collected/${filename}`

    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: 'application/octet-stream'
    })

    const response = await s3Client.send(command)
    
    if (!response.UploadId) {
      throw new Error('Failed to create multipart upload')
    }
    
    return { uploadId: response.UploadId, s3Key: key }
  } catch (error) {
    console.error('Error initiating multipart upload:', error)
    throw new Error('Failed to initiate multipart upload')
  }
}

export async function generateMultipartUploadPartUrl(
  s3Key: string, 
  uploadId: string, 
  partNumber: number
): Promise<MultipartUploadPartResponse> {
  try {
    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: s3Key,
      UploadId: uploadId,
      PartNumber: partNumber
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour
    
    return { uploadUrl, partNumber }
  } catch (error) {
    console.error('Error generating multipart upload part URL:', error)
    throw new Error('Failed to generate multipart upload part URL')
  }
}

export async function completeMultipartUpload(
  s3Key: string, 
  uploadId: string, 
  parts: { ETag: string; PartNumber: number }[]
): Promise<void> {
  try {
    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: s3Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
      }
    })

    await s3Client.send(command)
    console.log(`Successfully completed multipart upload for: ${s3Key}`)
  } catch (error) {
    console.error('Error completing multipart upload:', error)
    throw new Error('Failed to complete multipart upload')
  }
}

export async function abortMultipartUpload(s3Key: string, uploadId: string): Promise<void> {
  try {
    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: s3Key,
      UploadId: uploadId
    })

    await s3Client.send(command)
    console.log(`Successfully aborted multipart upload for: ${s3Key}`)
  } catch (error) {
    console.error('Error aborting multipart upload:', error)
    throw new Error('Failed to abort multipart upload')
  }
}