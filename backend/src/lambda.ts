import serverless from 'serverless-http'
import { app } from './app.js'
import { logger } from './config/logger.js'

let invocationCount = 0

const serverlessHandler = serverless(app, {
  request: (request: any, _event: any, context: any) => {
    request.lambdaContext = context
  },
})

export const apiHandler = async (event: any, context: any) => {
  invocationCount++
  context.callbackWaitsForEmptyEventLoop = false

  if (invocationCount === 1) {
    logger.info('Lambda cold start detected', {
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      memoryLimitInMB: context.memoryLimitInMB,
    })
  }

  return serverlessHandler(event, context)
}
