import type { PartyRecord } from '../../../shared/types/records'
import { notFound } from '../utils/errors'
import { getPrisma } from '../database/prisma'
import { mapDatabaseError } from '../utils/db-error'
import { blankToNull } from '../utils/money'
import { writeAudit } from './documents'
import type { Actor } from './types'

export type PartyInput = {
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  taxNumber?: string
  isActive: boolean
}

function toParty(party: {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  taxNumber: string | null
  isActive: boolean
}): PartyRecord {
  return party
}

function data(actor: Actor, input: PartyInput) {
  return {
    companyId: actor.companyId,
    name: input.name,
    contactPerson: blankToNull(input.contactPerson),
    phone: blankToNull(input.phone),
    email: blankToNull(input.email),
    address: blankToNull(input.address),
    city: blankToNull(input.city),
    taxNumber: blankToNull(input.taxNumber),
    isActive: input.isActive,
  }
}

export async function listParties(kind: 'customer' | 'supplier', companyId: string, search?: string) {
  const where = {
    companyId,
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  }
  const parties = kind === 'customer'
    ? await getPrisma().customer.findMany({ where, orderBy: { name: 'asc' }, take: 200 })
    : await getPrisma().supplier.findMany({ where, orderBy: { name: 'asc' }, take: 200 })

  return parties.map(toParty)
}

export async function createParty(kind: 'customer' | 'supplier', actor: Actor, input: PartyInput) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const created = kind === 'customer'
        ? await tx.customer.create({ data: data(actor, input) })
        : await tx.supplier.create({ data: data(actor, input) })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: `${kind}.created`,
        entity: kind === 'customer' ? 'Customer' : 'Supplier',
        entityId: created.id,
      })
      return toParty(created)
    })
  } catch (error) {
    mapDatabaseError(error, 'That record could not be saved.')
  }
}

export async function updateParty(kind: 'customer' | 'supplier', actor: Actor, partyId: string, input: PartyInput) {
  const existing = kind === 'customer'
    ? await getPrisma().customer.findFirst({ where: { id: partyId, companyId: actor.companyId } })
    : await getPrisma().supplier.findFirst({ where: { id: partyId, companyId: actor.companyId } })

  if (!existing) {
    throw notFound(kind === 'customer' ? 'Customer not found.' : 'Supplier not found.')
  }

  try {
    return await getPrisma().$transaction(async (tx) => {
      const saved = kind === 'customer'
        ? await tx.customer.update({ where: { id: partyId }, data: data(actor, input) })
        : await tx.supplier.update({ where: { id: partyId }, data: data(actor, input) })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: `${kind}.updated`,
        entity: kind === 'customer' ? 'Customer' : 'Supplier',
        entityId: saved.id,
      })
      return toParty(saved)
    })
  } catch (error) {
    mapDatabaseError(error, 'That record could not be saved.')
  }
}
