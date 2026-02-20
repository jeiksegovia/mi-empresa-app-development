import { config } from './config/env'
import { logger } from './config/logger'
import app from './app'

const server = app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`)
})

process.on('SIGINT', () => {
  logger.info('Shutting down server...')
  server.close(() => process.exit(0))
})
