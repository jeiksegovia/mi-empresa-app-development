import { app } from './app.js'
import { config } from './config/env.js'
import { disconnectPrisma } from './config/database.js'
import { logger } from './config/logger.js'

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`)
})

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...')
  await disconnectPrisma()
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...')
  await disconnectPrisma()
  server.close(() => process.exit(0))
})
