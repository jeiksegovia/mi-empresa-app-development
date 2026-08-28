import { app } from './app.js'
import { config } from './config/env.js'
import { disconnectPrisma } from './config/database.js'
import { logger } from './config/logger.js'
import { seedCentrosCostos } from './services/empresaService.js'

const server = app.listen(config.port, async () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`)
  // centro-costos-ago-5 R9: idempotent seed of the 11 default centros.
  // Runs at startup; second startup is a no-op (skipDuplicates + unique).
  try {
    const { inserted } = await seedCentrosCostos()
    if (inserted > 0) {
      logger.info(`CentroCostos seed: inserted ${inserted} default centros`)
    } else {
      logger.info('CentroCostos seed: all defaults already present')
    }
  } catch (err) {
    logger.error('CentroCostos seed failed (non-fatal):', err)
  }
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
