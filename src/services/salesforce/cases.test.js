import { createCase, getCase } from './cases.js'
import { composite, query } from './index.js'

vi.mock('./index.js', () => ({
  composite: vi.fn(),
  query: vi.fn(),
  SF_API_PATH: '/services/data/v62.0'
}))

const validInput = {
  cphNumber: '01/001/0006',
  reasonForTest: 'Pre-Movement',
  testWindowStart: '2026-04-22T14:30:00.000Z',
  testWindowEnd: '2026-04-22T14:30:00.000Z'
}

function mockComposite() {
  composite.mockResolvedValue({
    compositeResponse: [
      {
        referenceId: 'CaseRecordType',
        httpStatusCode: 200,
        body: { records: [{ Id: 'record-type-id' }] }
      },
      {
        referenceId: 'CPHRef',
        httpStatusCode: 200,
        body: { records: [{ Id: 'cph-id' }] }
      },
      {
        referenceId: 'CaseRef',
        httpStatusCode: 201,
        body: { id: 'case-id', success: true }
      }
    ]
  })
  query.mockResolvedValue({ records: [{ CaseNumber: '00001234' }] })
}

describe('#createCase', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should return caseId and caseNumber', async () => {
    mockComposite()

    const result = await createCase(validInput)

    expect(result).toEqual({ caseId: 'case-id', caseNumber: '00001234' })
  })

  test('Should send a single composite request', async () => {
    mockComposite()

    await createCase(validInput)

    expect(composite).toHaveBeenCalledTimes(1)
  })

  test('Should query CaseNumber for the newly created case ID', async () => {
    mockComposite()

    await createCase(validInput)

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE Id='case-id'")
    )
  })

  test('Should query RecordType and CPH as first two sub-requests', async () => {
    mockComposite()

    await createCase(validInput)

    const [compositeRequest] = composite.mock.calls[0]
    expect(compositeRequest[0]).toMatchObject({
      method: 'GET',
      referenceId: 'CaseRecordType',
      url: expect.stringContaining('APHA_CattleVax')
    })
    expect(compositeRequest[1]).toMatchObject({
      method: 'GET',
      referenceId: 'CPHRef',
      url: expect.stringContaining('APHA_CPH__c')
    })
  })

  test('Should create Case using record type and CPH references', async () => {
    mockComposite()

    await createCase(validInput)

    const [compositeRequest] = composite.mock.calls[0]
    expect(compositeRequest[2]).toMatchObject({
      method: 'POST',
      referenceId: 'CaseRef',
      url: '/services/data/v62.0/sobjects/Case',
      body: expect.objectContaining({
        RecordTypeId: '@{CaseRecordType.records[0].Id}',
        APHA_CPH__c: '@{CPHRef.records[0].Id}',
        APHA_ReasonForTest__c: 'Pre-Movement'
      })
    })
  })

  test('Should throw when RecordType is not found', async () => {
    composite.mockResolvedValue({
      compositeResponse: [
        {
          referenceId: 'CaseRecordType',
          httpStatusCode: 200,
          body: { records: [] }
        },
        {
          referenceId: 'CPHRef',
          httpStatusCode: 200,
          body: { records: [{ Id: 'cph-id' }] }
        }
      ]
    })

    await expect(createCase(validInput)).rejects.toThrow(
      'RecordType APHA_CattleVax not found'
    )
  })

  test('Should throw when CPH is not found', async () => {
    composite.mockResolvedValue({
      compositeResponse: [
        {
          referenceId: 'CaseRecordType',
          httpStatusCode: 200,
          body: { records: [{ Id: 'rt-id' }] }
        },
        { referenceId: 'CPHRef', httpStatusCode: 200, body: { records: [] } }
      ]
    })

    await expect(createCase(validInput)).rejects.toThrow(
      'CPH not found: 01/001/0006'
    )
  })

  test('Should throw when a composite step fails', async () => {
    composite.mockResolvedValue({
      compositeResponse: [
        {
          referenceId: 'CaseRecordType',
          httpStatusCode: 200,
          body: { records: [{ Id: 'rt-id' }] }
        },
        {
          referenceId: 'CPHRef',
          httpStatusCode: 200,
          body: { records: [{ Id: 'cph-id' }] }
        },
        {
          referenceId: 'CaseRef',
          httpStatusCode: 400,
          body: [{ errorCode: 'REQUIRED_FIELD_MISSING' }]
        }
      ]
    })

    await expect(createCase(validInput)).rejects.toThrow(
      'Salesforce composite request failed at step: CaseRef'
    )
  })

  test('Should throw when a SOQL sub-request itself returns 4xx', async () => {
    composite.mockResolvedValue({
      compositeResponse: [
        {
          referenceId: 'CaseRecordType',
          httpStatusCode: 400,
          body: [{ errorCode: 'INSUFFICIENT_ACCESS', message: 'No access' }]
        },
        {
          referenceId: 'CPHRef',
          httpStatusCode: 400,
          body: [{ errorCode: 'INSUFFICIENT_ACCESS', message: 'No access' }]
        }
      ]
    })

    await expect(createCase(validInput)).rejects.toThrow(
      'Salesforce composite request failed at step: CaseRecordType'
    )
  })
})

