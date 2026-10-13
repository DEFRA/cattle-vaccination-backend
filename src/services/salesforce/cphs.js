import { query } from './index.js'

export async function getCph(cphNumber) {
  const escaped = cphNumber.replaceAll("'", "''")
  const result = await query(
    `SELECT Id, Name, APHA_CPHCode__c, APHA_CPHCodeStartDate__c, APHA_CPHCodeEndDate__c, APHA_CPHCodeStatus__c, APHA_CPHType__c, APHA_PreviousCPHNumber__c, APHA_TemporaryCPHNumber__c, APHA_Location__c FROM APHA_CPH__c WHERE Name='${escaped}' LIMIT 1`,
  )

  if (result.records.length === 0) {
    throw new Error(`CPH not found: ${cphNumber}`)
  }

  const record = result.records[0]

  return {
    id: record.Id,
    cphCode: record.Name,
    cphCodeShort: record.APHA_CPHCode__c,
    startDate: record.APHA_CPHCodeStartDate__c,
    endDate: record.APHA_CPHCodeEndDate__c,
    status: record.APHA_CPHCodeStatus__c,
    type: record.APHA_CPHType__c,
    previousCphNumber: record.APHA_PreviousCPHNumber__c,
    temporaryCphNumber: record.APHA_TemporaryCPHNumber__c,
    locationId: record.APHA_Location__c,
  }
}
