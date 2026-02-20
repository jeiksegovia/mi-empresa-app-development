import { UserTokenPayload } from './common.js'

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload
    }
  }
}

export {}
