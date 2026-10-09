import bcrypt from 'bcryptjs'
import type { UserRole } from '../../../shared/auth/permissions'
import type { CompanyProfile, UserRecord } from '../../../shared/types/records'
import { badRequest, forbidden, notFound } from '../utils/errors'
import { getPrisma } from '../database/prisma'
import { mapDatabaseError } from '../utils/db-error'
import { blankToNull } from '../utils/money'
import { writeAudit } from './documents'
import type { Actor } from './types'

export async function getCompany(companyId: string): Promise<CompanyProfile> {
  const company = await getPrisma().company.findUnique({ where: { id: companyId } })

  if (!company) {
    throw notFound('Company not found.')
  }

  return {
    id: company.id,
    name: company.name,
    email: company.email,
    phone: company.phone,
    address: company.address,
    city: company.city,
    country: company.country,
    currency: company.currency,
    timezone: company.timezone,
  }
}

export async function updateCompany(actor: Actor, input: {
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
}) {
  await getPrisma().$transaction(async (tx) => {
    await tx.company.update({
      where: { id: actor.companyId },
      data: {
        name: input.name,
        email: blankToNull(input.email),
        phone: blankToNull(input.phone),
        address: blankToNull(input.address),
        city: blankToNull(input.city),
      },
    })
    await writeAudit(tx, {
      companyId: actor.companyId,
      userId: actor.userId,
      action: 'company.updated',
      entity: 'Company',
      entityId: actor.companyId,
    })
  })
  return getCompany(actor.companyId)
}

function userRecord(user: {
  id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  isActive: boolean
  lastLoginAt: Date | null
}): UserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  }
}

export async function listUsers(companyId: string) {
  const users = await getPrisma().user.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  })
  return users.map(userRecord)
}

function assertOwnerControl(actor: Actor, role: UserRole) {
  if (role === 'OWNER' && actor.role !== 'OWNER') {
    throw forbidden('Only an owner can change an owner account.')
  }
}

export async function createUser(actor: Actor, input: {
  name: string
  email: string
  phone?: string
  role: UserRole
  password: string
}) {
  assertOwnerControl(actor, input.role)
  const passwordHash = await bcrypt.hash(input.password, 12)

  try {
    const userId = await getPrisma().$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          companyId: actor.companyId,
          name: input.name,
          email: input.email,
          phone: blankToNull(input.phone),
          role: input.role,
          passwordHash,
        },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'user.created',
        entity: 'User',
        entityId: user.id,
        metadata: { role: user.role },
      })
      return user.id
    })
    const user = await getPrisma().user.findFirst({
      where: { id: userId, companyId: actor.companyId },
    })
    return userRecord(user!)
  } catch (error) {
    mapDatabaseError(error, 'An account with this email already exists.')
  }
}

export async function updateUser(actor: Actor, userId: string, input: {
  name: string
  phone?: string
  role: UserRole
  isActive: boolean
}) {
  const existing = await getPrisma().user.findFirst({
    where: { id: userId, companyId: actor.companyId },
  })

  if (!existing) {
    throw notFound('User not found.')
  }

  assertOwnerControl(actor, existing.role)
  assertOwnerControl(actor, input.role)

  if (existing.id === actor.userId && !input.isActive) {
    throw badRequest('You cannot deactivate your own account.')
  }

  const removesOwner = existing.role === 'OWNER' && (input.role !== 'OWNER' || !input.isActive)

  if (removesOwner) {
    const otherOwners = await getPrisma().user.count({
      where: {
        companyId: actor.companyId,
        role: 'OWNER',
        isActive: true,
        id: { not: existing.id },
      },
    })

    if (otherOwners === 0) {
      throw badRequest('The company needs at least one active owner.')
    }
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        phone: blankToNull(input.phone),
        role: input.role,
        isActive: input.isActive,
      },
    })
    await writeAudit(tx, {
      companyId: actor.companyId,
      userId: actor.userId,
      action: 'user.updated',
      entity: 'User',
      entityId: existing.id,
      metadata: { role: input.role, isActive: input.isActive },
    })
  })

  const user = await getPrisma().user.findFirst({
    where: { id: existing.id, companyId: actor.companyId },
  })
  return userRecord(user!)
}
