import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { AppError } from '../server/src/utils/errors'
import { authenticate, registerOwner, requestPasswordReset, resetPassword } from '../server/src/services/auth/service'
import { getDashboard } from '../server/src/services/dashboard'

const databaseUrl = process.env.DATABASE_URL
const describeDb = databaseUrl ? describe : describe.skip

describeDb('authentication', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl! }),
  })
  const companyIds: string[] = []
  const suffix = randomUUID()

  afterAll(async () => {
    for (const companyId of companyIds) {
      await prisma.auditLog.deleteMany({ where: { companyId } })
      await prisma.user.deleteMany({ where: { companyId } })
      await prisma.numberSequence.deleteMany({ where: { companyId } })
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined)
    }
    await prisma.$disconnect()
  })

  it('creates a company and owner, then rejects a duplicate email', async () => {
    const email = `owner-${suffix}@auth.test`
    const created = await registerOwner({
      companyName: `Auth Co ${suffix}`,
      name: 'Auth Owner',
      email,
      password: 'Secret123',
      city: 'Lahore',
    })
    companyIds.push(created.companyId)

    const user = await authenticate(email, 'Secret123')
    expect(user.role).toBe('OWNER')
    expect(user.companyId).toBe(created.companyId)

    await expect(authenticate(email, 'wrong-password')).rejects.toBeInstanceOf(AppError)

    await expect(registerOwner({
      companyName: 'Another Co',
      name: 'Someone',
      email,
      password: 'Secret123',
    })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('resets the password and drops old sessions', async () => {
    const email = `reset-${suffix}@auth.test`
    const created = await registerOwner({
      companyName: `Reset Co ${suffix}`,
      name: 'Reset Owner',
      email,
      password: 'Secret123',
    })
    companyIds.push(created.companyId)

    const token = await requestPasswordReset(email)
    expect(token).toBeTruthy()
    await resetPassword(token!, 'Changed123')

    await expect(authenticate(email, 'Secret123')).rejects.toBeInstanceOf(AppError)
    const user = await authenticate(email, 'Changed123')
    expect(user.email).toBe(email)

    await expect(resetPassword(token!, 'Changed456')).rejects.toBeInstanceOf(AppError)
  })

  it('keeps a new company from seeing another company dashboard', async () => {
    const email = `empty-${suffix}@auth.test`
    const created = await registerOwner({
      companyName: `Empty Co ${suffix}`,
      name: 'Empty Owner',
      email,
      password: 'Secret123',
    })
    companyIds.push(created.companyId)

    const dashboard = await getDashboard(created.companyId, 'Asia/Karachi')
    expect(dashboard.counts.products).toBe(0)
    expect(dashboard.recentSales).toEqual([])
  })
})
