import Hapi from '@hapi/hapi'
import { workorders } from './workorders.js'
import { getWorkOrders } from '../services/salesforce/work-orders.js'

vi.mock('../services/salesforce/work-orders.js', () => ({
  getWorkOrders: vi.fn(),
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
    server.route([workorders])
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
})
