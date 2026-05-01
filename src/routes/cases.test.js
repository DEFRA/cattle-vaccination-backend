import Hapi from '@hapi/hapi'
import {
  addTestPartResultsRoute,
  createCaseRoute,
  getCaseRoute,
  searchCasesRoute,
  submitTestPartsRoute
} from './cases.js'
import {
  createCase,
  getCase,
  getCaseByCaseNumber
} from '../services/salesforce/cases.js'
import { submitTestParts } from '../services/salesforce/test-parts.js'
import { addTestPartResults } from '../services/salesforce/test-part-results.js'

vi.mock('../services/salesforce/cases.js', () => ({
  createCase: vi.fn(),
  getCase: vi.fn(),
  getCaseByCaseNumber: vi.fn()
}))
vi.mock('../services/salesforce/test-parts.js', () => ({
  submitTestParts: vi.fn()
}))
vi.mock('../services/salesforce/test-part-results.js', () => ({
  addTestPartResults: vi.fn()
}))
vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: vi.fn() })
}))

const validCreatePayload = {
  cphNumber: '01/001/0006',
  reasonForTest: 'Pre-Movement',
  testWindowStart: '2026-04-22',
  testWindowEnd: '2026-04-22'
}

const validDivaResult = {
  testType: 'DIVA',
  earTagNo: 'UK-000001-000010',
  day1Diva: 5,
  day2Diva: 8
}

const validSicctResult = {
  testType: 'SICCT',
  earTagNo: 'UK-000001-000010',
  day1Bovine: 3,
  day1Avian: 5,
  day2Bovine: 4,
  day2Avian: 6
}

const validTestPartsPayload = {
  testParts: [
    {
      day1: '2026-04-16',
      day2: '2026-04-19',
      certifyingVet: 'Vet Identity',
      tester: 'Tester Identity',
      results: [validDivaResult]
    }
  ]
}

