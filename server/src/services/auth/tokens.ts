import { createHmac, timingSafeEqual } from 'node:crypto'

export const ACCESS_MS = 15 * 60 * 1000

export type AccessClaims = {
  sub: string
  sid: string
  exp: number
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function sign(data: string, secret: string) {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

export function signAccessToken(input: { sub: string, sid: string }, secret: string, now = Date.now()) {
  const exp = Math.floor((now + ACCESS_MS) / 1000)
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = encode(JSON.stringify({ sub: input.sub, sid: input.sid, exp }))
  const data = `${header}.${payload}`
  return {
    token: `${data}.${sign(data, secret)}`,
    expiresAt: new Date(exp * 1000),
  }
}

export function readAccessToken(token: string, secret: string, now = Date.now(), ignoreExpiry = false) {
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

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Partial<AccessClaims>
    if (!claims.sub || !claims.sid || typeof claims.exp !== 'number') {
      return null
    }
    if (!ignoreExpiry && claims.exp * 1000 <= now) {
      return null
    }

    return { sub: claims.sub, sid: claims.sid, exp: claims.exp }
  } catch {
    return null
  }
}
