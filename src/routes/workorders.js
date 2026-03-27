import Joi from 'joi'
import Boom from '@hapi/boom'
import { aphaRequest } from '../services/apha-api.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const workorders = {
  method: 'GET',
  path: '/workorders',
  options: {
    validate: {
      query: Joi.object({
        startDate: Joi.string().pattern(DATE_PATTERN).required(),
        endDate: Joi.string().pattern(DATE_PATTERN).required(),
        country: Joi.string().required()
      })
    }
  },
  handler: async (request, h) => {
    const { startDate, endDate, country } = request.query
    const uri = `/workorders?startActivationDate=${startDate}T00:00:00.000Z&endActivationDate=${endDate}T00:00:00.000Z&country=${encodeURIComponent(country)}`

    try {
      const result = await aphaRequest(uri)
      return h.response(result)
    } catch (err) {
      logger.error(err, 'APHA workorders request failed')
      throw Boom.badGateway('Failed to retrieve workorders from APHA API')
    }
  }
}
