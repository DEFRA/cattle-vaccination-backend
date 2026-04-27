import { config } from '../../config.js'
import {
  clearTokenCache,
  query,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  composite
} from './index.js'

const validTokenResponse = {
  access_token: 'mock-sf-token',
  instance_url: 'https://instance.salesforce.example.com',
  expires_in: 3600
}

function mockTokenThenResponse(apiResponse, options = {}) {
  fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))
  fetchMock.mockResponseOnce(JSON.stringify(apiResponse), options)
}

describe('Salesforce service', () => {
  beforeEach(() => {
    clearTokenCache()
    config.set('salesforce.url', 'https://login.salesforce.example.com')
    config.set('salesforce.clientId', 'test-client-id')
    config.set('salesforce.clientSecret', 'test-client-secret')
  })

  afterEach(() => {
    config.set('salesforce.url', 'http://localhost/salesforce')
    config.set('salesforce.clientId', 'test-salesforce-client-id')
    config.set('salesforce.clientSecret', 'test-salesforce-client-secret')
  })

  describe('#token', () => {
    test('Should fetch token with client_credentials grant', async () => {
      mockTokenThenResponse({ records: [] })

      await query('SELECT Id FROM Case LIMIT 1')

      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe(
        'https://login.salesforce.example.com/services/oauth2/token'
      )
      expect(options.method).toBe('POST')
      const body = new URLSearchParams(options.body)
      expect(body.get('grant_type')).toBe('client_credentials')
      expect(body.get('client_id')).toBe('test-client-id')
      expect(body.get('client_secret')).toBe('test-client-secret')
    })

    test('Should cache token on subsequent calls', async () => {
      fetchMock.mockResponse(JSON.stringify(validTokenResponse))

      await query('SELECT Id FROM Case LIMIT 1')
      fetchMock.mockResponseOnce(JSON.stringify({ records: [] }))
      await query('SELECT Id FROM Case LIMIT 1')

      const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
        url.includes('/oauth2/token')
      )
      expect(tokenCalls).toHaveLength(1)
    })

    test('Should throw when auth config is missing', async () => {
      config.set('salesforce.clientId', null)

      await expect(query('SELECT Id FROM Case')).rejects.toThrow(
        'Missing required config: SALESFORCE_URL, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET'
      )
    })

    test('Should throw on non-ok auth response', async () => {
      fetchMock.mockResponseOnce('Unauthorized', { status: 401 })

      await expect(query('SELECT Id FROM Case')).rejects.toThrow(
        'Salesforce auth error 401'
      )
    })

    test('Should fetch new token after cache is cleared', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))
      fetchMock.mockResponseOnce(JSON.stringify({ records: [] }))
      await query('SELECT Id FROM Case LIMIT 1')

      clearTokenCache()

      fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))
      fetchMock.mockResponseOnce(JSON.stringify({ records: [] }))
      await query('SELECT Id FROM Case LIMIT 1')

      const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
        url.includes('/oauth2/token')
      )
      expect(tokenCalls).toHaveLength(2)
    })

    test('Should throw when salesforce URL is missing', async () => {
      config.set('salesforce.url', null)

      await expect(query('SELECT Id FROM Case')).rejects.toThrow(
        'Missing required config: SALESFORCE_URL'
      )
    })
  })

  describe('#query', () => {
    test('Should make GET request with encoded SOQL', async () => {
      mockTokenThenResponse({ records: [] })

      await query("SELECT Id FROM Case WHERE Name='foo' LIMIT 1")

      const [url, options] = fetchMock.mock.calls[1]
      expect(url).toBe(
        "https://instance.salesforce.example.com/services/data/v62.0/query?q=SELECT%20Id%20FROM%20Case%20WHERE%20Name%3D'foo'%20LIMIT%201"
      )
      expect(options.method).toBe('GET')
      expect(options.headers.Authorization).toBe('Bearer mock-sf-token')
    })

    test('Should return parsed JSON response', async () => {
      const mockData = { records: [{ Id: 'abc123' }] }
      mockTokenThenResponse(mockData)

      const result = await query('SELECT Id FROM Case LIMIT 1')

      expect(result).toEqual(mockData)
    })

    test('Should throw on non-ok response', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))
      fetchMock.mockResponseOnce('Not Found', { status: 404 })

      await expect(query('SELECT Id FROM Case')).rejects.toThrow(
        'Salesforce API error 404'
      )
    })
  })

  describe('#getRecord', () => {
    test('Should make GET request to sobject endpoint', async () => {
      mockTokenThenResponse({ Id: 'abc123', Name: 'Test' })

      await getRecord('Case', 'abc123')

      const [url, options] = fetchMock.mock.calls[1]
      expect(url).toBe(
        'https://instance.salesforce.example.com/services/data/v62.0/sobjects/Case/abc123'
      )
      expect(options.method).toBe('GET')
    })
  })

  describe('#createRecord', () => {
    test('Should make POST request with JSON body', async () => {
      mockTokenThenResponse({ id: 'new-id', success: true })

      await createRecord('Case', { Status: 'New', Priority: 'Medium' })

      const [url, options] = fetchMock.mock.calls[1]
      expect(url).toBe(
        'https://instance.salesforce.example.com/services/data/v62.0/sobjects/Case'
      )
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body)).toEqual({
        Status: 'New',
        Priority: 'Medium'
      })
    })

    test('Should return parsed response', async () => {
      const mockData = { id: 'new-id', success: true }
      mockTokenThenResponse(mockData)

      const result = await createRecord('Case', { Status: 'New' })

      expect(result).toEqual(mockData)
    })
  })

  describe('#updateRecord', () => {
    test('Should make PATCH request to sobject endpoint and return null for 204', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

      const result = await updateRecord('Case', 'abc123', { Status: 'Closed' })

      const [url, options] = fetchMock.mock.calls[1]
      expect(url).toBe(
        'https://instance.salesforce.example.com/services/data/v62.0/sobjects/Case/abc123'
      )
      expect(options.method).toBe('PATCH')
      expect(JSON.parse(options.body)).toEqual({ Status: 'Closed' })
      expect(result).toBeNull()
    })
  })

  describe('#deleteRecord', () => {
    test('Should make DELETE request to sobject endpoint and return null for 204', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

      const result = await deleteRecord('Case', 'abc123')

      const [url, options] = fetchMock.mock.calls[1]
      expect(url).toBe(
        'https://instance.salesforce.example.com/services/data/v62.0/sobjects/Case/abc123'
      )
      expect(options.method).toBe('DELETE')
      expect(result).toBeNull()
    })
  })

  describe('#composite', () => {
    test('Should POST to composite endpoint with allOrNone: true', async () => {
      const mockResponse = { compositeResponse: [] }
      mockTokenThenResponse(mockResponse)

      const subRequests = [
        {
          method: 'GET',
          referenceId: 'Foo',
          url: '/services/data/v62.0/query?q=SELECT+Id+FROM+Case'
        }
      ]
      await composite(subRequests)

      const [url, options] = fetchMock.mock.calls[1]
      expect(url).toBe(
        'https://instance.salesforce.example.com/services/data/v62.0/composite'
      )
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body)
      expect(body.allOrNone).toBe(true)
      expect(body.compositeRequest).toEqual(subRequests)
    })

    test('Should return the composite response body', async () => {
      const mockResponse = {
        compositeResponse: [
          { referenceId: 'Foo', httpStatusCode: 200, body: {} }
        ]
      }
      mockTokenThenResponse(mockResponse)

      const result = await composite([])

      expect(result).toEqual(mockResponse)
    })
  })
})
