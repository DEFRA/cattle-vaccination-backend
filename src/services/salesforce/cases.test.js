import { createCase } from './cases.js'
import { composite } from './index.js'

vi.mock('./index.js', () => ({
  composite: vi.fn(),
  SF_API_PATH: '/services/data/v62.0'
}))

const validInput = {
  cphNumber: '01/001/0006',
  reasonForTest: 'Pre-Movement',
  testWindowStart: '2026-04-22T14:30:00.000Z',
  testWindowEnd: '2026-04-22T14:30:00.000Z',
  testParts: [
    {
      day1: '2026-04-16',
      day2: '2026-04-13',
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
}

function mockComposite(
  testPartIds = ['test-part-id'],
  resultIdGroups = [['result-id']]
) {
  const responses = [
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
  testPartIds.forEach((testPartId, tpIdx) => {
    responses.push({
      referenceId: `TestPart_${tpIdx}`,
      httpStatusCode: 201,
      body: { id: testPartId, success: true }
    })
    resultIdGroups[tpIdx].forEach((resultId, rIdx) => {
      responses.push({
        referenceId: `TestPartResult_${tpIdx}_${rIdx}`,
        httpStatusCode: 201,
        body: { id: resultId, success: true }
      })
    })
  })
  composite.mockResolvedValue({ compositeResponse: responses })
}

describe('#createCase', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should return caseId and testPart IDs', async () => {
    mockComposite()

    const result = await createCase(validInput)

    expect(result).toEqual({
      caseId: 'case-id',
      testParts: [{ testPartId: 'test-part-id', resultIds: ['result-id'] }]
    })
  })

  test('Should send a single composite request', async () => {
    mockComposite()

    await createCase(validInput)

    expect(composite).toHaveBeenCalledTimes(1)
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

  test('Should create TestPart linked to Case via reference', async () => {
    mockComposite()

    await createCase(validInput)

    const [compositeRequest] = composite.mock.calls[0]
    expect(compositeRequest[3]).toMatchObject({
      method: 'POST',
      referenceId: 'TestPart_0',
      body: expect.objectContaining({ Case__c: '@{CaseRef.id}' })
    })
  })

  test('Should create TestPartResult linked to TestPart via reference', async () => {
    mockComposite()

    await createCase(validInput)

    const [compositeRequest] = composite.mock.calls[0]
    expect(compositeRequest[4]).toMatchObject({
      method: 'POST',
      referenceId: 'TestPartResult_0_0',
      body: expect.objectContaining({
        APHA_TestPart__c: '@{TestPart_0.id}',
        APHA_TestType__c: 'DIVA',
        APHA_EarTagNo__c: 'UK-000001-000010'
      })
    })
  })

  test('Should handle multiple test parts', async () => {
    mockComposite(['test-part-1', 'test-part-2'], [['result-1'], ['result-2']])

    const input = {
      ...validInput,
      testParts: [
        { ...validInput.testParts[0] },
        { ...validInput.testParts[0] }
      ]
    }

    const result = await createCase(input)

    expect(result.testParts).toHaveLength(2)
    expect(result.testParts[0]).toEqual({
      testPartId: 'test-part-1',
      resultIds: ['result-1']
    })
    expect(result.testParts[1]).toEqual({
      testPartId: 'test-part-2',
      resultIds: ['result-2']
    })
  })

  test('Should use unique referenceIds for each TestPart in a multi-part request', async () => {
    mockComposite(['tp-1', 'tp-2'], [['r-1'], ['r-2']])

    const input = {
      ...validInput,
      testParts: [
        { ...validInput.testParts[0] },
        { ...validInput.testParts[0] }
      ]
    }

    await createCase(input)

    const [compositeRequest] = composite.mock.calls[0]
    const refIds = compositeRequest.map((r) => r.referenceId)
    expect(refIds).toContain('TestPart_0')
    expect(refIds).toContain('TestPart_1')
    expect(refIds).toContain('TestPartResult_0_0')
    expect(refIds).toContain('TestPartResult_1_0')
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

  test('Should throw when composite sub-request limit would be exceeded', async () => {
    const manyResults = Array.from({ length: 23 }, (_, i) => ({
      testType: 'DIVA',
      earTagNo: `UK-000001-0000${String(i).padStart(2, '0')}`
    }))

    const input = {
      ...validInput,
      testParts: [{ ...validInput.testParts[0], results: manyResults }]
    }

    await expect(createCase(input)).rejects.toThrow(
      'exceeding the Salesforce limit of 25'
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
})
