import { getCph } from './cphs.js'
import { query } from './index.js'

vi.mock('./index.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    query: vi.fn(),
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

describe('#getCph', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should return the CPH details', async () => {
    vi.mocked(query).mockResolvedValue({ records: [salesforceRecord] })

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

  test('Should query APHA_CPH__c by Name', async () => {
    vi.mocked(query).mockResolvedValue({ records: [salesforceRecord] })

    await getCph(cphNumber)

    expect(query).toHaveBeenCalledWith(expect.stringContaining(`Name='${cphNumber}'`))
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM APHA_CPH__c'))
  })

  test('Should throw when the CPH is not found', async () => {
    vi.mocked(query).mockResolvedValue({ records: [] })

    await expect(getCph(cphNumber)).rejects.toThrow(`CPH not found: ${cphNumber}`)
  })
})
