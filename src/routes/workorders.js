import Boom from '@hapi/boom'
import { getWorkOrders } from '../services/salesforce/work-orders.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

/** @type {import('@hapi/hapi').ServerRoute} */
export const workorders = {
  method: 'GET',
  path: '/workorders',
  handler: async (_request, h) => {
    try {
      const result = await getWorkOrders()
      return h.response(result)
    } catch (err) {
      logger.error(err, 'Salesforce get work orders request failed')
      throw Boom.badGateway('Failed to retrieve work orders from Salesforce')
    }
  },
}
