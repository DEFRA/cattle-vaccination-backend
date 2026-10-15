import { config } from '../../config.js'
import { getSalesforceConnection } from './index.js'

describe('Salesforce connection', () => {
  afterEach(() => {
    config.set('salesforce.url', 'http://localhost/salesforce')
    config.set('salesforce.clientId', 'test-salesforce-client-id')
    config.set('salesforce.clientSecret', 'test-salesforce-client-secret')
  })

  test('Should throw when auth config is missing', async () => {
    config.set('salesforce.clientId', null)

    await expect(getSalesforceConnection()).rejects.toThrow(
      'Missing required config: SALESFORCE_URL, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET',
    )
  })

  test('Should throw when salesforce URL is missing', async () => {
    config.set('salesforce.url', null)

    await expect(getSalesforceConnection()).rejects.toThrow(
      'Missing required config: SALESFORCE_URL, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET',
    )
  })
})