describe('#cases route', () => {
  let server

  beforeEach(async () => {
    server = Hapi.server()
    server.route([
      createCaseRoute,
      searchCasesRoute,
      getCaseRoute,
      submitTestPartsRoute,
      addTestPartResultsRoute
    ])
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop()
    vi.clearAllMocks()
  })

  describe('POST /cases', () => {
    test('Should return 201 with created IDs', async () => {
      const mockResult = { caseId: 'case-id' }
      createCase.mockResolvedValue(mockResult)

      const response = await server.inject({
        method: 'POST',
        url: '/cases',
        payload: validCreatePayload
      })

      expect(response.statusCode).toBe(201)
      expect(response.result).toEqual(mockResult)
    })

    test('Should call createCase with payload', async () => {
      createCase.mockResolvedValue({ caseId: 'case-id' })

      await server.inject({
        method: 'POST',
        url: '/cases',
        payload: validCreatePayload
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
        payload: { ...validCreatePayload, cphNumber: 'invalid-cph' }
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when cphNumber is missing', async () => {
      const { cphNumber: _, ...payload } = validCreatePayload

      const response = await server.inject({
        method: 'POST',
        url: '/cases',
        payload
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when testWindowStart is not an ISO date', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases',
        payload: { ...validCreatePayload, testWindowStart: 'not-a-date' }
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when reasonForTest is not a valid value', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases',
        payload: { ...validCreatePayload, reasonForTest: 'NotAValidReason' }
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 502 when createCase throws', async () => {
      createCase.mockRejectedValue(new Error('Salesforce API error 500'))

      const response = await server.inject({
        method: 'POST',
        url: '/cases',
        payload: validCreatePayload
      })

      expect(response.statusCode).toBe(502)
    })
  })

  describe('GET /cases', () => {
    const mockSearchResult = { id: 'a00000000000001', caseNumber: '00001234' }

    test('Should return 200 with id and caseNumber', async () => {
      getCaseByCaseNumber.mockResolvedValue(mockSearchResult)

      const response = await server.inject({
        method: 'GET',
        url: '/cases?caseNumber=00001234'
      })

      expect(response.statusCode).toBe(200)
      expect(response.result).toEqual(mockSearchResult)
    })

    test('Should call getCaseByCaseNumber with the caseNumber query param', async () => {
      getCaseByCaseNumber.mockResolvedValue(mockSearchResult)

      await server.inject({ method: 'GET', url: '/cases?caseNumber=00001235' })

      expect(getCaseByCaseNumber).toHaveBeenCalledWith('00001235')
    })

    test('Should return 400 when caseNumber contains non-numeric characters', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/cases?caseNumber=not-a-number'
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when caseNumber is missing', async () => {
      const response = await server.inject({ method: 'GET', url: '/cases' })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 404 when case is not found', async () => {
      getCaseByCaseNumber.mockRejectedValue(
        new Error('Case not found: 99999999')
      )

      const response = await server.inject({
        method: 'GET',
        url: '/cases?caseNumber=99999999'
      })

      expect(response.statusCode).toBe(404)
    })

    test('Should return 502 when getCaseByCaseNumber throws a non-not-found error', async () => {
      getCaseByCaseNumber.mockRejectedValue(
        new Error('Salesforce API error 500')
      )

      const response = await server.inject({
        method: 'GET',
        url: '/cases?caseNumber=00001234'
      })

      expect(response.statusCode).toBe(502)
    })
  })

  describe('GET /cases/{caseId}', () => {
    const mockCase = {
      id: 'a00000000000001',
      caseNumber: '00001234',
      status: 'New',
      priority: 'Medium',
      reasonForTest: 'Pre-Movement',
      testWindowStart: '2026-04-22',
      testWindowEnd: '2026-04-22',
      cph: '01/001/0006',
      openedDate: '2026-04-22T10:00:00.000Z',
      openedBy: 'John Smith',
      testParts: []
    }

    test('Should return 200 with case details', async () => {
      getCase.mockResolvedValue(mockCase)

      const response = await server.inject({
        method: 'GET',
        url: '/cases/a00000000000001'
      })

      expect(response.statusCode).toBe(200)
      expect(response.result).toEqual(mockCase)
    })

    test('Should call getCase with the caseId param', async () => {
      getCase.mockResolvedValue(mockCase)

      await server.inject({ method: 'GET', url: '/cases/a00000000000002' })

      expect(getCase).toHaveBeenCalledWith('a00000000000002')
    })

    test('Should return 400 when caseId is not a valid Salesforce ID format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/cases/not-a-valid-id'
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 404 when case is not found', async () => {
      getCase.mockRejectedValue(new Error('Case not found: a00000000000001'))

      const response = await server.inject({
        method: 'GET',
        url: '/cases/a00000000000001'
      })

      expect(response.statusCode).toBe(404)
    })

    test('Should return 502 when getCase throws a non-not-found error', async () => {
      getCase.mockRejectedValue(new Error('Salesforce API error 500'))

      const response = await server.inject({
        method: 'GET',
        url: '/cases/a00000000000001'
      })

      expect(response.statusCode).toBe(502)
    })
  })

  describe('POST /cases/{id}/test-parts', () => {
    function testPartsPayloadWith(result) {
      return {
        testParts: [
          { ...validTestPartsPayload.testParts[0], results: [result] }
        ]
      }
    }

    test('Should return 201 with created test part IDs', async () => {
      const mockResult = {
        testParts: [{ testPartId: 'tp-id', resultIds: ['r-id'] }]
      }
      submitTestParts.mockResolvedValue(mockResult)

      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: validTestPartsPayload
      })

      expect(response.statusCode).toBe(201)
      expect(response.result).toEqual(mockResult)
    })

    test('Should call submitTestParts with caseId and testParts', async () => {
      submitTestParts.mockResolvedValue({ testParts: [] })

      await server.inject({
        method: 'POST',
        url: '/cases/a00000000000004/test-parts',
        payload: validTestPartsPayload
      })

      expect(submitTestParts).toHaveBeenCalledWith(
        'a00000000000004',
        expect.arrayContaining([
          expect.objectContaining({
            certifyingVet: 'Vet Identity',
            tester: 'Tester Identity'
          })
        ])
      )
    })

    test('Should return 400 when id is not a valid Salesforce ID format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases/not-a-valid-id/test-parts',
        payload: validTestPartsPayload
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when testParts is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when testParts is empty', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: { testParts: [] }
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when a testPart result has an invalid testType', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: testPartsPayloadWith({
          testType: 'INVALID',
          earTagNo: 'UK-000001-000010'
        })
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when earTagNo is missing from a result', async () => {
      const { earTagNo: _, ...resultWithoutTag } = validDivaResult

      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: testPartsPayloadWith(resultWithoutTag)
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should accept a valid SICCT result with bovine and avian day fields', async () => {
      submitTestParts.mockResolvedValue({ testParts: [] })

      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: testPartsPayloadWith(validSicctResult)
      })

      expect(response.statusCode).toBe(201)
    })

    test('Should return 400 when SICCT result is missing day1Bovine', async () => {
      const { day1Bovine: _, ...result } = validSicctResult

      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: testPartsPayloadWith(result)
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when SICCT result is missing day1Avian', async () => {
      const { day1Avian: _, ...result } = validSicctResult

      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: testPartsPayloadWith(result)
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when DIVA result is missing day1Diva', async () => {
      const { day1Diva: _, ...result } = validDivaResult

      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: testPartsPayloadWith(result)
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when DIVA result provides bovine day fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: testPartsPayloadWith({ ...validDivaResult, day1Bovine: 3 })
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when SICCT result provides diva day fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: testPartsPayloadWith({ ...validSicctResult, day1Diva: 5 })
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 404 when case is not found', async () => {
      submitTestParts.mockRejectedValue(
        new Error('Case not found: a00000000000001')
      )

      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: validTestPartsPayload
      })

      expect(response.statusCode).toBe(404)
    })

    test('Should return 502 when submitTestParts throws', async () => {
      submitTestParts.mockRejectedValue(new Error('Salesforce API error 500'))

      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts',
        payload: validTestPartsPayload
      })

      expect(response.statusCode).toBe(502)
    })
  })

  describe('POST /cases/{caseId}/test-parts/{testPartId}/results', () => {
    const validResultsPayload = { results: [validDivaResult] }
    const resultsUrl =
      '/cases/a00000000000001/test-parts/b00000000000001/results'

    function resultsPayloadWith(result) {
      return { results: [result] }
    }

    test('Should return 201 with created result IDs', async () => {
      const mockResult = { resultIds: ['result-id-1'] }
      addTestPartResults.mockResolvedValue(mockResult)

      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: validResultsPayload
      })

      expect(response.statusCode).toBe(201)
      expect(response.result).toEqual(mockResult)
    })

    test('Should call addTestPartResults with testPartId and results', async () => {
      addTestPartResults.mockResolvedValue({ resultIds: ['result-id-1'] })

      await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts/b00000000000002/results',
        payload: validResultsPayload
      })

      expect(addTestPartResults).toHaveBeenCalledWith(
        'b00000000000002',
        expect.arrayContaining([
          expect.objectContaining({
            testType: 'DIVA',
            earTagNo: 'UK-000001-000010'
          })
        ])
      )
    })

    test('Should return 400 when caseId is not a valid Salesforce ID format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases/not-valid/test-parts/b00000000000001/results',
        payload: validResultsPayload
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when testPartId is not a valid Salesforce ID format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cases/a00000000000001/test-parts/not-valid/results',
        payload: validResultsPayload
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when results is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when results is empty', async () => {
      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: { results: [] }
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when a result has an invalid testType', async () => {
      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: resultsPayloadWith({ ...validDivaResult, testType: 'INVALID' })
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should accept a valid SICCT result with bovine and avian day fields', async () => {
      addTestPartResults.mockResolvedValue({ resultIds: ['result-id-1'] })

      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: resultsPayloadWith(validSicctResult)
      })

      expect(response.statusCode).toBe(201)
    })

    test('Should return 400 when SICCT result is missing day1Bovine', async () => {
      const { day1Bovine: _, ...result } = validSicctResult

      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: resultsPayloadWith(result)
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when SICCT result is missing day1Avian', async () => {
      const { day1Avian: _, ...result } = validSicctResult

      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: resultsPayloadWith(result)
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when DIVA result is missing day1Diva', async () => {
      const { day1Diva: _, ...result } = validDivaResult

      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: resultsPayloadWith(result)
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when DIVA result provides bovine day fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: resultsPayloadWith({ ...validDivaResult, day1Bovine: 3 })
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 400 when SICCT result provides diva day fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: resultsPayloadWith({ ...validSicctResult, day1Diva: 5 })
      })

      expect(response.statusCode).toBe(400)
    })

    test('Should return 502 when addTestPartResults throws', async () => {
      addTestPartResults.mockRejectedValue(
        new Error('Salesforce API error 500')
      )

      const response = await server.inject({
        method: 'POST',
        url: resultsUrl,
        payload: validResultsPayload
      })

      expect(response.statusCode).toBe(502)
    })
  })
})