describe('#getCase', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should return case with nested test parts and results', async () => {
    query
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'case-id',
            CaseNumber: '00001234',
            Status: 'New',
            Priority: 'Medium',
            APHA_ReasonForTest__c: 'Pre-Movement',
            APHA_TestWindowStartDate__c: '2026-04-22',
            APHA_TestWindowEndDate__c: '2026-04-22',
            APHA_CPH__r: { Name: '01/001/0006' },
            CreatedDate: '2026-04-22T10:00:00.000Z',
            Owner: { Name: 'John Smith' }
          }
        ]
      })
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'tp-id',
            APHA_Day1__c: '2026-04-16',
            APHA_Day2__c: '2026-04-19',
            APHA_IdentityOfCertifiyngVet__c: 'Vet Identity',
            APHA_IdentityOfTester__c: 'Tester Identity'
          }
        ]
      })
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'result-id',
            APHA_TestType__c: 'DIVA',
            APHA_EarTagNo__c: 'UK-000001-000010',
            APHA_BatchAvian__c: null,
            APHA_BatchBovine__c: null,
            APHA_BatchDIVA__c: 'D1112',
            APHA_TestDay1Avian__c: 6,
            APHA_TestDay1Bovine__c: 4,
            APHA_TestDay1DIVA__c: null,
            APHA_TestDay2Avian__c: null,
            APHA_TestDay2Bovine__c: null,
            APHA_TestDay2DIVA__c: null,
            APHA_ResultAfterReview__c: null
          }
        ]
      })

    const result = await getCase('00001234')

    expect(result).toEqual({
      id: 'case-id',
      caseNumber: '00001234',
      status: 'New',
      priority: 'Medium',
      reasonForTest: 'Pre-Movement',
      testWindowStart: '2026-04-22',
      testWindowEnd: '2026-04-22',
      cph: '01/001/0006',
      openedDate: '2026-04-22T10:00:00.000Z',
      openedBy: 'John Smith',
      testParts: [
        {
          id: 'tp-id',
          day1: '2026-04-16',
          day2: '2026-04-19',
          certifyingVet: 'Vet Identity',
          tester: 'Tester Identity',
          results: [
            {
              id: 'result-id',
              testType: 'DIVA',
              earTagNo: 'UK-000001-000010',
              batchAvian: null,
              batchBovine: null,
              batchDiva: 'D1112',
              day1Avian: 6,
              day1Bovine: 4,
              day1Diva: null,
              day2Avian: null,
              day2Bovine: null,
              day2Diva: null,
              resultAfterReview: null
            }
          ]
        }
      ]
    })
  })

  test('Should query Case by Id with the correct SOQL', async () => {
    query
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'case-id',
            CaseNumber: '00001234',
            Status: 'New',
            Priority: 'Medium',
            APHA_ReasonForTest__c: 'Pre-Movement',
            APHA_TestWindowStartDate__c: '2026-04-22',
            APHA_TestWindowEndDate__c: '2026-04-22',
            APHA_CPH__r: { Name: '01/001/0006' },
            CreatedDate: '2026-04-22T10:00:00.000Z',
            Owner: { Name: 'John Smith' }
          }
        ]
      })
      .mockResolvedValueOnce({ records: [] })

    await getCase('a00000000000001')

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE Id='a00000000000001'")
    )
  })

  test('Should select CPH name, CreatedDate and Owner name in the Case SOQL query', async () => {
    query
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'case-id',
            CaseNumber: '00001234',
            Status: 'New',
            Priority: 'Medium',
            APHA_ReasonForTest__c: 'Pre-Movement',
            APHA_TestWindowStartDate__c: '2026-04-22',
            APHA_TestWindowEndDate__c: '2026-04-22',
            APHA_CPH__r: { Name: '01/001/0006' },
            CreatedDate: '2026-04-22T10:00:00.000Z',
            Owner: { Name: 'John Smith' }
          }
        ]
      })
      .mockResolvedValueOnce({ records: [] })

    await getCase('00001234')

    const caseQuery = query.mock.calls[0][0]
    expect(caseQuery).toContain('APHA_CPH__r.Name')
    expect(caseQuery).toContain('CreatedDate')
    expect(caseQuery).toContain('Owner.Name')
  })

  test('Should return empty testParts array when case has no test parts', async () => {
    query
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'case-id',
            CaseNumber: '00001234',
            Status: 'New',
            Priority: 'Medium',
            APHA_ReasonForTest__c: 'Pre-Movement',
            APHA_TestWindowStartDate__c: '2026-04-22',
            APHA_TestWindowEndDate__c: '2026-04-22',
            APHA_CPH__r: { Name: '01/001/0006' },
            CreatedDate: '2026-04-22T10:00:00.000Z',
            Owner: { Name: 'John Smith' }
          }
        ]
      })
      .mockResolvedValueOnce({ records: [] })

    const result = await getCase('00001234')

    expect(result.testParts).toEqual([])
  })

  test('Should throw when case is not found', async () => {
    query.mockResolvedValueOnce({ records: [] })

    await expect(getCase('99999999')).rejects.toThrow(
      'Case not found: 99999999'
    )
  })

  test('Should query TestPartResults for each TestPart', async () => {
    query
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'case-id',
            CaseNumber: '00001234',
            Status: 'New',
            Priority: 'Medium',
            APHA_ReasonForTest__c: 'Pre-Movement',
            APHA_TestWindowStartDate__c: '2026-04-22',
            APHA_TestWindowEndDate__c: '2026-04-22',
            APHA_CPH__r: { Name: '01/001/0006' },
            CreatedDate: '2026-04-22T10:00:00.000Z',
            Owner: { Name: 'John Smith' }
          }
        ]
      })
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'tp-id-1',
            APHA_Day1__c: '2026-04-16',
            APHA_Day2__c: '2026-04-19',
            APHA_IdentityOfCertifiyngVet__c: 'Vet',
            APHA_IdentityOfTester__c: 'Tester'
          },
          {
            Id: 'tp-id-2',
            APHA_Day1__c: '2026-04-17',
            APHA_Day2__c: '2026-04-20',
            APHA_IdentityOfCertifiyngVet__c: 'Vet 2',
            APHA_IdentityOfTester__c: 'Tester 2'
          }
        ]
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })

    const result = await getCase('00001234')

    expect(result.testParts).toHaveLength(2)
    // One query for Case, one for TestParts, one per TestPart for results
    expect(query).toHaveBeenCalledTimes(4)
  })
})
