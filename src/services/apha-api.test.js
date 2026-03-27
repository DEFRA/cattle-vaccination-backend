import { config } from '../config.js'
import { aphaRequest } from './apha-api.js'

vi.mock('./cognito-auth.js', () => ({
  getCognitoToken: vi.fn().mockResolvedValue('mock-bearer-token')
}))

describe('#aphaRequest', () => {
  beforeEach(() => {
    config.set('apha.apiBaseUrl', 'https://api.apha.example.com')
    config.set('cdp.devApiKey', null)
    config.set('cdpEnvironment', 'dev')
  })

  afterEach(() => {
    config.set('apha.apiBaseUrl', null)
    config.set('cdp.devApiKey', null)
    config.set('cdpEnvironment', 'local')
  })

  test('Should make GET request with bearer token', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ data: [] }))

    await aphaRequest('/workorders')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.apha.example.com/workorders')
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer mock-bearer-token')
  })

  test('Should make POST request with JSON body', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ holdings: [] }))

    await aphaRequest('/holdings/find', 'POST', { ids: ['12/345/6789'] })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ ids: ['12/345/6789'] }))
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  test('Should return parsed JSON response', async () => {
    const mockData = { data: [{ id: 1 }] }
    fetchMock.mockResponseOnce(JSON.stringify(mockData))

    const result = await aphaRequest('/workorders')

    expect(result).toEqual(mockData)
  })

  test('Should include x-api-key header when devApiKey is set and env is local', async () => {
    config.set('cdp.devApiKey', 'my-dev-key')
    config.set('cdpEnvironment', 'local')
    fetchMock.mockResponseOnce(JSON.stringify({}))

    await aphaRequest('/workorders')

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['x-api-key']).toBe('my-dev-key')
  })

  test('Should not include x-api-key header in non-local environments', async () => {
    config.set('cdp.devApiKey', 'my-dev-key')
    config.set('cdpEnvironment', 'dev')
    fetchMock.mockResponseOnce(JSON.stringify({}))

    await aphaRequest('/workorders')

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['x-api-key']).toBeUndefined()
  })

  test('Should throw when apiBaseUrl is not configured', async () => {
    config.set('apha.apiBaseUrl', null)

    await expect(aphaRequest('/workorders')).rejects.toThrow(
      'Missing required config: APHA_API_BASE_URL'
    )
  })

  test('Should throw on non-ok response', async () => {
    fetchMock.mockResponseOnce('Not Found', { status: 404 })

    await expect(aphaRequest('/workorders')).rejects.toThrow(
      'APHA API error 404: Not Found'
    )
  })
})
