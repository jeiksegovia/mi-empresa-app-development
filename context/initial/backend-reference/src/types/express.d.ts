import { UserRole } from '../generated/prisma'

declare global {
  namespace Express {
    interface UserTokenPayload {
      id: string
      idmeId: string
      email: string
      permissions: string[]
      sessionId: string
      name: string
      firstName?: string
      lastName?: string
      username?: string
      isInternal: boolean
      isActive: boolean
      role?: string
    }
    interface Request {
      user?: UserTokenPayload
    }
  }
}

export {}
