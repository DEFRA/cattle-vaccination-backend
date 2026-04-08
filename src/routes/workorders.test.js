import Hapi from '@hapi/hapi'
import { workorders } from './workorders.js'
import { getWorkorders } from '../services/apha-api.js'

vi.mock('../services/apha-api.js', () => ({
  getWorkorders: vi.fn()
}))
vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: vi.fn() })
}))

describe('#workorders route', () => {
  let server

  beforeEach(async () => {
    server = Hapi.server()
    server.route([workorders])
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop()
  })

  test('Should return workorders from APHA API', async () => {
    const mockResult = { data: [{ id: 'WO-001' }] }
    getWorkorders.mockResolvedValue(mockResult)

    const response = await server.inject({
      method: 'GET',
      url: '/workorders?startDate=2026-01-01&endDate=2026-03-27&country=England'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(mockResult)
  })

  test('Should call APHA API with correctly formatted URI', async () => {
    getWorkorders.mockResolvedValue({ data: [] })

    await server.inject({
      method: 'GET',
      url: '/workorders?startDate=2026-01-01&endDate=2026-03-27&country=England'
    })

    expect(getWorkorders).toHaveBeenCalledWith({
      startDate: '2026-01-01',
      endDate: '2026-03-27',
      country: 'England'
    })
  })

  test('Should return 400 when startDate is missing', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/workorders?endDate=2026-03-27&country=England'
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when endDate is missing', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/workorders?startDate=2026-01-01&country=England'
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when country is missing', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/workorders?startDate=2026-01-01&endDate=2026-03-27'
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when startDate is not ISO date format', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/workorders?startDate=not-a-date&endDate=2026-03-27&country=England'
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 502 when APHA API throws', async () => {
    getWorkorders.mockRejectedValue(
      new Error('APHA API error 500: Internal Server Error')
    )

    const response = await server.inject({
      method: 'GET',
      url: '/workorders?startDate=2026-01-01&endDate=2026-03-27&country=England'
    })

    expect(response.statusCode).toBe(502)
  })
})
