// Upload-related constants
export const UPLOAD_CONSTANTS = {
  // File size limits
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  MAX_FILE_SIZE_MB: 100,
  
  // Pre-signed URL expiration
  PRESIGNED_URL_EXPIRES_IN: 3600, // 1 hour in seconds
  
  // S3 folder structure
  COLLECTED_FOLDER: 'collected',
  RELEASED_FOLDER: 'released',
  
  // Content types
  DEFAULT_CONTENT_TYPE: 'application/octet-stream',
  
  // Error messages
  ERRORS: {
    FILE_TOO_LARGE: 'File size exceeds maximum limit of 100MB',
    MISSING_FIELDS: 'Missing required fields',
    INVALID_URL: 'Invalid upload URL format',
    FILE_NOT_FOUND: 'File not found in S3',
    UPLOAD_FAILED: 'Failed to generate upload URL',
    VERIFICATION_FAILED: 'Failed to verify file existence',
    NO_PERMISSION: 'You do not have permission to upload documents for this request',
    DOCUMENT_NAME_REQUIRED: 'Document name is required'
  }
} as const
