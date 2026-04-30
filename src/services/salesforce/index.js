import { config } from '../../config.js'

const SF_API_VERSION = 'v62.0'
export const SF_API_PATH = `/services/data/${SF_API_VERSION}`

let cachedToken = null
let cachedInstanceUrl = null
let tokenExpiresAt = null
let tokenRefreshPromise = null

async function fetchNewToken() {
  const salesforceUrl = config.get('salesforce.url')
  const clientId = config.get('salesforce.clientId')
  const clientSecret = config.get('salesforce.clientSecret')

  if (!salesforceUrl || !clientId || !clientSecret) {
    throw new Error(
      'Missing required config: SALESFORCE_URL, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET'
    )
  }

  const response = await fetch(`${salesforceUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    })
  })

  if (!response.ok) {
    throw new Error(`Salesforce auth error ${response.status}`)
  }

  const data = await response.json()
  cachedToken = data.access_token
  cachedInstanceUrl = data.instance_url
  tokenExpiresAt = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000
  return { token: cachedToken, instanceUrl: cachedInstanceUrl }
}

async function getSalesforceToken() {
  if (
    cachedToken &&
    cachedInstanceUrl &&
    tokenExpiresAt &&
    Date.now() < tokenExpiresAt
  ) {
    return { token: cachedToken, instanceUrl: cachedInstanceUrl }
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
  cachedInstanceUrl = null
  tokenExpiresAt = null
  tokenRefreshPromise = null
}

async function sfRequest(path, method = 'GET', body = undefined) {
  const { token, instanceUrl } = await getSalesforceToken()

  const response = await fetch(
    `${instanceUrl}/services/data/${SF_API_VERSION}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    }
  )

  if (response.status === 204) return null

  if (!response.ok) {
    throw new Error(`Salesforce API error ${response.status}`)
  }

  return response.json()
}

export async function query(soql) {
  return sfRequest(`/query?q=${encodeURIComponent(soql)}`)
}

export async function getRecord(type, id) {
  return sfRequest(`/sobjects/${type}/${id}`)
}

export async function createRecord(type, data) {
  return sfRequest(`/sobjects/${type}`, 'POST', data)
}

export async function updateRecord(type, id, data) {
  return sfRequest(`/sobjects/${type}/${id}`, 'PATCH', data)
}

export async function deleteRecord(type, id) {
  return sfRequest(`/sobjects/${type}/${id}`, 'DELETE')
}

export async function composite(compositeRequest) {
  return sfRequest('/composite', 'POST', {
    allOrNone: true,
    compositeRequest
  })
}

export async function compositeGraph(graphs) {
  return sfRequest('/composite/graph', 'POST', { graphs })
}
