import { Request, Response, NextFunction } from 'express'
import { authenticateAgencyUser, invalidateSession, publicUser } from '../../services/auth.service'
import { agencyLoginSchema } from '../../utils/validation'

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate request body for agency login (username/password)
    const parse = agencyLoginSchema.safeParse(req.body)
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid request data', details: parse.error.issues })
    }

    const { username, password } = parse.data

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown'
    const userAgent = req.get('User-Agent') || 'unknown'

    const result = await authenticateAgencyUser(username, password, ipAddress, userAgent)

    // Save session cookie for authentication
    res.cookie('session', result.sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    })

    return res.json({ 
      user: await publicUser(result.user)
    })
  } catch (error) {
    next(error)
  }
}

// Agency authentication doesn't use OAuth callback

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionCookie = req.cookies.session
    if (sessionCookie) {
      await invalidateSession(sessionCookie)
    }

    // Clear session cookie
    res.clearCookie('session')
    
    return res.json({ message: 'Logged out successfully' })
  } catch (error) {
    next(error)
  }
}

export async function validateSession(req: Request, res: Response, next: NextFunction) {
  try {
    // Agency-specific session validation
    // This could include additional checks for agency permissions
    const sessionCookie = req.cookies.session
    if (!sessionCookie) {
      return res.status(401).json({ error: 'No session found' })
    }

    // Additional agency-specific validation logic could go here
    return res.json({ message: 'Session is valid' })
  } catch (error) {
    next(error)
  }
}
