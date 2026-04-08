import { config } from '../config.js'
import { getCattleOnHolding } from './livestock-api.js'

describe('#getCattleOnHolding', () => {
  beforeEach(() => {
    config.set('livestock.apiBaseUrl', 'https://api.livestock.example.com')
    config.set('livestock.apiToken', 'mock-token')
  })

  afterEach(() => {
    config.set('livestock.apiBaseUrl', null)
    config.set('livestock.apiToken', null)
  })

  test('Should make GET request with bearer token', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ data: [] }))

    await getCattleOnHolding({ holdingId: '12/345/6789' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://api.livestock.example.com/cattle-on-holding?LocationID=12%2F345%2F6789&IncludeDeadAnimals=N'
    )
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer mock-token')
  })

  test('Should return parsed JSON response', async () => {
    const mockData = { data: [{ id: 'ABC123' }] }
    fetchMock.mockResponseOnce(JSON.stringify(mockData))

    const result = await getCattleOnHolding({ holdingId: '12/345/6789' })

    expect(result).toEqual(mockData)
  })

  test('Should throw on non-ok response', async () => {
    fetchMock.mockResponseOnce('Not Found', { status: 404 })

    await expect(
      getCattleOnHolding({ holdingId: '12/345/6789' })
    ).rejects.toThrow('Livestock API error 404: Not Found')
  })
})
