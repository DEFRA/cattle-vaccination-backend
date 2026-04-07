import { config } from '../config.js'

async function livestockRequest(
  path,
  method = 'GET',
  body = undefined,
  options = {}
) {
  const apiBaseUrl = config.get('livestock.apiBaseUrl')
  const token = config.get('livestock.apiToken')

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Encoding': 'identity',
      ...options.headers
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Livestock API error ${response.status}: ${error}`)
  }

  return response.json()
}

export async function getCattleOnHolding({ holdingId }) {
  return livestockRequest(
    `/cattle-on-holding?LocationID=${encodeURIComponent(holdingId)}&IncludeDeadAnimals=N`
  )
}
