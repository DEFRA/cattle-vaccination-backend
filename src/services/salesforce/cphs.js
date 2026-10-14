import { getSalesforceConnection } from './index.js'

const cphFields = [
  'Id',
  'Name',
  'APHA_CPHCode__c',
  'APHA_CPHCodeStartDate__c',
  'APHA_CPHCodeEndDate__c',
  'APHA_CPHCodeStatus__c',
  'APHA_CPHType__c',
  'APHA_PreviousCPHNumber__c',
  'APHA_TemporaryCPHNumber__c',
  'APHA_Location__c',
]

export async function getCph(cphNumber) {
  const conn = await getSalesforceConnection()
  const record = await conn.sobject('APHA_CPH__c').findOne({ Name: cphNumber }, cphFields)

  if (!record) {
    throw new Error(`CPH not found: ${cphNumber}`)
  }

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
