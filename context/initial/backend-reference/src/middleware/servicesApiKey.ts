import { Request, Response, NextFunction } from 'express'
import { config } from '../config/env'

export interface ServicesRequest extends Request {
  servicesApiKey?: string
}

export function servicesApiKey(req: ServicesRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string
  
  if (!apiKey) {
    console.warn('Services API key missing from request headers')
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  if (apiKey !== config.services.servicesApiKey) {
    // Log only last 4 chars of API key for security
    const maskedApiKey = apiKey.slice(-4).padStart(apiKey.length, '*')
    console.warn('Invalid services API key provided, ending in:', maskedApiKey)
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  // Optional IP restriction check
  if (config.services.servicesAllowedIps.length > 0) {
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress
    if (!clientIp || !config.services.servicesAllowedIps.includes(clientIp)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }
  }
  
  req.servicesApiKey = apiKey
  next()
}
