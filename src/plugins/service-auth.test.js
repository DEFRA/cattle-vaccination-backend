import { config } from '../config.js'
import { serviceAuth } from './service-auth.js'

const vetSub = 'arn:aws:iam::123456789012:role/cattle-vaccination-vet-portal-ui'
const otherSub = 'arn:aws:iam::123456789012:role/someone-else'

function mockServer() {
  return {
    register: vi.fn(),
    auth: {
      strategy: vi.fn(),
      default: vi.fn(),
    },
  }
}

function enableAuth(allowedServices = '') {
  config.set('serviceAuth.enabled', true)
  config.set('serviceAuth.jwksUri', 'https://jwks.example.com')
  config.set('serviceAuth.issuer', 'https://issuer.example.com')
  config.set('serviceAuth.audience', 'cattle-vaccination-backend')
  config.set('serviceAuth.allowedServices', allowedServices)
}

describe('service-auth plugin', () => {
  afterEach(() => {
    config.set('serviceAuth.enabled', false)
    config.reset('serviceAuth.jwksUri')
    config.reset('serviceAuth.issuer')
    config.set('serviceAuth.audience', 'cattle-vaccination-backend')
    config.set('serviceAuth.allowedServices', '')
  })

  test('should not register a strategy when disabled', async () => {
    const server = mockServer()

    await serviceAuth.plugin.register(server)

    expect(server.register).not.toHaveBeenCalled()
    expect(server.auth.strategy).not.toHaveBeenCalled()
    expect(server.auth.default).not.toHaveBeenCalled()
  })

  test('should register the jwt strategy as the default when enabled', async () => {
    enableAuth('cattle-vaccination-vet-portal-ui')
    const server = mockServer()

    await serviceAuth.plugin.register(server)

    expect(server.auth.strategy).toHaveBeenCalledWith(
      'service',
      'jwt',
      expect.objectContaining({
        keys: { uri: 'https://jwks.example.com' },
        verify: {
          aud: 'cattle-vaccination-backend',
          iss: 'https://issuer.example.com',
          sub: false,
        },
      }),
    )
    expect(server.auth.default).toHaveBeenCalledWith('service')
  })

  test('should accept an allowed caller and reject the rest', async () => {
    enableAuth('cattle-vaccination-vet-portal-ui')
    const server = mockServer()

    await serviceAuth.plugin.register(server)
    const { validate } = server.auth.strategy.mock.calls[0][2]

    expect(validate({ decoded: { payload: { sub: vetSub } } })).toEqual({
      isValid: true,
      credentials: { sub: vetSub },
    })
    expect(validate({ decoded: { payload: { sub: otherSub } } })).toEqual({
      isValid: false,
      credentials: { sub: otherSub },
    })
    expect(validate({ decoded: { payload: {} } })).toEqual({ isValid: false })
  })

  test('should allow any caller when the allow list is empty', async () => {
    enableAuth('')
    const server = mockServer()

    await serviceAuth.plugin.register(server)
    const { validate } = server.auth.strategy.mock.calls[0][2]

    expect(validate({ decoded: { payload: { sub: otherSub } } }).isValid).toBe(true)
  })
})
