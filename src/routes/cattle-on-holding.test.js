import Hapi from '@hapi/hapi'
import { cattleOnHolding } from './cattle-on-holding.js'
import { getCattleOnHolding } from '../services/livestock-api.js'

vi.mock('../services/livestock-api.js', () => ({
  getCattleOnHolding: vi.fn()
}))
vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: vi.fn() })
}))

describe('#cattleOnHolding route', () => {
  let server

  beforeEach(async () => {
    server = Hapi.server()
    server.route([cattleOnHolding])
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop()
    vi.clearAllMocks()
  })

  test('Should return 200 with cattle data', async () => {
    const mockResult = { data: [{ id: 'ABC123' }] }
    getCattleOnHolding.mockResolvedValue(mockResult)

    const response = await server.inject({
      method: 'GET',
      url: '/cattle-on-holding?holdingId=12345'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(mockResult)
  })

  test('Should call getCattleOnHolding with holdingId from query', async () => {
    getCattleOnHolding.mockResolvedValue({})

    await server.inject({
      method: 'GET',
      url: '/cattle-on-holding?holdingId=12345'
    })

    expect(getCattleOnHolding).toHaveBeenCalledWith({ holdingId: '12345' })
  })

  test('Should return 400 when holdingId is missing', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/cattle-on-holding'
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 502 when getCattleOnHolding throws', async () => {
    getCattleOnHolding.mockRejectedValue(new Error('Livestock API error 503'))

    const response = await server.inject({
      method: 'GET',
      url: '/cattle-on-holding?holdingId=12345'
    })

    expect(response.statusCode).toBe(502)
  })
})
