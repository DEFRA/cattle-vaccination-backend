import Hapi from '@hapi/hapi'
import { workorders } from './workorders.js'
import { aphaRequest } from '../services/apha-api.js'

vi.mock('../services/apha-api.js', () => ({
  aphaRequest: vi.fn()
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
    aphaRequest.mockResolvedValue(mockResult)

    const response = await server.inject({
      method: 'GET',
      url: '/workorders?startDate=2026-01-01&endDate=2026-03-27&country=England'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(mockResult)
  })

  test('Should call APHA API with correctly formatted URI', async () => {
    aphaRequest.mockResolvedValue({ data: [] })

    await server.inject({
      method: 'GET',
      url: '/workorders?startDate=2026-01-01&endDate=2026-03-27&country=England'
    })

    expect(aphaRequest).toHaveBeenCalledWith(
      '/workorders?startActivationDate=2026-01-01T00:00:00.000Z&endActivationDate=2026-03-27T00:00:00.000Z&country=England'
    )
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
    aphaRequest.mockRejectedValue(
      new Error('APHA API error 500: Internal Server Error')
    )

    const response = await server.inject({
      method: 'GET',
      url: '/workorders?startDate=2026-01-01&endDate=2026-03-27&country=England'
    })

    expect(response.statusCode).toBe(502)
  })
})
