import { Buffer } from 'node:buffer'
import { config } from '../config.js'

let cachedToken = null
let tokenExpiresAt = null
let tokenRefreshPromise = null

async function fetchNewToken() {
  const clientId = config.get('apha.cognitoClientId')
  const clientSecret = config.get('apha.cognitoClientSecret')
  const cognitoUrl = config.get('apha.cognitoUrl')

  if (!clientId || !clientSecret || !cognitoUrl) {
    throw new Error(
      'Missing required config: COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET, APHA_COGNITO_URL'
    )
  }

  const encodedCredentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString('base64')

  const response = await fetch(cognitoUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodedCredentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials'
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Cognito token: ${response.status}`)
  }

  const data = await response.json()
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000

  return cachedToken
}

export async function getCognitoToken() {
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  if (!tokenRefreshPromise) {
    tokenRefreshPromise = fetchNewToken().finally(() => {
      tokenRefreshPromise = null
    })
  }

  return tokenRefreshPromise
}

export function clearTokenCache() {
  cachedToken = null
  tokenExpiresAt = null
  tokenRefreshPromise = null
}
