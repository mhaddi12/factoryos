import type { Request, Response } from 'express'
import { hasPermission, type Permission, type UserRole } from '../../../shared/auth/permissions'
import { expressCookieContext, requireUser } from '../services/auth/session'
import type { Actor } from '../services/types'
import { forbidden } from './errors'

export function asActor(user: { companyId: string, id: string, role: UserRole }): Actor {
  return {
    companyId: user.companyId,
    userId: user.id,
    role: user.role,
  }
}

export async function requirePermission(req: Request, res: Response, permission: Permission) {
  const ctx = expressCookieContext(req, res)
  const user = await requireUser(ctx)

  if (!hasPermission(user.role, permission)) {
    throw forbidden()
  }

  return user
}
