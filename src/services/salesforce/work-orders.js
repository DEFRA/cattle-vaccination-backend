import { getSalesforceConnection } from './index.js'

const cphCodePattern = /^\d{2}\/\d{3}\/\d{4}$/

const workOrderFields = [
  'Name',
  'CV_CPH__r.Name',
  'CV_CPH__r.APHA_CPHCode__c',
  'CV_CPH__r.APHA_Location__r.Name',
  'CV_CPH__r.APHA_Location__r.VisitorAddress.Street',
  'CV_CPH__r.APHA_Location__r.VisitorAddress.City',
  'CV_CPH__r.APHA_Location__r.VisitorAddress.State',
  'CV_CPH__r.APHA_Location__r.VisitorAddress.PostalCode',
  'CV_CPH__r.APHA_Location__r.VisitorAddress.Country',
]

function cphCodeFrom(cph) {
  if (cph?.APHA_CPHCode__c) {
    return cph.APHA_CPHCode__c
  }

  if (cphCodePattern.test(cph?.Name)) {
    return cph.Name
  }

  return null
}

function cphNameFrom(cph) {
  const locationName = cph?.APHA_Location__r?.Name

  if (locationName) {
    return locationName
  }

  if (cph?.Name && !cphCodePattern.test(cph.Name)) {
    return cph.Name
  }

  return null
}

function cphNumberFrom(cphCode) {
  if (!cphCodePattern.test(cphCode)) {
    return null
  }

  return cphCode.replaceAll('/', '')
}

function addressPart(value) {
  return value?.replaceAll(/^[,\s]+|[,\s]+$/g, '') || null
}

function formatAddress(location) {
  const address = location?.VisitorAddress

  if (!address) {
    return null
  }

  const line = [address.Street, address.City, address.State, address.PostalCode, address.Country]
    .map(addressPart)
    .filter(Boolean)
    .join(', ')

  return line || null
}

function toWorkOrder(record) {
  const cph = record.CV_CPH__r
  const cphName = cphNameFrom(cph)
  const cphCode = cphCodeFrom(cph)

  return {
    id: record.Name,
    title: [cphName, cphCode].filter(Boolean).join(' - ') || null,
    cphName,
    cphCode,
    cphNumber: cphNumberFrom(cphCode),
    address: formatAddress(cph?.APHA_Location__r),
  }
}

const workListFields = [
  'Name',
  'CV_CPH__r.Name',
  'CV_CPH__r.APHA_CPHCode__c',
  'CV_CPH__r.APHA_Location__r.Name',
]

function toWorkList(record) {
  const cph = record.CV_CPH__r

  return {
    id: record.Name,
    cphName: cphNameFrom(cph),
    cphCode: cphCodeFrom(cph),
  }
}

export async function getWorkOrders() {
  const connection = await getSalesforceConnection()
  const records = await connection.sobject('CV_WorkOrder__c').find({}, workOrderFields).sort('Name')

  return records.map(toWorkOrder)
}

export async function getWorkOrder(workOrderId) {
  const connection = await getSalesforceConnection()
  const record = await connection
    .sobject('CV_WorkOrder__c')
    .findOne({ Name: workOrderId }, workOrderFields)

  if (!record) {
    throw new Error(`Work order not found: ${workOrderId}`)
  }

  const workLists = await connection
    .sobject('CV_WorkList__c')
    .find({ 'CV_Work_Order__r.Name': workOrderId }, workListFields)
    .sort('Name')

  const cph = record.CV_CPH__r
  const cphCode = cphCodeFrom(cph)

  return {
    id: record.Name,
    cphName: cphNameFrom(cph),
    cphCode,
    cphNumber: cphNumberFrom(cphCode),
    address: formatAddress(cph?.APHA_Location__r),
    workLists: workLists.map(toWorkList),
  }
}
