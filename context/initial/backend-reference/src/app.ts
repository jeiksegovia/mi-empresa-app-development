import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { config } from './config/env'
import routes from './routes'
import { notFound } from './middleware/notFound'
import { errorHandler } from './middleware/errorHandler'
import rateLimit from 'express-rate-limit'

export function createServer() {
  const app = express()

  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())
  app.use(cors({ 
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (config.allowedOrigins.length === 0 || config.allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
  }))
  // Configure Helmet to not interfere with CORS
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false 
  }))
  app.use(morgan('dev'))

  // Not required on serverless, but useful on ec2/ecs/vm
  // app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))
  // app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }))

  app.use('/', routes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

const app = createServer()

export default app
