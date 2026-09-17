import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { timingSafeEqual } from 'crypto'
import { config } from './config/env.js'
import { apiRoutes } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { logger } from './config/logger.js'

const app = express()

const isDev = config.nodeEnv !== 'production'

// Security
app.use(helmet({ contentSecurityPolicy: false }))

// CloudFront origin verification: the instance port is world-reachable (plain
// HTTP origin), so only requests carrying the CloudFront-injected secret pass.
// /api/v1/health stays open — CodeDeploy's validate.sh probes it via localhost.
if (config.originVerifySecret) {
  const expectedSecret = config.originVerifySecret
  const expectedBuf = Buffer.from(expectedSecret, 'utf8')
  app.use((req, res, next) => {
    if (req.path === '/api/v1/health') return next()
    const provided = req.get('x-origin-verify')
    // S5: timingSafeEqual requires equal-length buffers; short-circuit on
    // mismatch to avoid throwing. The compare itself still takes constant
    // time once lengths match, which is what defeats timing oracles.
    if (typeof provided !== 'string') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    const providedBuf = Buffer.from(provided, 'utf8')
    if (
      providedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(providedBuf, expectedBuf)
    ) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  })
}
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl)
    if (!origin) return callback(null, true)
    // In development allow localhost plus LAN / Tailscale so a phone on WiFi
    // can hit the same-origin cookie (same IP, ports 3100 + 3101).
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|100\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)) {
      return callback(null, true)
    }
    if (config.cors.origins.includes(origin)) return callback(null, true)
    callback(null, false)
  },
  credentials: true,
}))

// Parsing
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Logging
app.use(morgan('dev', {
  stream: { write: (message: string) => logger.info(message.trim()) },
}))

// Routes
app.use('/api/v1', apiRoutes)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

export { app }
