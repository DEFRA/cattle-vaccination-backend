import { addTestPartResults } from './test-part-results.js'
import { composite, compositeGraph } from './index.js'

vi.mock('./index.js', () => ({
  composite: vi.fn(),
  compositeGraph: vi.fn(),
  SF_API_PATH: '/services/data/v62.0'
}))

const validResults = [
  {
    testType: 'DIVA',
    earTagNo: 'UK-000001-000010',
    batchDiva: 'D1112',
    day1Avian: 6,
    day1Bovine: 4
  }
]

describe('#addTestPartResults', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  function mockGraphResults(resultIds) {
    compositeGraph.mockResolvedValue({
      graphs: [
        {
          graphId: 'Graph_0',
          isSuccessful: true,
          graphResponse: {
            compositeResponse: resultIds.map((id, index) => ({
              referenceId: `Result_${index}`,
              httpStatusCode: 201,
              body: { id, success: true }
            }))
          }
        }
      ]
    })
  }

  test('Should return resultIds', async () => {
    mockGraphResults(['result-id-1'])

    const result = await addTestPartResults('tp-id', validResults)

    expect(result).toEqual({ resultIds: ['result-id-1'] })
  })

  test('Should always use the graph API', async () => {
    mockGraphResults(['result-id-1'])

    await addTestPartResults('tp-id', validResults)

    expect(composite).not.toHaveBeenCalled()
    expect(compositeGraph).toHaveBeenCalledTimes(1)
    expect(compositeGraph).toHaveBeenCalledWith([
      expect.objectContaining({ graphId: 'Graph_0' })
    ])
  })

  test('Should create one graph sub-request per result', async () => {
    mockGraphResults(['result-id-1', 'result-id-2'])

    await addTestPartResults('tp-id', [validResults[0], validResults[0]])

    const [graphRequest] = compositeGraph.mock.calls[0]
    expect(graphRequest[0].compositeRequest).toHaveLength(2)
    expect(graphRequest[0].compositeRequest[0].referenceId).toBe('Result_0')
    expect(graphRequest[0].compositeRequest[1].referenceId).toBe('Result_1')
  })

  test('Should link each result to the provided testPartId', async () => {
    mockGraphResults(['result-id-1'])

    await addTestPartResults('tp-id-123', validResults)

    const [graphRequest] = compositeGraph.mock.calls[0]
    expect(graphRequest[0].compositeRequest[0]).toMatchObject({
      method: 'POST',
      url: '/services/data/v62.0/sobjects/APHA_TestPartResult__c',
      body: expect.objectContaining({ APHA_TestPart__c: 'tp-id-123' })
    })
  })

  test('Should map result fields to Salesforce field names', async () => {
    mockGraphResults(['result-id-1'])

    await addTestPartResults('tp-id', validResults)

    const [graphRequest] = compositeGraph.mock.calls[0]
    expect(graphRequest[0].compositeRequest[0].body).toMatchObject({
      APHA_TestType__c: 'DIVA',
      APHA_EarTagNo__c: 'UK-000001-000010',
      APHA_BatchDIVA__c: 'D1112',
      APHA_TestDay1Avian__c: 6,
      APHA_TestDay1Bovine__c: 4,
      APHA_BatchAvian__c: null,
      APHA_BatchBovine__c: null
    })
  })

  test('Should throw when the graph request is not successful', async () => {
    compositeGraph.mockResolvedValue({
      graphs: [
        {
          graphId: 'Graph_0',
          isSuccessful: false,
          graphResponse: {
            compositeResponse: [
              {
                referenceId: 'Result_0',
                httpStatusCode: 400,
                body: [{ errorCode: 'FIELD_INTEGRITY_EXCEPTION' }]
              }
            ]
          }
        }
      ]
    })

    await expect(addTestPartResults('tp-id', validResults)).rejects.toThrow(
      'Salesforce graph request failed - Salesforce validation failed'
    )
  })
})
