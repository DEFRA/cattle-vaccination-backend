import Joi from 'joi'
import Boom from '@hapi/boom'
import {
  createWorkList,
  getWorkList,
  getWorkOrder,
  getWorkOrders,
} from '../services/salesforce/work-orders.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { getErrorMessage } from '../common/helpers/error-message.js'

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

/** @type {import('@hapi/hapi').ServerRoute} */
export const getWorkOrderRoute = {
  method: 'GET',
  path: '/workorders/{workOrderId}',
  options: {
    validate: {
      params: Joi.object({
        workOrderId: Joi.string().trim().min(1).max(80).required(),
      }),
    },
  },
  handler: async (request, h) => {
    try {
      const result = await getWorkOrder(request.params.workOrderId)
      return h.response(result)
    } catch (err) {
      const message = getErrorMessage(err)

      if (message.startsWith('Work order not found:')) {
        throw Boom.notFound(message)
      }

      logger.error(err, 'Salesforce get work order request failed')
      throw Boom.badGateway('Failed to retrieve work order from Salesforce')
    }
  },
}

/** @type {import('@hapi/hapi').ServerRoute} */
export const createWorkListRoute = {
  method: 'POST',
  path: '/workorders/{workOrderId}/work-lists',
  options: {
    validate: {
      params: Joi.object({
        workOrderId: Joi.string().trim().min(1).max(80).required(),
      }),
    },
  },
  handler: async (request, h) => {
    try {
      const result = await createWorkList(request.params.workOrderId)
      return h.response(result).code(201)
    } catch (err) {
      const message = getErrorMessage(err)

      if (message.startsWith('Work order not found:')) {
        throw Boom.notFound(message)
      }

      logger.error(err, 'Salesforce create work list request failed')
      throw Boom.badGateway('Failed to create work list in Salesforce')
    }
  },
}

/** @type {import('@hapi/hapi').ServerRoute} */
export const getWorkListRoute = {
  method: 'GET',
  path: '/workorders/{workOrderId}/work-lists/{workListId}',
  options: {
    validate: {
      params: Joi.object({
        workOrderId: Joi.string().trim().min(1).max(80).required(),
        workListId: Joi.string().trim().min(1).max(80).required(),
      }),
    },
  },
  handler: async (request, h) => {
    const { workOrderId, workListId } = request.params

    try {
      const result = await getWorkList(workOrderId, workListId)
      return h.response(result)
    } catch (err) {
      const message = getErrorMessage(err)

      if (message.startsWith('Work list not found:')) {
        throw Boom.notFound(message)
      }

      logger.error(err, 'Salesforce get work list request failed')
      throw Boom.badGateway('Failed to retrieve work list from Salesforce')
    }
  },
}
