import Hapi from '@hapi/hapi'
import { holdings } from './holdings.js'
import { aphaRequest } from '../services/apha-api.js'

vi.mock('../services/apha-api.js', () => ({
  aphaRequest: vi.fn()
}))
vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: vi.fn() })
}))

describe('#holdings route', () => {
  let server

  beforeEach(async () => {
    server = Hapi.server()
    server.route([holdings])
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop()
  })

  test('Should return holdings from APHA API', async () => {
    const mockResult = { holdings: [{ id: '12/345/6789', name: 'Test Farm' }] }
    aphaRequest.mockResolvedValue(mockResult)

    const response = await server.inject({
      method: 'POST',
      url: '/holdings',
      payload: { ids: ['12/345/6789'] }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(mockResult)
  })

  test('Should call APHA API with correct path and payload', async () => {
    aphaRequest.mockResolvedValue({})

    await server.inject({
      method: 'POST',
      url: '/holdings',
      payload: { ids: ['12/345/6789', '98/765/4321'] }
    })

    expect(aphaRequest).toHaveBeenCalledWith('/holdings/find', 'POST', {
      ids: ['12/345/6789', '98/765/4321']
    })
  })

  test('Should return 400 when ids is missing', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/holdings',
      payload: {}
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when ids is empty array', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/holdings',
      payload: { ids: [] }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 502 when APHA API throws', async () => {
    aphaRequest.mockRejectedValue(
      new Error('APHA API error 503: Service Unavailable')
    )

    const response = await server.inject({
      method: 'POST',
      url: '/holdings',
      payload: { ids: ['12/345/6789'] }
    })

    expect(response.statusCode).toBe(502)
  })
})
