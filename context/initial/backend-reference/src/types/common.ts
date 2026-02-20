// Common type primitives used across multiple type files
export type ISODateString = string // e.g., 2024-01-15T12:34:56.000Z
export type YMDDateString = string // e.g., 2024-01-15

// Multer file type for file uploads
export interface MulterFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  destination: string
  filename: string
  path: string
  buffer: Buffer
}

// Common user summary interface used across multiple domains
export interface FOIAUserSummary {
  id: string
  firstName: string
  lastName: string
  username: string
}
