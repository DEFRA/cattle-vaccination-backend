import { ProxyAgent } from 'undici'
import { config } from '../config.js'

async function livestockRequest(
  path,
  method = 'GET',
  body = undefined,
  options = {}
) {
  const apiBaseUrl = config.get('livestock.apiBaseUrl')
  const token = config.get('livestock.apiToken')
  const proxyUrl = config.get('httpProxy')
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

  const response = await fetch(
    `${apiBaseUrl}${path}`,
    /** @type {RequestInit} */ ({
      ...options,
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'identity',
        ...options.headers
      },
      ...(dispatcher ? { dispatcher } : {})
    })
  )

  if (!response.ok) {
    throw new Error(`Livestock API error ${response.status}`)
  }

  return response.json()
}

export async function getCattleOnHolding({ holdingId }) {
  return livestockRequest(
    `/cattle-on-holding?LocationID=${encodeURIComponent(holdingId)}&IncludeDeadAnimals=N`
  )
}
