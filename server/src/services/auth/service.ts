import bcrypt from 'bcryptjs'
import { Prisma, DocumentSequenceKey } from '../../../../generated/prisma/client'
import { getPrisma } from '../../database/prisma'
import { conflict, unauthorized } from '../../utils/errors'
import { createSecret, hashSecret } from './session'

const RESET_MS = 60 * 60 * 1000
const SEQUENCE_KEYS = Object.values(DocumentSequenceKey)

let dummyPasswordHash: string | null = null

async function burnPasswordTime(password: string) {
  dummyPasswordHash ??= await bcrypt.hash('not-a-real-password', 12)
  await bcrypt.compare(password, dummyPasswordHash)
}

function blankToNull(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function registerOwner(input: {
  companyName: string
  name: string
  email: string
  password: string
  phone?: string
  city?: string
}) {
  const prisma = getPrisma()
  const passwordHash = await bcrypt.hash(input.password, 12)

  try {
    return await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: input.companyName,
          email: input.email,
          phone: blankToNull(input.phone),
          city: blankToNull(input.city),
        },
      })

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          name: input.name,
          email: input.email,
          phone: blankToNull(input.phone),
          passwordHash,
          role: 'OWNER',
        },
      })

      await tx.numberSequence.createMany({
        data: SEQUENCE_KEYS.map(key => ({
          companyId: company.id,
          key,
          lastValue: 0,
        })),
      })

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          userId: user.id,
          action: 'company.registered',
          entity: 'Company',
          entityId: company.id,
          metadata: { email: user.email },
        },
      })

      return { userId: user.id, companyId: company.id }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('An account with this email already exists.')
    }
    throw error
  }
}

export async function authenticate(email: string, password: string) {
  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          currency: true,
          timezone: true,
        },
      },
    },
  })

  if (!user) {
    await burnPasswordTime(password)
    throw unauthorized('Email or password is incorrect.')
  }

  const matches = await bcrypt.compare(password, user.passwordHash)

  if (!matches) {
    throw unauthorized('Email or password is incorrect.')
  }

  if (!user.isActive) {
    throw unauthorized('This account is disabled.')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      companyId: user.companyId,
      userId: user.id,
      action: 'user.login',
      entity: 'User',
      entityId: user.id,
    },
  })

  return user
}

export async function requestPasswordReset(email: string) {
  const prisma = getPrisma()
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.isActive) {
    return null
  }

  const { token, tokenHash } = createSecret()
  const expiresAt = new Date(Date.now() + RESET_MS)

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  })

  return token
}

export async function resetPassword(token: string, password: string) {
  const prisma = getPrisma()
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashSecret(token) },
    include: { user: true },
  })

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date() || !resetToken.user.isActive) {
    throw unauthorized('This reset link is invalid or has expired.')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        companyId: resetToken.user.companyId,
        userId: resetToken.userId,
        action: 'user.password_reset',
        entity: 'User',
        entityId: resetToken.userId,
      },
    }),
  ])
}
