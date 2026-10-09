import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { getPrisma } from '../../database/prisma'
import { permissionsForRole, type UserRole } from '../../../../shared/auth/permissions'
import type { SessionUser } from '../../../../shared/types/auth'
import { unauthorized } from '../../utils/errors'
import { readAccessToken, readRefreshToken, signAccessToken, signRefreshToken } from './tokens'

const ACCESS_COOKIE = 'factoryos_access'
const REFRESH_COOKIE = 'factoryos_refresh'
const LEGACY_COOKIE = 'factoryos_session'
const RENEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000
const DEV_SECRET = 'dev-only-change-me-before-any-real-deployment'

const accountInclude = {
  company: {
    select: {
      id: true,
      name: true,
      currency: true,
      timezone: true,
    },
  },
} as const

type Account = {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  companyId: string
  company: {
    id: string
    name: string
    currency: string
    timezone: string
  }
}

// Cookie context abstraction — lets services stay testable without Express req/res
export type CookieContext = {
  get(name: string): string | undefined
  set(name: string, value: string, options: {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'lax' | 'strict' | 'none'
    path?: string
    expires?: Date
  }): void
  delete(name: string, options?: { path?: string }): void
}

/** Build a CookieContext from an Express req/res pair */
export function expressCookieContext(req: Request, res: Response): CookieContext {
  return {
    get(name: string) {
      return req.cookies?.[name]
    },
    set(name: string, value: string, options) {
      res.cookie(name, value, {
        httpOnly: options.httpOnly ?? true,
        secure: options.secure ?? false,
        sameSite: options.sameSite ?? 'lax',
        path: options.path ?? '/',
        expires: options.expires,
      })
    },
    delete(name: string, options) {
      const production = process.env.NODE_ENV === 'production'
      res.clearCookie(name, {
        path: options?.path ?? '/',
        secure: production,
        sameSite: production ? 'none' : 'lax',
      })
    },
  }
}

export function createSecret() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashSecret(token) }
}

export function hashSecret(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function toSessionUser(user: Account): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    company: user.company,
    permissions: [...permissionsForRole(user.role)],
  }
}

function authSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret || (process.env.NODE_ENV === 'production' && secret === DEV_SECRET)) {
    throw unauthorized('Sign in is not available.')
  }
  return secret
}

function cookieOptions(expires: Date) {
  const production = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: production,
    sameSite: (production ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    expires,
  }
}

function clearAuthCookies(ctx: CookieContext) {
  ctx.delete(ACCESS_COOKIE, { path: '/' })
  ctx.delete(REFRESH_COOKIE, { path: '/' })
  ctx.delete(LEGACY_COOKIE, { path: '/' })
}

function setAuthCookies(
  ctx: CookieContext,
  access: string,
  accessExpires: Date,
  refresh: string,
  refreshExpires: Date,
) {
  ctx.set(ACCESS_COOKIE, access, cookieOptions(accessExpires))
  ctx.set(REFRESH_COOKIE, refresh, cookieOptions(refreshExpires))
  ctx.delete(LEGACY_COOKIE, { path: '/' })
}

async function loadUser(userId: string) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    include: accountInclude,
  })

  if (!user || !user.isActive) {
    return null
  }

  return user
}

function issuePair(ctx: CookieContext, userId: string) {
  const secret = authSecret()
  const access = signAccessToken(userId, secret)
  const refresh = signRefreshToken(userId, secret)
  setAuthCookies(ctx, access.token, access.expiresAt, refresh.token, refresh.expiresAt)
}

export async function issueTokens(userId: string, ctx: CookieContext) {
  issuePair(ctx, userId)
}

export async function refreshTokens(ctx: CookieContext) {
  const refresh = ctx.get(REFRESH_COOKIE)
  const claims = refresh ? readRefreshToken(refresh, authSecret()) : null

  if (!claims) {
    clearAuthCookies(ctx)
    throw unauthorized()
  }

  const user = await loadUser(claims.sub)
  if (!user) {
    clearAuthCookies(ctx)
    throw unauthorized()
  }

  const secret = authSecret()
  const access = signAccessToken(user.id, secret)
  const refreshExpires = new Date(claims.exp * 1000)
  if (refreshExpires.getTime() - Date.now() < RENEW_WITHIN_MS) {
    const next = signRefreshToken(user.id, secret)
    setAuthCookies(ctx, access.token, access.expiresAt, next.token, next.expiresAt)
  } else {
    ctx.set(ACCESS_COOKIE, access.token, cookieOptions(access.expiresAt))
    ctx.delete(LEGACY_COOKIE, { path: '/' })
  }

  return user
}

export async function requireUser(ctx: CookieContext) {
  const accessToken = ctx.get(ACCESS_COOKIE)
  const claims = accessToken ? readAccessToken(accessToken, authSecret()) : null

  if (claims) {
    const user = await loadUser(claims.sub)
    if (user) {
      return user
    }
    clearAuthCookies(ctx)
    throw unauthorized()
  }

  return refreshTokens(ctx)
}

export async function clearTokens(ctx: CookieContext) {
  const accessToken = ctx.get(ACCESS_COOKIE)
  const refresh = ctx.get(REFRESH_COOKIE)
  clearAuthCookies(ctx)

  const claims = (accessToken ? readAccessToken(accessToken, authSecret(), Date.now(), true) : null)
    ?? (refresh ? readRefreshToken(refresh, authSecret(), Date.now(), true) : null)

  if (!claims) {
    return null
  }

  return getPrisma().user.findUnique({
    where: { id: claims.sub },
    select: { id: true, companyId: true },
  })
}
