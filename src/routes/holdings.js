import Joi from 'joi'
import Boom from '@hapi/boom'
import { aphaRequest } from '../services/apha-api.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

export const holdings = {
  method: 'POST',
  path: '/holdings',
  options: {
    validate: {
      payload: Joi.object({
        ids: Joi.array().items(Joi.string()).min(1).required()
      })
    }
  },
  handler: async (request, h) => {
    try {
      const result = await aphaRequest('/holdings/find', 'POST', {
        ids: request.payload.ids
      })
      return h.response(result)
    } catch (err) {
      logger.error(err, 'APHA holdings request failed')
      throw Boom.badGateway('Failed to retrieve holdings from APHA API')
    }
  }
}
