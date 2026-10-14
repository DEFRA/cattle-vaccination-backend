import { getCph } from './cphs.js'
import { getSalesforceConnection } from './index.js'

const findOne = vi.fn()
const sobject = vi.fn(() => ({ findOne }))

vi.mock('./index.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getSalesforceConnection: vi.fn(),
  }
})

const cphNumber = '01/001/0006'

const salesforceRecord = {
  Id: 'cph-id',
  Name: cphNumber,
  APHA_CPHCode__c: '010010006',
  APHA_CPHCodeStartDate__c: '2020-01-01',
  APHA_CPHCodeEndDate__c: null,
  APHA_CPHCodeStatus__c: 'Active',
  APHA_CPHType__c: 'Permanent',
  APHA_PreviousCPHNumber__c: null,
  APHA_TemporaryCPHNumber__c: null,
  APHA_Location__c: 'location-id',
}

function mockRecord(record) {
  findOne.mockResolvedValue(record)
  vi.mocked(getSalesforceConnection).mockResolvedValue({ sobject })
}

describe('#getCph', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should return the CPH details', async () => {
    mockRecord(salesforceRecord)

    await expect(getCph(cphNumber)).resolves.toEqual({
      id: 'cph-id',
      cphCode: cphNumber,
      cphCodeShort: '010010006',
      startDate: '2020-01-01',
      endDate: null,
      status: 'Active',
      type: 'Permanent',
      previousCphNumber: null,
      temporaryCphNumber: null,
      locationId: 'location-id',
    })
  })

  test('Should look up APHA_CPH__c by Name', async () => {
    mockRecord(salesforceRecord)

    await getCph(cphNumber)

    expect(sobject).toHaveBeenCalledWith('APHA_CPH__c')
    expect(findOne).toHaveBeenCalledWith(
      { Name: cphNumber },
      expect.arrayContaining(['Id', 'Name']),
    )
  })

  test('Should throw when the CPH is not found', async () => {
    mockRecord(null)

    await expect(getCph(cphNumber)).rejects.toThrow(`CPH not found: ${cphNumber}`)
  })
})
