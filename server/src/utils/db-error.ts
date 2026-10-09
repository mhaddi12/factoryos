import { Prisma } from '../../../generated/prisma/client'
import { AppError, badRequest, conflict } from './errors'

const DATABASE_MESSAGES = [
  'was not found',
  'belongs to a different company',
  'cannot be',
  'cannot change',
  'A BOM can only',
  'A product cannot be a component',
  'does not belong',
  'Stock movements cannot',
]

export function mapDatabaseError(error: unknown, uniqueMessage: string): never {
  if (error instanceof AppError) {
    throw error
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw conflict(uniqueMessage)
  }

  const message = error instanceof Error ? error.message : ''
  const line = message
    .split('\n')
    .map(item => item.trim())
    .find(item => DATABASE_MESSAGES.some(part => item.includes(part)))

  if (line) {
    throw badRequest(line.replace(/^ERROR:\s*/, ''))
  }

  throw error
}
