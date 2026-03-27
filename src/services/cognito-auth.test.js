import { config } from '../config.js'
import { getCognitoToken, clearTokenCache } from './cognito-auth.js'

const validTokenResponse = {
  access_token: 'mock-access-token',
  expires_in: 3600
}

describe('#getCognitoToken', () => {
  beforeEach(() => {
    clearTokenCache()
    config.set('apha.cognitoClientId', 'test-client-id')
    config.set('apha.cognitoClientSecret', 'test-client-secret')
    config.set('apha.cognitoUrl', 'https://cognito.example.com/oauth2/token')
  })

  afterEach(() => {
    config.set('apha.cognitoClientId', null)
    config.set('apha.cognitoClientSecret', null)
    config.set('apha.cognitoUrl', null)
  })

  test('Should fetch and return token', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))

    const token = await getCognitoToken()

    expect(token).toBe('mock-access-token')
  })

  test('Should send Basic auth header with base64-encoded credentials', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))

    await getCognitoToken()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://cognito.example.com/oauth2/token')
    expect(options.headers.Authorization).toBe(
      'Basic dGVzdC1jbGllbnQtaWQ6dGVzdC1jbGllbnQtc2VjcmV0'
    )
  })

  test('Should send client_credentials grant type in body', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))

    await getCognitoToken()

    const [, options] = fetchMock.mock.calls[0]
    const body = new URLSearchParams(options.body)
    expect(body.get('grant_type')).toBe('client_credentials')
    expect(body.get('client_id')).toBe('test-client-id')
    expect(body.get('client_secret')).toBe('test-client-secret')
  })

  test('Should return cached token on subsequent calls', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(validTokenResponse))

    await getCognitoToken()
    await getCognitoToken()

    expect(fetchMock.mock.calls).toHaveLength(1)
  })

  test('Should fetch new token when cache is cleared', async () => {
    fetchMock.mockResponse(JSON.stringify(validTokenResponse))

    await getCognitoToken()
    clearTokenCache()
    await getCognitoToken()

    expect(fetchMock.mock.calls).toHaveLength(2)
  })

  test('Should throw when Cognito config is missing', async () => {
    config.set('apha.cognitoClientId', null)

    await expect(getCognitoToken()).rejects.toThrow(
      'Missing required config: COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET, APHA_COGNITO_URL'
    )
  })

  test('Should throw when Cognito returns non-ok response', async () => {
    fetchMock.mockResponseOnce('Unauthorized', { status: 401 })

    await expect(getCognitoToken()).rejects.toThrow(
      'Failed to fetch Cognito token: 401 Unauthorized'
    )
  })
})
