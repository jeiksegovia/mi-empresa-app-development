import jwt from 'jsonwebtoken'
import { config } from '../config/env'

export interface JwtPayloadCustom {
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

export function signJwt(payload: JwtPayloadCustom) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as any })
}

export function verifyJwt(token: string): JwtPayloadCustom | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayloadCustom
  } catch {
    return null
  }
}
