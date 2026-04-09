import { ProxyAgent } from 'undici'
import { config } from '../config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

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

  const url = `${apiBaseUrl}${path}`
  logger.info(
    { url, method, usingProxy: Boolean(proxyUrl) },
    'Livestock API request'
  )

  let response
  try {
    response = await fetch(
      url,
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
  } catch (err) {
    logger.error(
      {
        err,
        cause: err.cause,
        url,
        usingProxy: Boolean(proxyUrl),
        proxyUrl: proxyUrl ?? null
      },
      'Livestock API fetch failed'
    )
    throw err
  }

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
