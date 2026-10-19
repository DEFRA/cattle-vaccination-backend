import { getWorkOrders } from './work-orders.js'
import { getSalesforceConnection } from './index.js'

const sort = vi.fn()
const find = vi.fn(() => ({ sort }))
const sobject = vi.fn(() => ({ find }))

vi.mock('./index.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getSalesforceConnection: vi.fn(),
  }
})

const salesforceRecord = {
  Name: 'CV WorkOrder 2',
  CV_CPH__r: {
    Name: '40/715/9200',
    APHA_CPHCode__c: '40/715/9200',
    APHA_Location__r: {
      Name: 'Hill Farm',
      VisitorAddress: {
        Street: '1 Farm Lane',
        City: 'Exeter',
        State: 'Devon',
        PostalCode: 'EX1 1AA',
        Country: 'United Kingdom',
      },
    },
  },
}

describe('#getWorkOrders', () => {
  beforeEach(() => {
    vi.mocked(getSalesforceConnection).mockResolvedValue({ sobject })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should return a card for each work order', async () => {
    sort.mockResolvedValue([salesforceRecord])

    await expect(getWorkOrders()).resolves.toEqual([
      {
        id: 'CV WorkOrder 2',
        title: 'Hill Farm - 40/715/9200',
        cphName: 'Hill Farm',
        cphCode: '40/715/9200',
        cphNumber: '407159200',
        address: '1 Farm Lane, Exeter, Devon, EX1 1AA, United Kingdom',
      },
    ])
  })

  test('Should use the CPH code as the title when the holding has no location name', async () => {
    sort.mockResolvedValue([
      {
        Name: 'CV WorkOrder 3',
        CV_CPH__r: {
          Name: '02/582/7575',
          APHA_CPHCode__c: '02/582/7575',
          APHA_Location__r: null,
        },
      },
    ])

    const [workOrder] = await getWorkOrders()

    expect(workOrder).toMatchObject({
      title: '02/582/7575',
      cphName: null,
      cphCode: '02/582/7575',
      cphNumber: '025827575',
      address: null,
    })
  })

  test('Should look up every work order with the card fields', async () => {
    sort.mockResolvedValue([])

    await getWorkOrders()

    expect(sobject).toHaveBeenCalledWith('CV_WorkOrder__c')
    expect(find).toHaveBeenCalledWith(
      {},
      expect.arrayContaining([
        'Name',
        'CV_CPH__r.Name',
        'CV_CPH__r.APHA_CPHCode__c',
        'CV_CPH__r.APHA_Location__r.Name',
        'CV_CPH__r.APHA_Location__r.VisitorAddress.Street',
      ]),
    )
    expect(sort).toHaveBeenCalledWith('Name')
  })
})
