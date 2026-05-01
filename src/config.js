import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

convict.addFormats(convictFormatWithValidator)

convict.addFormat({
  name: 'required-string',
  validate: (val) => {
    if (!val) {
      throw new Error('Required value cannot be empty')
    }
  },
  coerce: (val) => val
})

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind',
    format: 'port',
    default: 3002,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'cattle-vaccination-backend'
  },
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: [
      'local',
      'infra-dev',
      'management',
      'dev',
      'test',
      'perf-test',
      'ext-test',
      'prod'
    ],
    default: 'local',
    env: 'ENVIRONMENT'
  },
  log: {
    isEnabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: !isTest,
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : ['req', 'res', 'responseTime']
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy URL',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_METRICS'
  },
  tracing: {
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  apha: {
    cognitoClientId: {
      doc: 'APHA Cognito OAuth2 client ID',
      format: 'required-string',
      default: '',
      sensitive: true,
      env: 'COGNITO_CLIENT_ID'
    },
    cognitoClientSecret: {
      doc: 'APHA Cognito OAuth2 client secret',
      format: 'required-string',
      default: '',
      sensitive: true,
      env: 'COGNITO_CLIENT_SECRET'
    },
    cognitoUrl: {
      doc: 'APHA Cognito token endpoint URL',
      format: 'required-string',
      default: '',
      env: 'APHA_COGNITO_URL'
    },
    apiBaseUrl: {
      doc: 'APHA API base URL',
      format: 'required-string',
      default: '',
      env: 'APHA_API_BASE_URL'
    }
  },
  livestock: {
    apiBaseUrl: {
      doc: 'Livestock API base URL',
      format: 'required-string',
      default: '',
      env: 'LIVESTOCK_API_BASE_URL'
    },
    apiToken: {
      doc: 'Livestock API authentication token',
      format: 'required-string',
      default: '',
      sensitive: true,
      env: 'LIVESTOCK_API_TOKEN'
    }
  },
  salesforce: {
    url: {
      doc: 'Salesforce URL',
      format: 'required-string',
      default: '',
      env: 'SALESFORCE_URL'
    },
    clientId: {
      doc: 'Salesforce connected app client ID',
      format: 'required-string',
      default: '',
      sensitive: true,
      env: 'SALESFORCE_CLIENT_ID'
    },
    clientSecret: {
      doc: 'Salesforce connected app client secret',
      format: 'required-string',
      default: '',
      sensitive: true,
      env: 'SALESFORCE_CLIENT_SECRET'
    }
  },
  cdp: {
    devApiKey: {
      doc: 'Developer API key, used in non-production environments',
      format: String,
      nullable: true,
      default: null,
      env: 'DEV_API_KEY'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }
