import { getSalesforceConnection } from './index.js'

const cphFields = [
  'Name',
  'APHA_CPHCode__c',
  'APHA_CPHCodeStartDate__c',
  'APHA_CPHCodeEndDate__c',
  'APHA_CPHCodeStatus__c',
  'APHA_CPHType__c',
  'APHA_PreviousCPHNumber__c',
  'APHA_TemporaryCPHNumber__c',
]

function toSalesforceCphName(cphNumber) {
  return `${cphNumber.slice(0, 2)}/${cphNumber.slice(2, 5)}/${cphNumber.slice(5)}`
}

export async function getCph(cphNumber) {
  const salesforceConnection = await getSalesforceConnection()
  const record = await salesforceConnection
    .sobject('APHA_CPH__c')
    .findOne({ Name: toSalesforceCphName(cphNumber) }, cphFields)

  if (!record) {
    throw new Error(`CPH not found: ${cphNumber}`)
  }

  return {
    id: record.Name.replaceAll('/', ''),
    displayName: record.Name,
    cphCode: record.APHA_CPHCode__c,
    startDate: record.APHA_CPHCodeStartDate__c,
    endDate: record.APHA_CPHCodeEndDate__c,
    status: record.APHA_CPHCodeStatus__c,
    type: record.APHA_CPHType__c,
    previousCphNumber: record.APHA_PreviousCPHNumber__c,
    temporaryCphNumber: record.APHA_TemporaryCPHNumber__c,
  }
}
