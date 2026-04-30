import Joi from 'joi'
import Boom from '@hapi/boom'
import {
  createCase,
  getCase,
  getCaseByCaseNumber
} from '../services/salesforce/cases.js'
import { submitTestParts } from '../services/salesforce/test-parts.js'
import { addTestPartResults } from '../services/salesforce/test-part-results.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const sicctDayField = Joi.number().integer().min(0).max(999).required()
const divaDayField = Joi.number().integer().min(0).max(999).required()
const nullField = Joi.valid(null).default(null)

const testPartResultSchema = Joi.object({
  testType: Joi.string().valid('DIVA', 'SICCT').required(),
  earTagNo: Joi.string().max(20).required(),
  batchAvian: Joi.string().max(20).allow(null, '').default(null),
  batchBovine: Joi.string().max(20).allow(null, '').default(null),
  batchDiva: Joi.string().max(20).allow(null, '').default(null),
  day1Avian: Joi.when('testType', {
    is: 'SICCT',
    then: sicctDayField,
    otherwise: nullField
  }),
  day1Bovine: Joi.when('testType', {
    is: 'SICCT',
    then: sicctDayField,
    otherwise: nullField
  }),
  day1Diva: Joi.when('testType', {
    is: 'DIVA',
    then: divaDayField,
    otherwise: nullField
  }),
  day2Avian: Joi.when('testType', {
    is: 'SICCT',
    then: sicctDayField,
    otherwise: nullField
  }),
  day2Bovine: Joi.when('testType', {
    is: 'SICCT',
    then: sicctDayField,
    otherwise: nullField
  }),
  day2Diva: Joi.when('testType', {
    is: 'DIVA',
    then: divaDayField,
    otherwise: nullField
  }),
  resultAfterReview: Joi.string().allow(null, '').default(null)
})

const testPartSchema = Joi.object({
  day1: Joi.string().isoDate().required(),
  day2: Joi.string().isoDate().required(),
  certifyingVet: Joi.string().required(),
  tester: Joi.string().required(),
  results: Joi.array().items(testPartResultSchema).min(1).required()
})

export const createCaseRoute = {
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
        testWindowEnd: Joi.string().isoDate().required()
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

export const searchCasesRoute = {
  method: 'GET',
  path: '/cases',
  options: {
    validate: {
      query: Joi.object({
        caseNumber: Joi.string().pattern(/^\d+$/).required()
      })
    }
  },
  handler: async (request, h) => {
    try {
      const result = await getCaseByCaseNumber(request.query.caseNumber)
      return h.response(result)
    } catch (err) {
      if (err.message.startsWith('Case not found:')) {
        throw Boom.notFound(err.message)
      }
      logger.error(err, 'Salesforce search cases request failed')
      throw Boom.badGateway('Failed to search cases in Salesforce')
    }
  }
}

export const getCaseRoute = {
  method: 'GET',
  path: '/cases/{caseId}',
  options: {
    validate: {
      params: Joi.object({
        caseId: Joi.string().alphanum().min(15).max(18).required()
      })
    }
  },
  handler: async (request, h) => {
    try {
      const result = await getCase(request.params.caseId)
      return h.response(result)
    } catch (err) {
      if (err.message.startsWith('Case not found:')) {
        throw Boom.notFound(err.message)
      }
      logger.error(err, 'Salesforce get case request failed')
      throw Boom.badGateway('Failed to retrieve case from Salesforce')
    }
  }
}

export const submitTestPartsRoute = {
  method: 'POST',
  path: '/cases/{id}/test-parts',
  options: {
    validate: {
      options: { abortEarly: false },
      params: Joi.object({
        id: Joi.string().alphanum().min(15).max(18).required()
      }),
      payload: Joi.object({
        testParts: Joi.array().items(testPartSchema).min(1).required()
      })
    }
  },
  handler: async (request, h) => {
    try {
      const result = await submitTestParts(
        request.params.id,
        request.payload.testParts
      )
      return h.response(result).code(201)
    } catch (err) {
      if (err.message.startsWith('Case not found:')) {
        throw Boom.notFound(err.message)
      }
      logger.error(err, 'Salesforce submit test parts request failed')
      throw Boom.badGateway('Failed to submit test parts to Salesforce')
    }
  }
}

export const addTestPartResultsRoute = {
  method: 'POST',
  path: '/cases/{caseId}/test-parts/{testPartId}/results',
  options: {
    validate: {
      options: { abortEarly: false },
      params: Joi.object({
        caseId: Joi.string().alphanum().min(15).max(18).required(),
        testPartId: Joi.string().alphanum().min(15).max(18).required()
      }),
      payload: Joi.object({
        results: Joi.array().items(testPartResultSchema).min(1).required()
      })
    }
  },
  handler: async (request, h) => {
    try {
      const result = await addTestPartResults(
        request.params.testPartId,
        request.payload.results
      )
      return h.response(result).code(201)
    } catch (err) {
      logger.error(err, 'Salesforce add test part results request failed')
      throw Boom.badGateway('Failed to add test part results to Salesforce')
    }
  }
}
