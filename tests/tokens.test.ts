import { describe, expect, it } from 'vitest'
import { readAccessToken, readRefreshToken, signAccessToken, signRefreshToken } from '../server/src/services/auth/tokens'

const secret = 'test-secret'

describe('access tokens', () => {
  it('signs a token that does not contain a profile', () => {
    const { token } = signAccessToken('user-1', secret)
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as Record<string, unknown>

    expect(readAccessToken(token, secret)).toEqual({
      sub: 'user-1',
      typ: 'access',
      exp: payload.exp,
    })
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('sid')
    expect(token.split('.')).toHaveLength(3)
  })

  it('rejects a changed payload and an expired token', () => {
    const { token } = signAccessToken('user-1', secret)
    const [header, payload, signature] = token.split('.')
    const changed = Buffer.from(JSON.stringify({ sub: 'user-2', typ: 'access', exp: 9_999_999_999 })).toString('base64url')

    expect(readAccessToken(`${header}.${changed}.${signature}`, secret)).toBeNull()
    expect(readAccessToken(token, secret, Date.now() + 16 * 60 * 1000)).toBeNull()
    expect(header).toBeTruthy()
    expect(payload).toBeTruthy()
  })

  it('does not accept a refresh token as an access token', () => {
    const { token } = signRefreshToken('user-1', secret)
    expect(readRefreshToken(token, secret)?.typ).toBe('refresh')
    expect(readAccessToken(token, secret)).toBeNull()
  })
})
