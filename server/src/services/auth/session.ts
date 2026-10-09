import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { getPrisma } from '../../database/prisma'
import { permissionsForRole, type UserRole } from '../../../../shared/auth/permissions'
import type { SessionUser } from '../../../../shared/types/auth'
import { unauthorized } from '../../utils/errors'
import { readAccessToken, signAccessToken } from './tokens'

const ACCESS_COOKIE = 'factoryos_access'
const REFRESH_COOKIE = 'factoryos_refresh'
const LEGACY_COOKIE = 'factoryos_session'
const REFRESH_MS = 14 * 24 * 60 * 60 * 1000
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

async function loadAccount(sessionId: string, userId: string) {
  const session = await getPrisma().session.findUnique({
    where: { id: sessionId },
    include: { user: { include: accountInclude } },
  })

  if (!session || session.userId !== userId || session.expiresAt <= new Date() || !session.user.isActive) {
    return null
  }

  return session
}

async function rotateRefresh(
  ctx: CookieContext,
  sessionId: string,
  userId: string,
  currentToken: string,
  expiresAt: Date,
) {
  const next = createSecret()
  const renewedAt = expiresAt.getTime() - Date.now() < RENEW_WITHIN_MS
    ? new Date(Date.now() + REFRESH_MS)
    : expiresAt
  const updated = await getPrisma().session.updateMany({
    where: { id: sessionId, tokenHash: hashSecret(currentToken) },
    data: { tokenHash: next.tokenHash, expiresAt: renewedAt },
  })
  const access = signAccessToken({ sub: userId, sid: sessionId }, authSecret())

  if (updated.count === 1) {
    setAuthCookies(ctx, access.token, access.expiresAt, next.token, renewedAt)
    return
  }

  ctx.set(ACCESS_COOKIE, access.token, cookieOptions(access.expiresAt))
  ctx.delete(LEGACY_COOKIE, { path: '/' })
}

export async function startSession(userId: string, ctx: CookieContext) {
  const refresh = createSecret()
  const expiresAt = new Date(Date.now() + REFRESH_MS)
  const session = await getPrisma().session.create({
    data: {
      userId,
      tokenHash: refresh.tokenHash,
      expiresAt,
    },
  })
  const access = signAccessToken({ sub: userId, sid: session.id }, authSecret())
  setAuthCookies(ctx, access.token, access.expiresAt, refresh.token, expiresAt)
}

export async function refreshSession(ctx: CookieContext) {
  const refresh = ctx.get(REFRESH_COOKIE)
  if (!refresh) {
    clearAuthCookies(ctx)
    throw unauthorized()
  }

  const session = await getPrisma().session.findUnique({
    where: { tokenHash: hashSecret(refresh) },
    include: { user: { include: accountInclude } },
  })

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session) {
      await getPrisma().session.delete({ where: { id: session.id } }).catch(() => undefined)
    }
    clearAuthCookies(ctx)
    throw unauthorized()
  }

  await rotateRefresh(ctx, session.id, session.userId, refresh, session.expiresAt)
  return session.user
}

export async function requireUser(ctx: CookieContext) {
  const accessToken = ctx.get(ACCESS_COOKIE)
  const claims = accessToken ? readAccessToken(accessToken, authSecret()) : null

  if (claims) {
    const session = await loadAccount(claims.sid, claims.sub)
    if (session) {
      return session.user
    }
  }

  return refreshSession(ctx)
}

export async function endSession(ctx: CookieContext) {
  const refresh = ctx.get(REFRESH_COOKIE)
  const accessToken = ctx.get(ACCESS_COOKIE)
  clearAuthCookies(ctx)

  const prisma = getPrisma()
  const session = refresh
    ? await prisma.session.findUnique({
        where: { tokenHash: hashSecret(refresh) },
        include: { user: { select: { id: true, companyId: true } } },
      })
    : null
  const claims = !session && accessToken
    ? readAccessToken(accessToken, authSecret(), Date.now(), true)
    : null
  const accessSession = claims
    ? await prisma.session.findUnique({
        where: { id: claims.sid },
        include: { user: { select: { id: true, companyId: true } } },
      })
    : null
  const current = session || accessSession

  if (!current) {
    return null
  }

  await prisma.session.delete({ where: { id: current.id } }).catch(() => undefined)
  return current.user
}
