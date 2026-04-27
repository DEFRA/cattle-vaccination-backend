import Hapi from '@hapi/hapi'
import { cases } from './cases.js'
import { createCase } from '../services/salesforce/cases.js'

vi.mock('../services/salesforce/cases.js', () => ({
  createCase: vi.fn()
}))
vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: vi.fn() })
}))

const validPayload = {
  cphNumber: '01/001/0006',
  reasonForTest: 'Pre-Movement',
  testWindowStart: '2026-04-22',
  testWindowEnd: '2026-04-22',
  testParts: [
    {
      day1: '2026-04-16',
      day2: '2026-04-13',
      certifyingVet: 'Vet Identity',
      tester: 'Tester Identity',
      results: [
        {
          testType: 'DIVA',
          earTagNo: 'UK-000001-000010'
        }
      ]
    }
  ]
}

describe('#cases route', () => {
  let server

  beforeEach(async () => {
    server = Hapi.server()
    server.route([cases])
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop()
    vi.clearAllMocks()
  })

  test('Should return 201 with created IDs', async () => {
    const mockResult = {
      caseId: 'case-id',
      testParts: [{ testPartId: 'tp-id', resultIds: ['r-id'] }]
    }
    createCase.mockResolvedValue(mockResult)

    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: validPayload
    })

    expect(response.statusCode).toBe(201)
    expect(response.result).toEqual(mockResult)
  })

  test('Should call createCase with payload', async () => {
    createCase.mockResolvedValue({ caseId: 'case-id', testParts: [] })

    await server.inject({
      method: 'POST',
      url: '/cases',
      payload: validPayload
    })

    expect(createCase).toHaveBeenCalledWith(
      expect.objectContaining({
        cphNumber: '01/001/0006',
        reasonForTest: 'Pre-Movement'
      })
    )
  })

  test('Should return 400 when cphNumber does not match NN/NNN/NNNN format', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: { ...validPayload, cphNumber: 'invalid-cph' }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when cphNumber is missing', async () => {
    const { cphNumber: _, ...payload } = validPayload

    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when testParts is empty', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: { ...validPayload, testParts: [] }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when results is empty', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: {
        ...validPayload,
        testParts: [{ ...validPayload.testParts[0], results: [] }]
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when testWindowStart is not an ISO date', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: { ...validPayload, testWindowStart: 'not-a-date' }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when day1 in testPart is not an ISO date', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: {
        ...validPayload,
        testParts: [{ ...validPayload.testParts[0], day1: 'not-a-date' }]
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when earTagNo is missing from a result', async () => {
    const { earTagNo: _, ...resultWithoutTag } =
      validPayload.testParts[0].results[0]

    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: {
        ...validPayload,
        testParts: [
          { ...validPayload.testParts[0], results: [resultWithoutTag] }
        ]
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when reasonForTest is not a valid value', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: { ...validPayload, reasonForTest: 'NotAValidReason' }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when testType is not a valid value', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: {
        ...validPayload,
        testParts: [
          {
            ...validPayload.testParts[0],
            results: [
              { ...validPayload.testParts[0].results[0], testType: 'INVALID' }
            ]
          }
        ]
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when earTagNo exceeds 20 characters', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: {
        ...validPayload,
        testParts: [
          {
            ...validPayload.testParts[0],
            results: [
              {
                ...validPayload.testParts[0].results[0],
                earTagNo: 'A'.repeat(21)
              }
            ]
          }
        ]
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 400 when a skin measurement is out of range', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: {
        ...validPayload,
        testParts: [
          {
            ...validPayload.testParts[0],
            results: [
              { ...validPayload.testParts[0].results[0], day1Avian: 1000 }
            ]
          }
        ]
      }
    })

    expect(response.statusCode).toBe(400)
  })

  test('Should return 502 when createCase throws', async () => {
    createCase.mockRejectedValue(new Error('Salesforce API error 500'))

    const response = await server.inject({
      method: 'POST',
      url: '/cases',
      payload: validPayload
    })

    expect(response.statusCode).toBe(502)
  })
})
