import { createHmac, timingSafeEqual } from 'node:crypto'

export const ACCESS_MS = 15 * 60 * 1000
export const REFRESH_MS = 14 * 24 * 60 * 60 * 1000

export type TokenKind = 'access' | 'refresh'

export type TokenClaims = {
  sub: string
  typ: TokenKind
  exp: number
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function sign(data: string, secret: string) {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

function signToken(sub: string, typ: TokenKind, ttlMs: number, secret: string, now: number) {
  const exp = Math.floor((now + ttlMs) / 1000)
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = encode(JSON.stringify({ sub, typ, exp }))
  const data = `${header}.${payload}`
  return {
    token: `${data}.${sign(data, secret)}`,
    expiresAt: new Date(exp * 1000),
  }
}

export function signAccessToken(sub: string, secret: string, now = Date.now()) {
  return signToken(sub, 'access', ACCESS_MS, secret, now)
}

export function signRefreshToken(sub: string, secret: string, now = Date.now()) {
  return signToken(sub, 'refresh', REFRESH_MS, secret, now)
}

export function readAccessToken(token: string, secret: string, now = Date.now(), ignoreExpiry = false) {
  return readToken(token, secret, 'access', now, ignoreExpiry)
}

export function readRefreshToken(token: string, secret: string, now = Date.now(), ignoreExpiry = false) {
  return readToken(token, secret, 'refresh', now, ignoreExpiry)
}

function readToken(token: string, secret: string, typ: TokenKind, now: number, ignoreExpiry: boolean) {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }

  const [header, payload, signature] = parts as [string, string, string]
  const expected = sign(`${header}.${payload}`, secret)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null
  }

  try {
    const headerJson = JSON.parse(Buffer.from(header, 'base64url').toString()) as { alg?: string }
    if (headerJson.alg !== 'HS256') {
      return null
    }

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Partial<TokenClaims>
    if (!claims.sub || claims.typ !== typ || typeof claims.exp !== 'number') {
      return null
    }
    if (!ignoreExpiry && claims.exp * 1000 <= now) {
      return null
    }

    return { sub: claims.sub, typ, exp: claims.exp }
  } catch {
    return null
  }
}
