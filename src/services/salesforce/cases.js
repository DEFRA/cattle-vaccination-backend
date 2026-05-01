import { composite, query, SF_API_PATH } from './index.js'

export async function createCase({
  cphNumber,
  reasonForTest,
  testWindowStart,
  testWindowEnd
}) {
  const { compositeResponse } = await composite([
    {
      method: 'GET',
      referenceId: 'CaseRecordType',
      url: `${SF_API_PATH}/query?q=${encodeURIComponent(
        "SELECT Id FROM RecordType WHERE DeveloperName='APHA_CattleVax' AND SobjectType='Case' LIMIT 1"
      )}`
    },
    {
      method: 'GET',
      referenceId: 'CPHRef',
      url: `${SF_API_PATH}/query?q=${encodeURIComponent(
        `SELECT Id FROM APHA_CPH__c WHERE Name='${cphNumber.replace(/'/g, "''")}' LIMIT 1`
      )}`
    },
    {
      method: 'POST',
      referenceId: 'CaseRef',
      url: `${SF_API_PATH}/sobjects/Case`,
      body: {
        RecordTypeId: '@{CaseRecordType.records[0].Id}',
        APHA_CPH__c: '@{CPHRef.records[0].Id}',
        APHA_ReasonForTest__c: reasonForTest,
        APHA_TestWindowStartDate__c: testWindowStart,
        APHA_TestWindowEndDate__c: testWindowEnd,
        Status: 'Draft',
        Priority: 'Medium'
      }
    }
  ])

  const failedStep = compositeResponse.find((r) => r.httpStatusCode >= 400)

  if (failedStep) {
    throw new Error(
      `Salesforce composite request failed at step: ${failedStep.referenceId}`
    )
  }

  // SOQL queries return HTTP 200 even when nothing matches — empty records array is the failure signal
  if (compositeResponse[0].body.records.length === 0) {
    throw new Error('RecordType APHA_CattleVax not found')
  }

  if (compositeResponse[1].body.records.length === 0) {
    throw new Error(`CPH not found: ${cphNumber}`)
  }

  const caseId = compositeResponse[2].body.id

  const caseNumberResult = await query(
    `SELECT CaseNumber FROM Case WHERE Id='${caseId.replace(/'/g, "''")}' LIMIT 1`
  )

  const caseNumber = caseNumberResult.records[0]?.CaseNumber

  return { caseId, caseNumber }
}

export async function getCaseByCaseNumber(caseNumber) {
  const escaped = caseNumber.replace(/'/g, "''")
  const result = await query(
    `SELECT Id, CaseNumber FROM Case WHERE CaseNumber='${escaped}' LIMIT 1`
  )

  if (result.records.length === 0) {
    throw new Error(`Case not found: ${caseNumber}`)
  }

  return { caseId: result.records[0].Id }
}

export async function getCase(caseId) {
  const escapedCaseId = caseId.replace(/'/g, "''")

  const caseResult = await query(
    `SELECT Id, CaseNumber, Status, Priority, APHA_ReasonForTest__c, APHA_TestWindowStartDate__c, APHA_TestWindowEndDate__c, APHA_CPH__r.Name, CreatedDate, Owner.Name FROM Case WHERE Id='${escapedCaseId}' LIMIT 1`
  )

  if (caseResult.records.length === 0) {
    throw new Error(`Case not found: ${caseId}`)
  }

  const caseRecord = caseResult.records[0]
  const escapedId = caseRecord.Id.replace(/'/g, "''")

  const testPartsResult = await query(
    `SELECT Id, APHA_Day1__c, APHA_Day2__c, APHA_IdentityOfCertifiyngVet__c, APHA_IdentityOfTester__c FROM APHA_TestPart__c WHERE Case__c='${escapedId}'`
  )

  const testParts = await Promise.all(
    testPartsResult.records.map(async (tp) => {
      const escapedTpId = tp.Id.replace(/'/g, "''")
      const resultsResult = await query(
        `SELECT Id, APHA_TestType__c, APHA_EarTagNo__c, APHA_BatchAvian__c, APHA_BatchBovine__c, APHA_BatchDIVA__c, APHA_TestDay1Avian__c, APHA_TestDay1Bovine__c, APHA_TestDay1DIVA__c, APHA_TestDay2Avian__c, APHA_TestDay2Bovine__c, APHA_TestDay2DIVA__c FROM APHA_TestPartResult__c WHERE APHA_TestPart__c='${escapedTpId}'`
      )

      return {
        id: tp.Id,
        day1: tp.APHA_Day1__c,
        day2: tp.APHA_Day2__c,
        certifyingVet: tp.APHA_IdentityOfCertifiyngVet__c,
        tester: tp.APHA_IdentityOfTester__c,
        results: resultsResult.records.map((r) => ({
          id: r.Id,
          testType: r.APHA_TestType__c,
          earTagNo: r.APHA_EarTagNo__c,
          batchAvian: r.APHA_BatchAvian__c,
          batchBovine: r.APHA_BatchBovine__c,
          batchDiva: r.APHA_BatchDIVA__c,
          day1Avian: r.APHA_TestDay1Avian__c,
          day1Bovine: r.APHA_TestDay1Bovine__c,
          day1Diva: r.APHA_TestDay1DIVA__c,
          day2Avian: r.APHA_TestDay2Avian__c,
          day2Bovine: r.APHA_TestDay2Bovine__c,
          day2Diva: r.APHA_TestDay2DIVA__c
        }))
      }
    })
  )

  return {
    id: caseRecord.Id,
    caseNumber: caseRecord.CaseNumber,
    status: caseRecord.Status,
    priority: caseRecord.Priority,
    reasonForTest: caseRecord.APHA_ReasonForTest__c,
    testWindowStart: caseRecord.APHA_TestWindowStartDate__c,
    testWindowEnd: caseRecord.APHA_TestWindowEndDate__c,
    cph: caseRecord.APHA_CPH__r?.Name ?? null,
    openedDate: caseRecord.CreatedDate,
    openedBy: caseRecord.Owner?.Name ?? null,
    testParts
  }
}
