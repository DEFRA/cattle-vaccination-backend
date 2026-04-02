import Joi from 'joi'
import Boom from '@hapi/boom'
import { livestockRequest } from '../services/livestock-api.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

export const cattleOnHolding = {
  method: 'GET',
  path: '/cattle-on-holding',
  options: {
    validate: {
      query: Joi.object({
        holdingId: Joi.string().required()
      })
    }
  },
  handler: async (request, h) => {
    const { holdingId } = request.query

    try {
      const result = await livestockRequest(
        `/cattle-on-holding?holdingId=${encodeURIComponent(holdingId)}`
      )
      return h.response(result)
    } catch (err) {
      logger.error(err, 'Livestock cattle-on-holding request failed')
      throw Boom.badGateway(
        'Failed to retrieve cattle on holding from Livestock API'
      )
    }
  }
}
