import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { registerOwner } from '../server/src/services/auth/service'
import { createProduct, createWarehouse, listProducts } from '../server/src/services/catalog'
import { createParty } from '../server/src/services/parties'
import { confirmPurchaseOrder, createPurchaseOrder, receivePurchaseOrder } from '../server/src/services/purchasing'
import { confirmSalesOrder, createSalesOrder, deliverSalesOrder } from '../server/src/services/selling'
import { completeProductionOrder, createBom, createProductionOrder } from '../server/src/services/manufacturing'
import { listBalances } from '../server/src/services/inventory'
import type { Actor } from '../server/src/services/types'

const databaseUrl = process.env.DATABASE_URL
const describeDb = databaseUrl ? describe : describe.skip

describeDb('company operations', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl! }),
  })
  const companyIds: string[] = []
  const suffix = randomUUID().slice(0, 8)

  afterAll(async () => {
    const leftovers = await prisma.company.findMany({
      where: { users: { some: { email: { endsWith: '@factory.test' } } } },
      select: { id: true },
    })

    for (const company of leftovers) {
      if (!companyIds.includes(company.id)) {
        companyIds.push(company.id)
      }
    }

    await prisma.$executeRaw`ALTER TABLE "StockMovement" DISABLE TRIGGER "stock_movement_append_only"`
    await prisma.$executeRaw`ALTER TABLE "SalesOrder" DISABLE TRIGGER "protect_sales_order"`
    await prisma.$executeRaw`ALTER TABLE "PurchaseOrder" DISABLE TRIGGER "protect_purchase_order"`
    await prisma.$executeRaw`ALTER TABLE "ProductionOrder" DISABLE TRIGGER "protect_production_order"`

    try {
      for (const companyId of companyIds) {
        await prisma.stockMovement.deleteMany({ where: { companyId } })
        await prisma.notification.deleteMany({ where: { companyId } })
        await prisma.payment.deleteMany({ where: { companyId } })
        await prisma.salesDelivery.deleteMany({ where: { companyId } })
        await prisma.salesOrder.deleteMany({ where: { companyId } })
        await prisma.purchaseReceipt.deleteMany({ where: { companyId } })
        await prisma.purchaseOrder.deleteMany({ where: { companyId } })
        await prisma.productionOrder.deleteMany({ where: { companyId } })
        await prisma.bom.deleteMany({ where: { companyId } })
        await prisma.stockTransfer.deleteMany({ where: { companyId } })
        await prisma.stockBalance.deleteMany({ where: { companyId } })
        await prisma.product.deleteMany({ where: { companyId } })
        await prisma.warehouse.deleteMany({ where: { companyId } })
        await prisma.customer.deleteMany({ where: { companyId } })
        await prisma.supplier.deleteMany({ where: { companyId } })
        await prisma.auditLog.deleteMany({ where: { companyId } })
        await prisma.user.deleteMany({ where: { companyId } })
        await prisma.numberSequence.deleteMany({ where: { companyId } })
        await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined)
      }
    } finally {
      await prisma.$executeRaw`ALTER TABLE "StockMovement" ENABLE TRIGGER "stock_movement_append_only"`
      await prisma.$executeRaw`ALTER TABLE "SalesOrder" ENABLE TRIGGER "protect_sales_order"`
      await prisma.$executeRaw`ALTER TABLE "PurchaseOrder" ENABLE TRIGGER "protect_purchase_order"`
      await prisma.$executeRaw`ALTER TABLE "ProductionOrder" ENABLE TRIGGER "protect_production_order"`
      await prisma.$disconnect()
    }
  })

  it('receives, sells, and produces stock inside one company', async () => {
    const created = await registerOwner({
      companyName: `Ops ${suffix}`,
      name: 'Ops Owner',
      email: `ops-${suffix}@factory.test`,
      password: 'Secret123',
    })
    companyIds.push(created.companyId)
    const actor: Actor = { companyId: created.companyId, userId: created.userId, role: 'OWNER' }
    const today = new Date().toISOString().slice(0, 10)

    const rawWarehouse = await createWarehouse(actor, { name: 'Raw', isActive: true })
    const finishedWarehouse = await createWarehouse(actor, { name: 'Finished', isActive: true })
    const raw = await createProduct(actor, {
      sku: `RM-${suffix}`,
      name: 'Granules',
      unit: 'KG',
      type: 'RAW_MATERIAL',
      costPrice: 0,
      sellingPrice: 0,
      minimumStock: 0,
      isActive: true,
    })
    const finished = await createProduct(actor, {
      sku: `FG-${suffix}`,
      name: 'Bottle',
      unit: 'PCS',
      type: 'FINISHED_GOOD',
      costPrice: 0,
      sellingPrice: 20,
      minimumStock: 0,
      isActive: true,
    })
    const supplier = await createParty('supplier', actor, { name: 'Plastics', isActive: true })
    const customer = await createParty('customer', actor, { name: 'Traders', isActive: true })

    const purchase = await createPurchaseOrder(actor, {
      partyId: supplier.id,
      warehouseId: rawWarehouse.id,
      orderDate: today,
      items: [{ productId: raw.id, quantity: 10, unitPrice: 4 }],
    })
    await confirmPurchaseOrder(actor, purchase.id)
    await receivePurchaseOrder(actor, purchase.id, {
      items: [{ itemId: purchase.items[0]!.id, quantity: 10 }],
    })

    const received = await listBalances(created.companyId)
    expect(received).toEqual([
      expect.objectContaining({ productId: raw.id, quantity: '10.0000', averageCost: '4.0000' }),
    ])

    const tooLarge = await createSalesOrder(actor, {
      partyId: customer.id,
      warehouseId: rawWarehouse.id,
      orderDate: today,
      items: [{ productId: raw.id, quantity: 12, unitPrice: 5 }],
    })
    await confirmSalesOrder(actor, tooLarge.id)
    await expect(deliverSalesOrder(actor, tooLarge.id, {
      items: [{ itemId: tooLarge.items[0]!.id, quantity: 12 }],
    })).rejects.toMatchObject({ statusCode: 400 })

    const sale = await createSalesOrder(actor, {
      partyId: customer.id,
      warehouseId: rawWarehouse.id,
      orderDate: today,
      items: [{ productId: raw.id, quantity: 3, unitPrice: 5 }],
    })
    await confirmSalesOrder(actor, sale.id)
    await deliverSalesOrder(actor, sale.id, {
      items: [{ itemId: sale.items[0]!.id, quantity: 3 }],
    })

    const bom = await createBom(actor, {
      productId: finished.id,
      name: 'Bottle BOM',
      items: [{ materialProductId: raw.id, quantity: 2, wastagePercentage: 0 }],
    })
    const production = await createProductionOrder(actor, {
      productId: finished.id,
      bomId: bom.id,
      materialWarehouseId: rawWarehouse.id,
      outputWarehouseId: finishedWarehouse.id,
      plannedQuantity: 2,
    })
    const completed = await completeProductionOrder(actor, production.id, {
      producedQuantity: 2,
      labourCost: 0,
      otherCost: 0,
    })

    expect(completed.unitCost).toBe('8.0000')
    expect(completed.materialCost).toBe('16.0000')

    const balances = await listBalances(created.companyId)
    const rawBalance = balances.find(row => row.productId === raw.id && row.warehouseId === rawWarehouse.id)
    const finishedBalance = balances.find(row => row.productId === finished.id)
    expect(rawBalance?.quantity).toBe('3.0000')
    expect(finishedBalance?.quantity).toBe('2.0000')
    expect(finishedBalance?.averageCost).toBe('8.0000')

    const other = await registerOwner({
      companyName: `Other ${suffix}`,
      name: 'Other Owner',
      email: `other-${suffix}@factory.test`,
      password: 'Secret123',
    })
    companyIds.push(other.companyId)
    const otherProducts = await listProducts(other.companyId)
    expect(otherProducts.map(product => product.sku)).not.toContain(raw.sku)
  })
})
