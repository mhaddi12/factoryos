import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, ProductType, UnitOfMeasure, UserRole } from '../generated/prisma/client'

const databaseUrl = process.env.DATABASE_URL
const describeDb = databaseUrl ? describe : describe.skip

describeDb('database integrity', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl! }),
  })
  const suffix = randomUUID()
  const companyIds: string[] = []

  afterAll(async () => {
    for (const companyId of companyIds) {
      await prisma.bom.deleteMany({ where: { companyId } })
      await prisma.stockBalance.deleteMany({ where: { companyId } })
      await prisma.product.deleteMany({ where: { companyId } })
      await prisma.warehouse.deleteMany({ where: { companyId } })
      await prisma.user.deleteMany({ where: { companyId } })
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined)
    }

    await prisma.$disconnect()
  })

  async function createFactory(label: string) {
    const company = await prisma.company.create({
      data: { name: `Integrity ${label} ${suffix}` },
    })
    companyIds.push(company.id)

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        name: label,
        email: `${label}-${suffix}@integrity.test`,
        passwordHash: 'not-used',
        role: UserRole.OWNER,
      },
    })

    const warehouse = await prisma.warehouse.create({
      data: {
        companyId: company.id,
        name: 'Main Warehouse',
      },
    })

    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        sku: 'RM-1',
        name: 'Plastic Granules',
        unit: UnitOfMeasure.KG,
        type: ProductType.RAW_MATERIAL,
      },
    })

    return { company, user, warehouse, product }
  }

  it('allows the same SKU in two companies and rejects it inside one company', async () => {
    const first = await createFactory('a-sku')
    const second = await createFactory('b-sku')

    expect(first.product.sku).toBe(second.product.sku)

    await expect(prisma.product.create({
      data: {
        companyId: first.company.id,
        sku: 'RM-1',
        name: 'Duplicate granules',
        unit: UnitOfMeasure.KG,
        type: ProductType.RAW_MATERIAL,
      },
    })).rejects.toThrow()
  })

  it('rejects stock that points at another company product', async () => {
    const first = await createFactory('a-tenant')
    const second = await createFactory('b-tenant')

    await expect(prisma.stockBalance.create({
      data: {
        companyId: second.company.id,
        productId: first.product.id,
        warehouseId: second.warehouse.id,
        quantity: '5.0000',
      },
    })).rejects.toThrow(/different company/i)
  })

  it('rejects negative stock balances', async () => {
    const factory = await createFactory('negative')

    await expect(prisma.stockBalance.create({
      data: {
        companyId: factory.company.id,
        productId: factory.product.id,
        warehouseId: factory.warehouse.id,
        quantity: '-1.0000',
      },
    })).rejects.toThrow()
  })

  it('rejects a BOM for a raw material', async () => {
    const factory = await createFactory('bom')

    await expect(prisma.bom.create({
      data: {
        companyId: factory.company.id,
        productId: factory.product.id,
        name: 'Invalid BOM',
        version: 1,
      },
    })).rejects.toThrow(/finished or semi-finished/i)
  })
})
