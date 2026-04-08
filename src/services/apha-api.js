import { config } from '../config.js'
import { getCognitoToken } from './cognito-auth.js'

async function aphaRequest(
  path,
  method = 'GET',
  body = undefined,
  options = {}
) {
  const apiBaseUrl = config.get('apha.apiBaseUrl')

  if (!apiBaseUrl) {
    throw new Error('Missing required config: APHA_API_BASE_URL')
  }

  const token = await getCognitoToken()
  const env = config.get('cdpEnvironment')

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Encoding': 'identity',
      ...(env === 'local' && { 'x-api-key': config.get('cdp.devApiKey') }),
      ...options.headers
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`APHA API error ${response.status}: ${error}`)
  }

  return response.json()
}

export async function getWorkorders({ startDate, endDate, country }) {
  return aphaRequest(
    `/workorders?startActivationDate=${startDate}T00:00:00.000Z&endActivationDate=${endDate}T00:00:00.000Z&country=${encodeURIComponent(country)}`
  )
}

export async function findHoldings({ ids }) {
  return aphaRequest('/holdings/find', 'POST', { ids })
}
