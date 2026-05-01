import { submitTestParts } from './test-parts.js'
import { composite, compositeGraph } from './index.js'

vi.mock('./index.js', () => ({
  composite: vi.fn(),
  compositeGraph: vi.fn(),
  SF_API_PATH: '/services/data/v62.0'
}))

const validTestParts = [
  {
    day1: '2026-04-16',
    day2: '2026-04-19',
    certifyingVet: 'Vet Identity',
    tester: 'Tester Identity',
    results: [
      {
        testType: 'DIVA',
        earTagNo: 'UK-000001-000010',
        batchDiva: 'D1112',
        day1Avian: 6,
        day1Bovine: 4
      }
    ]
  }
]

describe('#submitTestParts', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  function mockGraph(compositeResponse) {
    compositeGraph.mockResolvedValue({
      graphs: [
        {
          graphId: 'Graph_0',
          isSuccessful: true,
          graphResponse: { compositeResponse }
        }
      ]
    })
  }

  test('Should return testPartId and resultIds', async () => {
    mockGraph([
      {
        referenceId: 'TestPart_0',
        httpStatusCode: 201,
        body: { id: 'tp-id', success: true }
      },
      {
        referenceId: 'TestPartResult_0_0',
        httpStatusCode: 201,
        body: { id: 'result-id', success: true }
      }
    ])

    const result = await submitTestParts('case-id', validTestParts)

    expect(result).toEqual({
      testParts: [{ testPartId: 'tp-id', resultIds: ['result-id'] }]
    })
  })

  test('Should always use the graph API', async () => {
    mockGraph([
      {
        referenceId: 'TestPart_0',
        httpStatusCode: 201,
        body: { id: 'tp-id', success: true }
      },
      {
        referenceId: 'TestPartResult_0_0',
        httpStatusCode: 201,
        body: { id: 'result-id', success: true }
      }
    ])

    await submitTestParts('case-id', validTestParts)

    expect(composite).not.toHaveBeenCalled()
    expect(compositeGraph).toHaveBeenCalledTimes(1)
    expect(compositeGraph).toHaveBeenCalledWith([
      expect.objectContaining({ graphId: 'Graph_0' })
    ])
  })

  test('Should link TestPart to the provided caseId directly (not via reference)', async () => {
    mockGraph([
      {
        referenceId: 'TestPart_0',
        httpStatusCode: 201,
        body: { id: 'tp-id', success: true }
      },
      {
        referenceId: 'TestPartResult_0_0',
        httpStatusCode: 201,
        body: { id: 'result-id', success: true }
      }
    ])

    await submitTestParts('case-id-123', validTestParts)

    const [graphRequest] = compositeGraph.mock.calls[0]
    expect(graphRequest[0].compositeRequest[0]).toMatchObject({
      method: 'POST',
      referenceId: 'TestPart_0',
      body: expect.objectContaining({ Case__c: 'case-id-123' })
    })
  })

  test('Should throw when graph request is not successful', async () => {
    compositeGraph.mockResolvedValue({
      graphs: [
        {
          graphId: 'Graph_0',
          isSuccessful: false,
          graphResponse: {
            compositeResponse: [
              {
                referenceId: 'TestPart_0',
                httpStatusCode: 400,
                body: [{ errorCode: 'FIELD_INTEGRITY_EXCEPTION' }]
              }
            ]
          }
        }
      ]
    })

    await expect(submitTestParts('case-id', validTestParts)).rejects.toThrow(
      'Salesforce graph request failed at step: TestPart_0'
    )
  })
})
