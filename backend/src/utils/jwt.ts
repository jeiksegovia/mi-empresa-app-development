import jwt, { type SignOptions } from 'jsonwebtoken'
import { config } from '../config/env.js'
import { UserTokenPayload } from '../types/common.js'

export function signJwt(payload: UserTokenPayload): string {
  const options: SignOptions = {
    expiresIn: config.jwt.expiration as unknown as SignOptions['expiresIn'],
  }
  return jwt.sign(payload as object, config.jwt.secret, options)
}

export function verifyJwt(token: string): UserTokenPayload {
  return jwt.verify(token, config.jwt.secret) as UserTokenPayload
}
