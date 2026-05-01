import { config } from '../config.js'
import { getWorkorders, findHoldings } from './apha-api.js'

vi.mock('./cognito-auth.js', () => ({
  getCognitoToken: vi.fn().mockResolvedValue('mock-bearer-token')
}))

describe('#getWorkorders', () => {
  beforeEach(() => {
    config.set('apha.apiBaseUrl', 'https://api.apha.example.com')
    config.set('cdp.devApiKey', null)
    config.set('cdpEnvironment', 'dev')
  })

  afterEach(() => {
    config.set('apha.apiBaseUrl', null)
    config.set('cdp.devApiKey', null)
    config.set('cdpEnvironment', 'dev')
  })

  test('Should make GET request with bearer token', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ data: [] }))

    await getWorkorders({
      startDate: '2026-01-01',
      endDate: '2026-03-27',
      country: 'England'
    })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://api.apha.example.com/workorders?startActivationDate=2026-01-01T00:00:00.000Z&endActivationDate=2026-03-27T00:00:00.000Z&country=England'
    )
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer mock-bearer-token')
  })

  test('Should return parsed JSON response', async () => {
    const mockData = { data: [{ id: 1 }] }
    fetchMock.mockResponseOnce(JSON.stringify(mockData))

    const result = await getWorkorders({
      startDate: '2026-01-01',
      endDate: '2026-03-27',
      country: 'England'
    })

    expect(result).toEqual(mockData)
  })

  test('Should include x-api-key header when devApiKey is set and env is local', async () => {
    config.set('cdp.devApiKey', 'my-dev-key')
    config.set('cdpEnvironment', 'local')
    fetchMock.mockResponseOnce(JSON.stringify({}))

    await getWorkorders({
      startDate: '2026-01-01',
      endDate: '2026-03-27',
      country: 'England'
    })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['x-api-key']).toBe('my-dev-key')
  })

  test('Should not include x-api-key header when devApiKey is null in local env', async () => {
    config.set('cdpEnvironment', 'local')
    fetchMock.mockResponseOnce(JSON.stringify({}))

    await getWorkorders({
      startDate: '2026-01-01',
      endDate: '2026-03-27',
      country: 'England'
    })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['x-api-key']).toBeUndefined()
  })

  test('Should not include x-api-key header in non-local environments', async () => {
    config.set('cdp.devApiKey', 'my-dev-key')
    config.set('cdpEnvironment', 'dev')
    fetchMock.mockResponseOnce(JSON.stringify({}))

    await getWorkorders({
      startDate: '2026-01-01',
      endDate: '2026-03-27',
      country: 'England'
    })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['x-api-key']).toBeUndefined()
  })

  test('Should throw when apiBaseUrl is not configured', async () => {
    config.set('apha.apiBaseUrl', null)

    await expect(
      getWorkorders({
        startDate: '2026-01-01',
        endDate: '2026-03-27',
        country: 'England'
      })
    ).rejects.toThrow('Missing required config: APHA_API_BASE_URL')
  })

  test('Should throw on non-ok response', async () => {
    fetchMock.mockResponseOnce('Not Found', { status: 404 })

    await expect(
      getWorkorders({
        startDate: '2026-01-01',
        endDate: '2026-03-27',
        country: 'England'
      })
    ).rejects.toThrow('APHA API error 404')
  })
})

describe('#findHoldings', () => {
  beforeEach(() => {
    config.set('apha.apiBaseUrl', 'https://api.apha.example.com')
    config.set('cdp.devApiKey', null)
    config.set('cdpEnvironment', 'dev')
  })

  afterEach(() => {
    config.set('apha.apiBaseUrl', null)
    config.set('cdp.devApiKey', null)
    config.set('cdpEnvironment', 'dev')
  })

  test('Should make POST request with JSON body', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ holdings: [] }))

    await findHoldings({ ids: ['12/345/6789'] })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.apha.example.com/holdings/find')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ ids: ['12/345/6789'] }))
    expect(options.headers['Content-Type']).toBe('application/json')
  })
})
