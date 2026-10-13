import Hapi from '@hapi/hapi'
import { getCphRoute } from './cphs.js'
import { getCph } from '../services/salesforce/cphs.js'

vi.mock('../services/salesforce/cphs.js', () => ({
  getCph: vi.fn(),
}))
vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: vi.fn() }),
}))

const cphDetails = {
  id: 'cph-id',
  cphCode: '01/001/0006',
  cphCodeShort: '010010006',
  startDate: '2020-01-01',
  endDate: null,
  status: 'Active',
  type: 'Permanent',
  previousCphNumber: null,
  temporaryCphNumber: null,
  locationId: 'location-id',
}

describe('#cphs route', () => {
  let server

  beforeEach(async () => {
    server = Hapi.server()
    server.route([getCphRoute])
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop()
    vi.clearAllMocks()
  })

  test('should return 200 with the CPH details', async () => {
    vi.mocked(getCph).mockResolvedValue(cphDetails)

    const response = await server.inject({
      method: 'GET',
      url: '/cphs?cphNumber=01/001/0006',
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(cphDetails)
  })

  test('Should call getCph with the cphNumber query param', async () => {
    vi.mocked(getCph).mockResolvedValue(cphDetails)

    await server.inject({ method: 'GET', url: '/cphs?cphNumber=01/001/0006' })

    expect(getCph).toHaveBeenCalledWith('01/001/0006')
  })

  test('Should return 400 when cphNumber does not match NN/NNN/NNNN format', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/cphs?cphNumber=invalid-cph',
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when cphNumber is missing', async () => {
    const response = await server.inject({ method: 'GET', url: '/cphs' })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 404 when the CPH is not found', async () => {
    vi.mocked(getCph).mockRejectedValue(new Error('CPH not found: 01/001/0006'))

    const response = await server.inject({
      method: 'GET',
      url: '/cphs?cphNumber=01/001/0006',
    })

    expect(response.statusCode).toBe(404)
  })

  test('Should return 502 when getCph throws a non-not-found error', async () => {
    vi.mocked(getCph).mockRejectedValue(new Error('Salesforce API error 500'))

    const response = await server.inject({
      method: 'GET',
      url: '/cphs?cphNumber=01/001/0006',
    })

    expect(response.statusCode).toBe(502)
  })
})
