import { compositeGraph, SF_API_PATH } from './index.js'

export async function submitTestParts(caseId, testParts) {
  const graphResponse = await compositeGraph([
    {
      graphId: 'Graph_0',
      compositeRequest: buildSubRequests(caseId, testParts)
    }
  ])

  const graphResult = graphResponse.graphs[0]

  if (!graphResult.isSuccessful) {
    const failedStep = graphResult.graphResponse.compositeResponse.find(
      (r) => r.httpStatusCode >= 400
    )

    throw new Error(
      `Salesforce graph request failed${failedStep ? ` at step: ${failedStep.referenceId}` : ''}`
    )
  }

  return {
    testParts: extractResults(
      graphResult.graphResponse.compositeResponse,
      testParts
    )
  }
}

function buildSubRequests(caseId, testParts) {
  const subRequests = []

  for (
    let testPartIndex = 0;
    testPartIndex < testParts.length;
    testPartIndex++
  ) {
    const testPart = testParts[testPartIndex]
    const testPartRefId = `TestPart_${testPartIndex}`

    subRequests.push({
      method: 'POST',
      referenceId: testPartRefId,
      url: `${SF_API_PATH}/sobjects/APHA_TestPart__c`,
      body: {
        Case__c: caseId,
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

      subRequests.push({
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
          APHA_TestDay2DIVA__c: result.day2Diva
        }
      })
    }
  }

  return subRequests
}

function extractResults(compositeResponse, testParts) {
  const createdTestParts = []
  let responseIndex = 0

  for (
    let testPartIndex = 0;
    testPartIndex < testParts.length;
    testPartIndex++
  ) {
    const testPartId = compositeResponse[responseIndex].body.id
    responseIndex++

    const resultIds = []

    for (
      let resultIndex = 0;
      resultIndex < testParts[testPartIndex].results.length;
      resultIndex++
    ) {
      resultIds.push(compositeResponse[responseIndex].body.id)
      responseIndex++
    }

    createdTestParts.push({ testPartId, resultIds })
  }

  return createdTestParts
}
