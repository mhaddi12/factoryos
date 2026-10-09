import { describe, expect, it } from 'vitest'
import { readAccessToken, signAccessToken } from '../server/src/services/auth/tokens'

const secret = 'test-secret'

describe('access tokens', () => {
  it('signs a token that does not contain the refresh secret or profile', () => {
    const { token } = signAccessToken({ sub: 'user-1', sid: 'session-1' }, secret)
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as Record<string, unknown>

    expect(readAccessToken(token, secret)).toEqual({
      sub: 'user-1',
      sid: 'session-1',
      exp: payload.exp,
    })
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('name')
    expect(token.split('.')).toHaveLength(3)
  })

  it('rejects a changed payload and an expired token', () => {
    const { token } = signAccessToken({ sub: 'user-1', sid: 'session-1' }, secret)
    const [header, payload, signature] = token.split('.')
    const changed = Buffer.from(JSON.stringify({ sub: 'user-2', sid: 'session-1', exp: 9_999_999_999 })).toString('base64url')

    expect(readAccessToken(`${header}.${changed}.${signature}`, secret)).toBeNull()
    expect(readAccessToken(token, secret, Date.now() + 16 * 60 * 1000)).toBeNull()
    expect(header).toBeTruthy()
    expect(payload).toBeTruthy()
  })
})
