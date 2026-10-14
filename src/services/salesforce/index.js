import { Connection } from 'jsforce'
import { config } from '../../config.js'

const SF_API_VERSION = 'v62.0'
export const SF_API_PATH = `/services/data/${SF_API_VERSION}`

let cachedToken = null
let cachedInstanceUrl = null
let refreshTokenAt = null
let tokenRefreshPromise = null
let salesforceConnectionPromise = null

function salesforceCredentials() {
  const loginUrl = config.get('salesforce.url')
  const clientId = config.get('salesforce.clientId')
  const clientSecret = config.get('salesforce.clientSecret')

  if (!loginUrl || !clientId || !clientSecret) {
    throw new Error(
      'Missing required config: SALESFORCE_URL, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET',
    )
  }

  return { loginUrl, clientId, clientSecret }
}

// Cases and test parts still authenticate through this fetch. Once they use the shared jsforce connection, this can go.
async function fetchNewToken() {
  const { loginUrl, clientId, clientSecret } = salesforceCredentials()

  const response = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    throw new Error(`Salesforce auth error ${response.status}`)
  }

  const data = await response.json()
  cachedToken = data.access_token
  cachedInstanceUrl = data.instance_url
  refreshTokenAt = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000
  return { token: cachedToken, instanceUrl: cachedInstanceUrl }
}

async function getSalesforceToken() {
  if (cachedToken && cachedInstanceUrl && refreshTokenAt && Date.now() < refreshTokenAt) {
    return { token: cachedToken, instanceUrl: cachedInstanceUrl }
  }

  if (!tokenRefreshPromise) {
    tokenRefreshPromise = fetchNewToken().finally(() => {
      tokenRefreshPromise = null
    })
  }

  return tokenRefreshPromise
}

function createSalesforceConnection() {
  const { loginUrl, clientId, clientSecret } = salesforceCredentials()

  return new Connection({
    oauth2: {
      loginUrl,
      clientId,
      clientSecret,
    },
    version: SF_API_VERSION.slice(1),
    refreshFn: async (connection, callback) => {
      try {
        await connection.authorize({ grant_type: 'client_credentials' })

        if (!connection.accessToken) {
          throw new Error('Salesforce client_credentials authorize error')
        }

        callback(null, connection.accessToken)
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)))
      }
    },
  })
}

export function getSalesforceConnection() {
  if (!salesforceConnectionPromise) {
    const connection = createSalesforceConnection()
    salesforceConnectionPromise = connection
      .authorize({ grant_type: 'client_credentials' })
      .then(() => connection)
      .catch((error) => {
        salesforceConnectionPromise = null
        throw error
      })
  }

  return salesforceConnectionPromise
}

export function clearTokenCache() {
  cachedToken = null
  cachedInstanceUrl = null
  refreshTokenAt = null
  tokenRefreshPromise = null
  salesforceConnectionPromise = null
}

async function sfRequest(path, method = 'GET', body = undefined) {
  const { token, instanceUrl } = await getSalesforceToken()

  const response = await fetch(`${instanceUrl}/services/data/${SF_API_VERSION}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

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
    compositeRequest,
  })
}

export async function compositeGraph(graphs) {
  return sfRequest('/composite/graph', 'POST', { graphs })
}

export function getSalesforceApiErrorFromCompositeResponse(compositeResponse) {
  const usefulErrorChunk = compositeResponse.find(
    (errorChunk) => errorChunk.body[0].errorCode !== 'PROCESSING_HALTED',
  )
  let errorMessage = 'Unknown reason'

  if (usefulErrorChunk) {
    errorMessage = usefulErrorChunk.body[0].message
  }

  return errorMessage
}
