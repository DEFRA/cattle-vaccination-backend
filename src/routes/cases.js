import Joi from 'joi'
import Boom from '@hapi/boom'
import { createCase } from '../services/salesforce/cases.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const testPartResultSchema = Joi.object({
  testType: Joi.string().valid('DIVA', 'SICCT').required(),
  earTagNo: Joi.string().max(20).required(),
  batchAvian: Joi.string().max(20).allow(null, '').default(null),
  batchBovine: Joi.string().max(20).allow(null, '').default(null),
  batchDiva: Joi.string().max(20).allow(null, '').default(null),
  day1Avian: Joi.number().integer().min(0).max(999).allow(null).default(null),
  day1Bovine: Joi.number().integer().min(0).max(999).allow(null).default(null),
  day1Diva: Joi.number().integer().min(0).max(999).allow(null).default(null),
  day2Avian: Joi.number().integer().min(0).max(999).allow(null).default(null),
  day2Bovine: Joi.number().integer().min(0).max(999).allow(null).default(null),
  day2Diva: Joi.number().integer().min(0).max(999).allow(null).default(null),
  resultAfterReview: Joi.string().allow(null, '').default(null)
})

const testPartSchema = Joi.object({
  day1: Joi.string().isoDate().required(),
  day2: Joi.string().isoDate().required(),
  certifyingVet: Joi.string().required(),
  tester: Joi.string().required(),
  results: Joi.array().items(testPartResultSchema).min(1).required()
})

export const cases = {
  method: 'POST',
  path: '/cases',
  options: {
    validate: {
      options: { abortEarly: false },
      payload: Joi.object({
        cphNumber: Joi.string()
          .pattern(/^\d{2}\/\d{3}\/\d{4}$/)
          .required(),
        reasonForTest: Joi.string()
          .valid(
            'Radial',
            '6W',
            '6M',
            '12M',
            '48M',
            'Pre-Movement',
            'Post-Movement'
          )
          .required(),
        testWindowStart: Joi.string().isoDate().required(),
        testWindowEnd: Joi.string().isoDate().required(),
        testParts: Joi.array().items(testPartSchema).min(1).required()
      })
    }
  },
  handler: async (request, h) => {
    try {
      const result = await createCase(request.payload)
      return h.response(result).code(201)
    } catch (err) {
      logger.error(err, 'Salesforce create case request failed')
      throw Boom.badGateway('Failed to create case in Salesforce')
    }
  }
}
