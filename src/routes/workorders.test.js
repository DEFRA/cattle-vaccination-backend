import Hapi from '@hapi/hapi'
import { createWorkListRoute, getWorkOrderRoute, workorders } from './workorders.js'
import { createWorkList, getWorkOrder, getWorkOrders } from '../services/salesforce/work-orders.js'

vi.mock('../services/salesforce/work-orders.js', () => ({
  getWorkOrders: vi.fn(),
  getWorkOrder: vi.fn(),
  createWorkList: vi.fn(),
}))
vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: vi.fn() }),
}))

const workOrderCards = [
  {
    id: 'CV WorkOrder 2',
    title: 'Hill Farm - 40/715/9200',
    cphName: 'Hill Farm',
    cphCode: '40/715/9200',
    cphNumber: '407159200',
    address: '1 Farm Lane, Exeter, Devon, EX1 1AA, United Kingdom',
  },
]

describe('#workorders route', () => {
  let server

  beforeEach(async () => {
    server = Hapi.server()
    server.route([workorders, getWorkOrderRoute, createWorkListRoute])
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop()
    vi.clearAllMocks()
  })

  test('Should return 200 with the work order cards', async () => {
    vi.mocked(getWorkOrders).mockResolvedValue(workOrderCards)

    const response = await server.inject({
      method: 'GET',
      url: '/workorders',
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(workOrderCards)
  })

  test('Should return 502 when Salesforce fails', async () => {
    vi.mocked(getWorkOrders).mockRejectedValue(new Error('Salesforce API error 500'))

    const response = await server.inject({
      method: 'GET',
      url: '/workorders',
    })

    expect(response.statusCode).toBe(502)
  })

  test('Should return 200 with the work order details', async () => {
    const workOrder = {
      id: 'CV WorkOrder 2',
      cph: {
        id: '407159200',
        displayName: '40/715/9200',
        cphCode: '40/715/9200',
        locationName: 'Hill Farm',
        address: '1 Farm Lane, Exeter, Devon, EX1 1AA, United Kingdom',
      },
      workLists: [{ id: 'CV WorkList 2' }],
    }
    vi.mocked(getWorkOrder).mockResolvedValue(workOrder)

    const response = await server.inject({
      method: 'GET',
      url: '/workorders/CV%20WorkOrder%202',
    })

    expect(response.statusCode).toBe(200)
    expect(getWorkOrder).toHaveBeenCalledWith('CV WorkOrder 2')
    expect(response.result).toEqual(workOrder)
  })

  test('Should return 404 when the work order does not exist', async () => {
    vi.mocked(getWorkOrder).mockRejectedValue(new Error('Work order not found: CV WorkOrder 99'))

    const response = await server.inject({
      method: 'GET',
      url: '/workorders/CV%20WorkOrder%2099',
    })

    expect(response.statusCode).toBe(404)
  })

  test('Should return 502 when the work order request fails', async () => {
    vi.mocked(getWorkOrder).mockRejectedValue(new Error('Salesforce API error 500'))

    const response = await server.inject({
      method: 'GET',
      url: '/workorders/CV%20WorkOrder%202',
    })

    expect(response.statusCode).toBe(502)
  })

  test('Should return 201 when a work list is created', async () => {
    const workList = { id: 'CV WorkList 3' }
    vi.mocked(createWorkList).mockResolvedValue(workList)

    const response = await server.inject({
      method: 'POST',
      url: '/workorders/CV%20WorkOrder%202/work-lists',
    })

    expect(response.statusCode).toBe(201)
    expect(createWorkList).toHaveBeenCalledWith('CV WorkOrder 2')
    expect(response.result).toEqual(workList)
  })

  test('Should return 404 when creating a work list for a missing work order', async () => {
    vi.mocked(createWorkList).mockRejectedValue(new Error('Work order not found: CV WorkOrder 99'))

    const response = await server.inject({
      method: 'POST',
      url: '/workorders/CV%20WorkOrder%2099/work-lists',
    })

    expect(response.statusCode).toBe(404)
  })

  test('Should return 502 when creating a work list fails', async () => {
    vi.mocked(createWorkList).mockRejectedValue(new Error('CPH is missing from WorkOrder'))

    const response = await server.inject({
      method: 'POST',
      url: '/workorders/CV%20WorkOrder%202/work-lists',
    })

    expect(response.statusCode).toBe(502)
  })
})
