import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { config } from './config/env.js'
import { apiRoutes } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { logger } from './config/logger.js'

const app = express()

const isDev = config.nodeEnv !== 'production'

// Security
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl)
    if (!origin) return callback(null, true)
    // In development allow any localhost port
    if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true)
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
