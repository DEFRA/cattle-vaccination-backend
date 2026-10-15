import { Connection } from 'jsforce'
import { config } from '../../config.js'

const SF_API_VERSION = 'v62.0'

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

async function authorizeSalesforceConnection() {
  const connection = createSalesforceConnection()

  try {
    await connection.authorize({ grant_type: 'client_credentials' })
    return connection
  } catch (error) {
    salesforceConnectionPromise = null
    throw error
  }
}

export function getSalesforceConnection() {
  if (!salesforceConnectionPromise) {
    salesforceConnectionPromise = authorizeSalesforceConnection()
  }

  return salesforceConnectionPromise
}
