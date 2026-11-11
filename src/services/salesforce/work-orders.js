import { getSalesforceConnection } from './index.js'
import { toCph } from './cphs.js'

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

const workOrderDetailFields = [
  ...workOrderFields,
  'CV_CPH__r.APHA_CPHCodeStartDate__c',
  'CV_CPH__r.APHA_CPHCodeEndDate__c',
  'CV_CPH__r.APHA_CPHCodeStatus__c',
  'CV_CPH__r.APHA_CPHType__c',
  'CV_CPH__r.APHA_PreviousCPHNumber__c',
  'CV_CPH__r.APHA_TemporaryCPHNumber__c',
]

function toWorkOrderCph(cph) {
  if (!cph) {
    return null
  }

  return {
    ...toCph(cph),
    locationName: cphNameFrom(cph),
    address: formatAddress(cph.APHA_Location__r),
  }
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
  'Id',
  'Name',
  'CV_CPH__r.Name',
  'CV_CPH__r.APHA_CPHCode__c',
  'CV_CPH__r.APHA_Location__r.Name',
]

function toWorkList(record) {
  const cph = record.CV_CPH__r

  return {
    id: record.Id,
    name: record.Name,
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
    .findOne({ Name: workOrderId }, workOrderDetailFields)

  if (!record) {
    throw new Error(`Work order not found: ${workOrderId}`)
  }

  const workLists = await connection
    .sobject('CV_WorkList__c')
    .find({ 'CV_Work_Order__r.Name': workOrderId }, workListFields)
    .sort('Name')

  return {
    id: record.Name,
    cph: toWorkOrderCph(record.CV_CPH__r),
    workLists: workLists.map(toWorkList),
  }
}

function createWorkListFlowError(result) {
  const message = result?.outputValues?.responseMessage || result?.errors?.[0]?.message

  return new Error(message || 'Create work list flow failed')
}

async function startCreateWorkListFlow(connection, workOrderRecordId) {
  const [result] = await connection.requestPost(
    '/actions/custom/flow/Fetch_and_Create_Commodity_Animals',
    { inputs: [{ recordId: workOrderRecordId }] },
  )

  const workListRecordId = result?.outputValues?.WorkListId

  if (!result?.isSuccess || result.outputValues?.isSuccess !== true || !workListRecordId) {
    throw createWorkListFlowError(result)
  }

  const workList = await connection
    .sobject('CV_WorkList__c')
    .findOne({ Id: workListRecordId }, ['Id'])

  if (!workList) {
    throw new Error(`Work list not found: ${workListRecordId}`)
  }

  return { id: workList.Id }
}

const workListCattleFields = [
  'CV_Animal__r.Name',
  'CV_Animal__r.APHA_CommodityAnimalDOB__c',
  'CV_Animal__r.APHA_CommodityAnimalGender__c',
  'CV_Animal__r.APHA_CommodityAnimalBreed__c',
]

function toCattle(record) {
  const animal = record.CV_Animal__r

  return {
    earTag: animal?.Name || null,
    dob: animal?.APHA_CommodityAnimalDOB__c || null,
    sex: animal?.APHA_CommodityAnimalGender__c || null,
    breed: animal?.APHA_CommodityAnimalBreed__c || null,
  }
}

export async function getWorkList(workOrderId, workListId) {
  const connection = await getSalesforceConnection()
  const workList = await connection
    .sobject('CV_WorkList__c')
    .findOne({ Id: workListId, 'CV_Work_Order__r.Name': workOrderId }, ['Id', 'Name'])

  if (!workList) {
    throw new Error(`Work list not found: ${workListId}`)
  }

  const animals = await connection
    .sobject('CV_WorkListAnimal__c')
    .find({ CV_WorkList__c: workList.Id }, workListCattleFields)
    .sort('Name')

  return {
    id: workList.Id,
    name: workList.Name,
    cattle: animals
      .map(toCattle)
      .sort((left, right) => (left.earTag || '').localeCompare(right.earTag || '')),
  }
}

export async function createWorkList(workOrderId) {
  const connection = await getSalesforceConnection()
  const record = await connection.sobject('CV_WorkOrder__c').findOne({ Name: workOrderId }, ['Id'])

  if (!record) {
    throw new Error(`Work order not found: ${workOrderId}`)
  }

  return startCreateWorkListFlow(connection, record.Id)
}
