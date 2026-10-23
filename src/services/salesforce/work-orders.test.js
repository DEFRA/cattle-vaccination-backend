import { createWorkList, getWorkOrder, getWorkOrders } from './work-orders.js'
import { getSalesforceConnection } from './index.js'

const sort = vi.fn()
const find = vi.fn(() => ({ sort }))
const findOne = vi.fn()
const requestPost = vi.fn()
const sobject = vi.fn(() => ({ find, findOne }))

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
    APHA_CPHCodeStartDate__c: '2020-01-01',
    APHA_CPHCodeEndDate__c: null,
    APHA_CPHCodeStatus__c: 'Active',
    APHA_CPHType__c: 'Permanent',
    APHA_PreviousCPHNumber__c: null,
    APHA_TemporaryCPHNumber__c: null,
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

  test('Should drop a trailing comma already stored on the street', async () => {
    sort.mockResolvedValue([
      {
        Name: 'CV WorkOrder 1',
        CV_CPH__r: {
          Name: '06/036/0006',
          APHA_CPHCode__c: '06/036/0006',
          APHA_Location__r: {
            Name: 'Odds Farm Park',
            VisitorAddress: {
              Street: 'Odds Farm Park, Wooburn Common Rd, Wooburn Green,',
              City: 'High Wycombe',
              PostalCode: 'HP10 0LX',
            },
          },
        },
      },
    ])

    const [workOrder] = await getWorkOrders()

    expect(workOrder.address).toBe(
      'Odds Farm Park, Wooburn Common Rd, Wooburn Green, High Wycombe, HP10 0LX',
    )
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

describe('#getWorkOrder', () => {
  beforeEach(() => {
    vi.mocked(getSalesforceConnection).mockResolvedValue({ sobject })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should return the CPH name and work lists', async () => {
    findOne.mockResolvedValue(salesforceRecord)
    sort.mockResolvedValue([
      { Name: 'CV WorkList 2', CV_CPH__r: salesforceRecord.CV_CPH__r },
      {
        Name: 'CV WorkList 9',
        CV_CPH__r: { Name: '02/582/7575', APHA_CPHCode__c: '02/582/7575' },
      },
    ])

    await expect(getWorkOrder('CV WorkOrder 2')).resolves.toEqual({
      id: 'CV WorkOrder 2',
      cph: {
        id: '407159200',
        displayName: '40/715/9200',
        cphCode: '40/715/9200',
        startDate: '2020-01-01',
        endDate: null,
        status: 'Active',
        type: 'Permanent',
        previousCphNumber: null,
        temporaryCphNumber: null,
        locationName: 'Hill Farm',
        address: '1 Farm Lane, Exeter, Devon, EX1 1AA, United Kingdom',
      },
      workLists: [
        { id: 'CV WorkList 2', cphName: 'Hill Farm', cphCode: '40/715/9200' },
        { id: 'CV WorkList 9', cphName: null, cphCode: '02/582/7575' },
      ],
    })

    expect(sobject).toHaveBeenCalledWith('CV_WorkOrder__c')
    expect(findOne).toHaveBeenCalledWith(
      { Name: 'CV WorkOrder 2' },
      expect.arrayContaining([
        'CV_CPH__r.APHA_CPHCodeStartDate__c',
        'CV_CPH__r.APHA_CPHCodeStatus__c',
        'CV_CPH__r.APHA_Location__r.VisitorAddress.Street',
      ]),
    )
    expect(sobject).toHaveBeenCalledWith('CV_WorkList__c')
    expect(find).toHaveBeenCalledWith({ 'CV_Work_Order__r.Name': 'CV WorkOrder 2' }, [
      'Name',
      'CV_CPH__r.Name',
      'CV_CPH__r.APHA_CPHCode__c',
      'CV_CPH__r.APHA_Location__r.Name',
    ])
    expect(sort).toHaveBeenCalledWith('Name')
  })

  test('Should throw when the work order does not exist', async () => {
    findOne.mockResolvedValue(null)

    await expect(getWorkOrder('CV WorkOrder 99')).rejects.toThrow(
      'Work order not found: CV WorkOrder 99',
    )
    expect(find).not.toHaveBeenCalled()
  })
})

describe('#createWorkList', () => {
  beforeEach(() => {
    vi.mocked(getSalesforceConnection).mockResolvedValue({ sobject, requestPost })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should start the flow with the work order Salesforce id', async () => {
    findOne.mockResolvedValue({ Id: 'a0B000000000001' })
    requestPost.mockResolvedValue([
      {
        isSuccess: true,
        outputValues: {
          isSuccess: true,
          WorkListId: 'a0W000000000001',
          responseMessage: 'Worklist created Successfully',
        },
      },
    ])

    await expect(createWorkList('CV WorkOrder 2')).resolves.toEqual({ id: 'a0W000000000001' })
    expect(findOne).toHaveBeenCalledWith({ Name: 'CV WorkOrder 2' }, ['Id'])
    expect(requestPost).toHaveBeenCalledWith(
      '/actions/custom/flow/Fetch_and_Create_Commodity_Animals',
      { inputs: [{ recordId: 'a0B000000000001' }] },
    )
  })

  test('Should throw the flow message when Salesforce rejects the interview', async () => {
    findOne.mockResolvedValue({ Id: 'a0B000000000001' })
    requestPost.mockResolvedValue([
      {
        isSuccess: true,
        outputValues: {
          isSuccess: false,
          responseMessage: 'CPH is missing from WorkOrder',
        },
      },
    ])

    await expect(createWorkList('CV WorkOrder 2')).rejects.toThrow('CPH is missing from WorkOrder')
  })

  test('Should throw when the work order does not exist', async () => {
    findOne.mockResolvedValue(null)

    await expect(createWorkList('CV WorkOrder 99')).rejects.toThrow(
      'Work order not found: CV WorkOrder 99',
    )
    expect(requestPost).not.toHaveBeenCalled()
  })
})
