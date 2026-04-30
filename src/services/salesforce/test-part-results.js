import { compositeGraph, SF_API_PATH } from './index.js'

export async function addTestPartResults(testPartId, results) {
  const graphResponse = await compositeGraph([
    {
      graphId: 'Graph_0',
      compositeRequest: results.map((result, index) => ({
        method: 'POST',
        referenceId: `Result_${index}`,
        url: `${SF_API_PATH}/sobjects/APHA_TestPartResult__c`,
        body: {
          APHA_TestPart__c: testPartId,
          APHA_TestType__c: result.testType,
          APHA_EarTagNo__c: result.earTagNo,
          APHA_BatchAvian__c: result.batchAvian ?? null,
          APHA_BatchBovine__c: result.batchBovine ?? null,
          APHA_BatchDIVA__c: result.batchDiva ?? null,
          APHA_TestDay1Avian__c: result.day1Avian ?? null,
          APHA_TestDay1Bovine__c: result.day1Bovine ?? null,
          APHA_TestDay1DIVA__c: result.day1Diva ?? null,
          APHA_TestDay2Avian__c: result.day2Avian ?? null,
          APHA_TestDay2Bovine__c: result.day2Bovine ?? null,
          APHA_TestDay2DIVA__c: result.day2Diva ?? null
        }
      }))
    }
  ])

  const graphResult = graphResponse.graphs[0]

  if (!graphResult.isSuccessful) {
    const failedStep = graphResult.graphResponse.compositeResponse.find(
      (r) => r.httpStatusCode >= 400
    )

    const errorMessage =
      failedStep.body.find(
        (step) => step.errorCode === 'FIELD_CUSTOM_VALIDATION_EXCEPTION'
      )?.message ?? 'Salesforce validation failed'

    throw new Error(`Salesforce graph request failed - ${errorMessage}`)
  }

  return {
    resultIds: graphResult.graphResponse.compositeResponse.map((r) => r.body.id)
  }
}
