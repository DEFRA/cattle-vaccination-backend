import { getErrorMessage } from './error-message.js'

describe('#getErrorMessage', () => {
  test('returns the message from an Error', () => {
    expect(getErrorMessage(new Error('failure'))).toBe('failure')
  })

  test('returns a thrown string', () => {
    expect(getErrorMessage('failure')).toBe('failure')
  })

  test('returns the message from a message-bearing object', () => {
    expect(getErrorMessage({ message: 'failure' })).toBe('failure')
  })
})
