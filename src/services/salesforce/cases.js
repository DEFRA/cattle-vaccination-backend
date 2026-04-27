import { composite, SF_API_PATH } from './index.js'

/**
 * @typedef {Object} TestPartResult
 * @property {string} testType - e.g. 'DIVA'
 * @property {string} earTagNo - e.g. 'UK-000001-000010'
 * @property {string|null} [batchAvian]
 * @property {string|null} [batchBovine]
 * @property {string|null} [batchDiva]
 * @property {number|null} [day1Avian]
 * @property {number|null} [day1Bovine]
 * @property {number|null} [day1Diva]
 * @property {number|null} [day2Avian]
 * @property {number|null} [day2Bovine]
 * @property {number|null} [day2Diva]
 * @property {string|null} [resultAfterReview]
 */

/**
 * @typedef {Object} TestPart
 * @property {string} day1 - ISO date string e.g. '2026-04-16'
 * @property {string} day2 - ISO date string e.g. '2026-04-13'
 * @property {string} certifyingVet
 * @property {string} tester
 * @property {TestPartResult[]} results
 */

/**
 * Creates a Case with one or more TestParts and their results in a single atomic Composite API call.
 *
 * @param {Object} params
 * @param {string} params.cphNumber - CPH identifier e.g. '01/001/0006'
 * @param {string} params.reasonForTest - e.g. 'Pre-Movement'
 * @param {string} params.testWindowStart - ISO datetime
 * @param {string} params.testWindowEnd - ISO datetime
 * @param {TestPart[]} params.testParts
 * @returns {Promise<{ caseId: string, testParts: Array<{ testPartId: string, resultIds: string[] }> }>}
 */
export async function createCase({
  cphNumber,
  reasonForTest,
  testWindowStart,
  testWindowEnd,
  testParts
}) {
  const totalRequests =
    3 +
    testParts.length +
    testParts.reduce((sum, tp) => sum + tp.results.length, 0)

  if (totalRequests > 25) {
    throw new Error(
      `Payload requires ${totalRequests} composite sub-requests, exceeding the Salesforce limit of 25`
    )
  }

  const compositeRequest = [
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
        Status: 'New',
        Priority: 'Medium'
      }
    }
  ]

  for (
    let testPartIndex = 0;
    testPartIndex < testParts.length;
    testPartIndex++
  ) {
    const testPart = testParts[testPartIndex]
    const testPartRefId = `TestPart_${testPartIndex}`

    compositeRequest.push({
      method: 'POST',
      referenceId: testPartRefId,
      url: `${SF_API_PATH}/sobjects/APHA_TestPart__c`,
      body: {
        Case__c: '@{CaseRef.id}',
        APHA_Day1__c: testPart.day1,
        APHA_Day2__c: testPart.day2,
        APHA_IdentityOfCertifiyngVet__c: testPart.certifyingVet,
        APHA_IdentityOfTester__c: testPart.tester
      }
    })

    for (
      let resultIndex = 0;
      resultIndex < testPart.results.length;
      resultIndex++
    ) {
      const result = testPart.results[resultIndex]
      compositeRequest.push({
        method: 'POST',
        referenceId: `TestPartResult_${testPartIndex}_${resultIndex}`,
        url: `${SF_API_PATH}/sobjects/APHA_TestPartResult__c`,
        body: {
          APHA_TestPart__c: `@{${testPartRefId}.id}`,
          APHA_TestType__c: result.testType,
          APHA_EarTagNo__c: result.earTagNo,
          APHA_BatchAvian__c: result.batchAvian,
          APHA_BatchBovine__c: result.batchBovine,
          APHA_BatchDIVA__c: result.batchDiva,
          APHA_TestDay1Avian__c: result.day1Avian,
          APHA_TestDay1Bovine__c: result.day1Bovine,
          APHA_TestDay1DIVA__c: result.day1Diva,
          APHA_TestDay2Avian__c: result.day2Avian,
          APHA_TestDay2Bovine__c: result.day2Bovine,
          APHA_TestDay2DIVA__c: result.day2Diva,
          APHA_ResultAfterReview__c: result.resultAfterReview
        }
      })
    }
  }

  const { compositeResponse } = await composite(compositeRequest)

  // SOQL queries return HTTP 200 even when nothing matches — empty records array is the failure signal
  if (compositeResponse[0].body.records.length === 0) {
    throw new Error('RecordType APHA_CattleVax not found')
  }

  if (compositeResponse[1].body.records.length === 0) {
    throw new Error(`CPH not found: ${cphNumber}`)
  }

  const failedStep = compositeResponse.find((r) => r.httpStatusCode >= 400)

  if (failedStep) {
    throw new Error(
      `Salesforce composite request failed at step: ${failedStep.referenceId}`
    )
  }

  const caseId = compositeResponse[2].body.id

  let responseIdx = 3
  const createdTestParts = []

  for (
    let testPartIndex = 0;
    testPartIndex < testParts.length;
    testPartIndex++
  ) {
    const testPartId = compositeResponse[responseIdx].body.id
    responseIdx++

    const resultIds = []

    for (
      let resultIndex = 0;
      resultIndex < testParts[testPartIndex].results.length;
      resultIndex++
    ) {
      resultIds.push(compositeResponse[responseIdx].body.id)
      responseIdx++
    }

    createdTestParts.push({ testPartId, resultIds })
  }

  return { caseId, testParts: createdTestParts }
}
