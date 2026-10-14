import Joi from 'joi'
import Boom from '@hapi/boom'
import { getCph } from '../services/salesforce/cphs.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { getErrorMessage } from '../common/helpers/error-message.js'

const logger = createLogger()

/** @type {import('@hapi/hapi').ServerRoute} */
export const getCphRoute = {
  method: 'GET',
  path: '/cphs/{cphNumber}',
  options: {
    validate: {
      params: Joi.object({
        cphNumber: Joi.string()
          .pattern(/^\d{9}$/)
          .required(),
      }),
    },
  },
  handler: async (request, h) => {
    try {
      const result = await getCph(request.params.cphNumber)
      return h.response(result)
    } catch (err) {
      const message = getErrorMessage(err)
      if (message.startsWith('CPH not found:')) {
        throw Boom.notFound(message)
      }
      logger.error(err, 'Salesforce get CPH request failed')
      throw Boom.badGateway('Failed to retrieve CPH from Salesforce')
    }
  },
}
