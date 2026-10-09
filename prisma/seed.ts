import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  DocumentSequenceKey,
  NotificationType,
  PaymentDirection,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProductType,
  ProductionOrderStatus,
  PurchaseOrderStatus,
  SalesOrderStatus,
  StockMovementType,
  UnitOfMeasure,
  UserRole,
  type Prisma,
} from '../generated/prisma/client'
import { calculateProductionCost } from '../shared/domain/costing'
import { Decimal, roundMoney, roundQuantity } from '../shared/domain/decimal'
import { calculateMaterialRequirement } from '../shared/domain/materials'
import { applyInbound, applyOutbound, type StockState } from '../shared/domain/stock'

const DEMO_PASSWORD = 'Demo@12345'
const COMPANY_ID = 'company_demo'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

type Tx = Prisma.TransactionClient

const balances = new Map<string, StockState>()

function balanceKey(productId: string, warehouseId: string) {
  return `${productId}:${warehouseId}`
}

function currentBalance(productId: string, warehouseId: string): StockState {
  return balances.get(balanceKey(productId, warehouseId)) ?? {
    quantity: new Decimal(0),
    averageCost: new Decimal(0),
  }
}

function money(value: Decimal.Value) {
  return roundMoney(value).toFixed(4)
}

function qty(value: Decimal.Value) {
  return roundQuantity(value).toFixed(4)
}

function dateOnly(daysFromToday: number) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + daysFromToday)
  return date
}

async function saveBalance(tx: Tx, productId: string, warehouseId: string, state: StockState) {
  balances.set(balanceKey(productId, warehouseId), state)

  await tx.stockBalance.upsert({
    where: {
      companyId_productId_warehouseId: {
        companyId: COMPANY_ID,
        productId,
        warehouseId,
      },
    },
    create: {
      companyId: COMPANY_ID,
      productId,
      warehouseId,
      quantity: qty(state.quantity),
      averageCost: money(state.averageCost),
    },
    update: {
      quantity: qty(state.quantity),
      averageCost: money(state.averageCost),
    },
  })
}

async function receiveStock(tx: Tx, input: {
  id: string
  productId: string
  warehouseId: string
  quantity: Decimal.Value
  unitCost: Decimal.Value
  type: StockMovementType
  referenceType: string
  referenceId: string
  createdById: string
  createdAt?: Date
}) {
  const next = applyInbound(currentBalance(input.productId, input.warehouseId), input.quantity, input.unitCost)
  await saveBalance(tx, input.productId, input.warehouseId, next)

  await tx.stockMovement.create({
    data: {
      id: input.id,
      companyId: COMPANY_ID,
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: qty(input.quantity),
      unitCost: money(input.unitCost),
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdById: input.createdById,
      createdAt: input.createdAt,
    },
  })
}

async function issueStock(tx: Tx, input: {
  id: string
  productId: string
  warehouseId: string
  quantity: Decimal.Value
  type: StockMovementType
  referenceType: string
  referenceId: string
  createdById: string
  createdAt?: Date
}) {
  const current = currentBalance(input.productId, input.warehouseId)
  const next = applyOutbound(current, input.quantity)
  await saveBalance(tx, input.productId, input.warehouseId, next)

  await tx.stockMovement.create({
    data: {
      id: input.id,
      companyId: COMPANY_ID,
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: qty(new Decimal(input.quantity).negated()),
      unitCost: money(current.averageCost),
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdById: input.createdById,
      createdAt: input.createdAt,
    },
  })

  return current.averageCost
}

async function main() {
  const existing = await prisma.company.findUnique({ where: { id: COMPANY_ID } })

  if (existing) {
    console.log('Demo company already exists. Skipping seed.')
    return
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const purchasedAt = dateOnly(-14)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.company.create({
      data: {
        id: COMPANY_ID,
        name: 'Demo Manufacturing Co.',
        email: 'info@demo.com',
        phone: '042-111-000-111',
        address: '14 Industrial Estate, Sundar',
        city: 'Lahore',
        country: 'Pakistan',
        currency: 'PKR',
        timezone: 'Asia/Karachi',
      },
    })

    const users = [
      { id: 'user_owner', name: 'Demo Owner', email: 'owner@demo.com', role: UserRole.OWNER },
      { id: 'user_admin', name: 'Demo Admin', email: 'admin@demo.com', role: UserRole.ADMIN },
      { id: 'user_production', name: 'Demo Production Manager', email: 'production@demo.com', role: UserRole.PRODUCTION_MANAGER },
      { id: 'user_store', name: 'Demo Store Keeper', email: 'store@demo.com', role: UserRole.STORE_KEEPER },
      { id: 'user_sales', name: 'Demo Sales', email: 'sales@demo.com', role: UserRole.SALES },
      { id: 'user_accountant', name: 'Demo Accountant', email: 'accountant@demo.com', role: UserRole.ACCOUNTANT },
    ]

    for (const user of users) {
      await tx.user.create({
        data: {
          ...user,
          companyId: COMPANY_ID,
          passwordHash,
        },
      })
    }

    await tx.productCategory.createMany({
      data: [
        { id: 'cat_plastic', companyId: COMPANY_ID, name: 'Plastic', description: 'Resins and granules' },
        { id: 'cat_packaging', companyId: COMPANY_ID, name: 'Packaging', description: 'Caps, labels, and packs' },
        { id: 'cat_chemicals', companyId: COMPANY_ID, name: 'Chemicals', description: 'Colours and additives' },
        { id: 'cat_finished', companyId: COMPANY_ID, name: 'Finished Products', description: 'Goods ready for sale' },
        { id: 'cat_spares', companyId: COMPANY_ID, name: 'Spare Parts', description: 'Machine spares' },
      ],
    })

    await tx.warehouse.createMany({
      data: [
        { id: 'wh_raw', companyId: COMPANY_ID, name: 'Raw Material Warehouse', location: 'Store A' },
        { id: 'wh_fg', companyId: COMPANY_ID, name: 'Finished Goods Warehouse', location: 'Store B' },
        { id: 'wh_main', companyId: COMPANY_ID, name: 'Main Warehouse', location: 'Gate store' },
      ],
    })

    await tx.product.createMany({
      data: [
        { id: 'prod_plastic', companyId: COMPANY_ID, sku: 'RM-PLASTIC', name: 'Plastic Granules', categoryId: 'cat_plastic', unit: UnitOfMeasure.KG, type: ProductType.RAW_MATERIAL, costPrice: '400.0000', sellingPrice: '0.0000', minimumStock: '2000.0000' },
        { id: 'prod_cap', companyId: COMPANY_ID, sku: 'RM-CAP', name: 'Bottle Cap', categoryId: 'cat_packaging', unit: UnitOfMeasure.PCS, type: ProductType.RAW_MATERIAL, costPrice: '2.0000', sellingPrice: '0.0000', minimumStock: '5000.0000' },
        { id: 'prod_label', companyId: COMPANY_ID, sku: 'RM-LABEL', name: 'Bottle Label', categoryId: 'cat_packaging', unit: UnitOfMeasure.PCS, type: ProductType.RAW_MATERIAL, costPrice: '1.5000', sellingPrice: '0.0000', minimumStock: '5000.0000' },
        { id: 'prod_pack', companyId: COMPANY_ID, sku: 'RM-PACK', name: 'Shrink Pack', categoryId: 'cat_packaging', unit: UnitOfMeasure.PCS, type: ProductType.RAW_MATERIAL, costPrice: '3.0000', sellingPrice: '0.0000', minimumStock: '2000.0000' },
        { id: 'prod_masterbatch', companyId: COMPANY_ID, sku: 'RM-BLUE', name: 'Blue Masterbatch', categoryId: 'cat_chemicals', unit: UnitOfMeasure.KG, type: ProductType.RAW_MATERIAL, costPrice: '800.0000', sellingPrice: '0.0000', minimumStock: '100.0000' },
        { id: 'prod_bottle', companyId: COMPANY_ID, sku: 'FG-BTL-500', name: '500ml Plastic Bottle', description: 'Finished 500ml bottle with cap, label, and pack.', categoryId: 'cat_finished', unit: UnitOfMeasure.PCS, type: ProductType.FINISHED_GOOD, costPrice: '0.0000', sellingPrice: '25.0000', minimumStock: '1000.0000' },
      ],
    })

    await tx.supplier.createMany({
      data: [
        { id: 'sup_plastics', companyId: COMPANY_ID, name: 'Lahore Plastic Traders', contactPerson: 'Imran', phone: '0300-1111111', email: 'sales@lahoreplastic.example', address: 'Shahdara', city: 'Lahore', taxNumber: '1234567-8' },
        { id: 'sup_colours', companyId: COMPANY_ID, name: 'Multan Colour House', contactPerson: 'Sana', phone: '0301-2222222', email: 'orders@multancolour.example', city: 'Multan', taxNumber: '7654321-1' },
      ],
    })

    await tx.customer.createMany({
      data: [
        { id: 'cus_ali', companyId: COMPANY_ID, name: 'Ali Traders', contactPerson: 'Ali Raza', phone: '0321-3333333', email: 'ali@alitraders.example', city: 'Lahore', taxNumber: '9988776-5' },
        { id: 'cus_metro', companyId: COMPANY_ID, name: 'Metro Mart Lahore', contactPerson: 'Hina', phone: '042-35700000', email: 'buying@metromart.example', city: 'Lahore' },
      ],
    })

    const receivedLines = [
      { id: 'poi_plastic', productId: 'prod_plastic', quantity: 2000, unitPrice: 400, unit: UnitOfMeasure.KG },
      { id: 'poi_cap', productId: 'prod_cap', quantity: 20000, unitPrice: 2, unit: UnitOfMeasure.PCS },
      { id: 'poi_label', productId: 'prod_label', quantity: 20000, unitPrice: '1.5', unit: UnitOfMeasure.PCS },
      { id: 'poi_pack', productId: 'prod_pack', quantity: 15000, unitPrice: 3, unit: UnitOfMeasure.PCS },
      { id: 'poi_masterbatch', productId: 'prod_masterbatch', quantity: 40, unitPrice: 800, unit: UnitOfMeasure.KG },
    ]

    const receivedSubtotal = receivedLines.reduce(
      (sum, line) => sum.plus(new Decimal(line.quantity).mul(line.unitPrice)),
      new Decimal(0),
    )

    await tx.purchaseOrder.create({
      data: {
        id: 'po_received',
        companyId: COMPANY_ID,
        orderNumber: 'PO-00001',
        supplierId: 'sup_plastics',
        warehouseId: 'wh_raw',
        orderDate: purchasedAt,
        status: PurchaseOrderStatus.RECEIVED,
        subtotal: money(receivedSubtotal),
        discount: '0.0000',
        tax: '0.0000',
        total: money(receivedSubtotal),
        amountPaid: '0.0000',
        paymentStatus: PaymentStatus.UNPAID,
        notes: 'Opening material purchase.',
        createdById: 'user_accountant',
        items: {
          create: receivedLines.map(line => ({
            id: line.id,
            productId: line.productId,
            quantity: qty(line.quantity),
            receivedQuantity: qty(line.quantity),
            unit: line.unit,
            unitPrice: money(line.unitPrice),
            lineTotal: money(new Decimal(line.quantity).mul(line.unitPrice)),
          })),
        },
      },
    })

    await tx.purchaseReceipt.create({
      data: {
        id: 'pr_001',
        companyId: COMPANY_ID,
        purchaseOrderId: 'po_received',
        receiptNumber: 'PR-00001',
        warehouseId: 'wh_raw',
        receivedAt: purchasedAt,
        createdById: 'user_store',
        items: {
          create: receivedLines.map(line => ({
            id: line.id.replace('poi_', 'pri_'),
            productId: line.productId,
            quantity: qty(line.quantity),
            unitCost: money(line.unitPrice),
            lineTotal: money(new Decimal(line.quantity).mul(line.unitPrice)),
          })),
        },
      },
    })

    for (const line of receivedLines) {
      await receiveStock(tx, {
        id: line.id.replace('poi_', 'mov_purchase_'),
        productId: line.productId,
        warehouseId: 'wh_raw',
        quantity: line.quantity,
        unitCost: line.unitPrice,
        type: StockMovementType.PURCHASE,
        referenceType: 'PURCHASE_RECEIPT_ITEM',
        referenceId: line.id.replace('poi_', 'pri_'),
        createdById: 'user_store',
        createdAt: purchasedAt,
      })
    }

    const bottleComponents = [
      { id: 'bom_item_plastic', productId: 'prod_plastic', quantity: '0.025', unit: UnitOfMeasure.KG, wastage: 5 },
      { id: 'bom_item_cap', productId: 'prod_cap', quantity: 1, unit: UnitOfMeasure.PCS, wastage: 2 },
      { id: 'bom_item_label', productId: 'prod_label', quantity: 1, unit: UnitOfMeasure.PCS, wastage: 1 },
      { id: 'bom_item_pack', productId: 'prod_pack', quantity: 1, unit: UnitOfMeasure.PCS, wastage: 0 },
    ]

    await tx.bom.create({
      data: {
        id: 'bom_bottle_v1',
        companyId: COMPANY_ID,
        productId: 'prod_bottle',
        name: '500ml bottle standard',
        version: 1,
        isActive: true,
        items: {
          create: bottleComponents.map(item => ({
            id: item.id,
            materialProductId: item.productId,
            quantity: qty(item.quantity),
            unit: item.unit,
            wastagePercentage: item.wastage.toFixed(4),
          })),
        },
      },
    })

    const producedQuantity = 10000
    let materialCost = new Decimal(0)
    const consumed: Array<{ productId: string, requirement: ReturnType<typeof calculateMaterialRequirement>, unit: UnitOfMeasure, quantityPerUnit: Decimal.Value, wastage: number }> = []

    for (const component of bottleComponents) {
      const requirement = calculateMaterialRequirement(component.quantity, producedQuantity, component.wastage)
      const averageCost = await issueStock(tx, {
        id: `mov_prod_out_${component.productId}`,
        productId: component.productId,
        warehouseId: 'wh_raw',
        quantity: requirement.requiredQuantity,
        type: StockMovementType.PRODUCTION_OUT,
        referenceType: 'PRODUCTION_ORDER',
        referenceId: 'prd_done',
        createdById: 'user_production',
        createdAt: now,
      })
      const lineCost = roundMoney(requirement.requiredQuantity.mul(averageCost))
      materialCost = materialCost.plus(lineCost)
      consumed.push({
        productId: component.productId,
        requirement,
        unit: component.unit,
        quantityPerUnit: component.quantity,
        wastage: component.wastage,
      })
    }

    const productionCost = calculateProductionCost({
      materialCost,
      labourCost: 80000,
      otherCost: 20000,
      producedQuantity,
    })

    await tx.productionOrder.create({
      data: {
        id: 'prd_done',
        companyId: COMPANY_ID,
        orderNumber: 'MO-00001',
        productId: 'prod_bottle',
        bomId: 'bom_bottle_v1',
        materialWarehouseId: 'wh_raw',
        outputWarehouseId: 'wh_fg',
        plannedQuantity: qty(producedQuantity),
        producedQuantity: qty(producedQuantity),
        status: ProductionOrderStatus.COMPLETED,
        plannedStartDate: dateOnly(0),
        actualStartDate: now,
        completedAt: now,
        materialCost: money(productionCost.materialCost),
        labourCost: money(productionCost.labourCost),
        otherCost: money(productionCost.otherCost),
        totalCost: money(productionCost.totalCost),
        unitCost: money(productionCost.unitCost),
        notes: 'Morning bottle run.',
        createdById: 'user_production',
        materials: {
          create: consumed.map(item => ({
            productId: item.productId,
            unit: item.unit,
            quantityPerUnit: qty(item.quantityPerUnit),
            wastagePercentage: item.wastage.toFixed(4),
            requiredQuantity: qty(item.requirement.requiredQuantity),
            consumedQuantity: qty(item.requirement.requiredQuantity),
            unitCost: money(currentBalance(item.productId, 'wh_raw').averageCost),
            lineCost: money(item.requirement.requiredQuantity.mul(currentBalance(item.productId, 'wh_raw').averageCost)),
          })),
        },
      },
    })

    await receiveStock(tx, {
      id: 'mov_prod_in_bottle',
      productId: 'prod_bottle',
      warehouseId: 'wh_fg',
      quantity: producedQuantity,
      unitCost: productionCost.unitCost,
      type: StockMovementType.PRODUCTION_IN,
      referenceType: 'PRODUCTION_ORDER',
      referenceId: 'prd_done',
      createdById: 'user_production',
      createdAt: now,
    })

    await tx.product.update({
      where: { id: 'prod_bottle' },
      data: { costPrice: money(productionCost.unitCost) },
    })

    await tx.salesOrder.create({
      data: {
        id: 'so_delivered',
        companyId: COMPANY_ID,
        orderNumber: 'SO-00001',
        customerId: 'cus_ali',
        warehouseId: 'wh_fg',
        orderDate: dateOnly(0),
        status: SalesOrderStatus.DELIVERED,
        subtotal: '25000.0000',
        discount: '0.0000',
        tax: '0.0000',
        total: '25000.0000',
        amountPaid: '10000.0000',
        paymentStatus: PaymentStatus.PARTIAL,
        createdById: 'user_sales',
        items: {
          create: {
            id: 'soi_bottle',
            productId: 'prod_bottle',
            quantity: '1000.0000',
            deliveredQuantity: '1000.0000',
            unit: UnitOfMeasure.PCS,
            unitPrice: '25.0000',
            lineTotal: '25000.0000',
          },
        },
      },
    })

    const deliveryCost = currentBalance('prod_bottle', 'wh_fg').averageCost

    await tx.salesDelivery.create({
      data: {
        id: 'sd_001',
        companyId: COMPANY_ID,
        salesOrderId: 'so_delivered',
        deliveryNumber: 'SD-00001',
        warehouseId: 'wh_fg',
        deliveredAt: now,
        createdById: 'user_store',
        items: {
          create: {
            id: 'sdi_bottle',
            productId: 'prod_bottle',
            quantity: '1000.0000',
            unitCost: money(deliveryCost),
            lineTotal: money(deliveryCost.mul(1000)),
          },
        },
      },
    })

    await issueStock(tx, {
      id: 'mov_sale_bottle',
      productId: 'prod_bottle',
      warehouseId: 'wh_fg',
      quantity: 1000,
      type: StockMovementType.SALE,
      referenceType: 'SALES_DELIVERY_ITEM',
      referenceId: 'sdi_bottle',
      createdById: 'user_store',
      createdAt: now,
    })

    await tx.purchaseOrder.create({
      data: {
        id: 'po_pending',
        companyId: COMPANY_ID,
        orderNumber: 'PO-00002',
        supplierId: 'sup_plastics',
        warehouseId: 'wh_raw',
        orderDate: dateOnly(0),
        status: PurchaseOrderStatus.CONFIRMED,
        subtotal: '200000.0000',
        discount: '0.0000',
        tax: '0.0000',
        total: '200000.0000',
        createdById: 'user_accountant',
        notes: 'Waiting for the next granule delivery.',
        items: {
          create: {
            productId: 'prod_plastic',
            quantity: '500.0000',
            receivedQuantity: '0.0000',
            unit: UnitOfMeasure.KG,
            unitPrice: '400.0000',
            lineTotal: '200000.0000',
          },
        },
      },
    })

    await tx.salesOrder.create({
      data: {
        id: 'so_pending',
        companyId: COMPANY_ID,
        orderNumber: 'SO-00002',
        customerId: 'cus_metro',
        warehouseId: 'wh_fg',
        orderDate: dateOnly(0),
        status: SalesOrderStatus.CONFIRMED,
        subtotal: '12500.0000',
        discount: '0.0000',
        tax: '0.0000',
        total: '12500.0000',
        createdById: 'user_sales',
        items: {
          create: {
            productId: 'prod_bottle',
            quantity: '500.0000',
            deliveredQuantity: '0.0000',
            unit: UnitOfMeasure.PCS,
            unitPrice: '25.0000',
            lineTotal: '12500.0000',
          },
        },
      },
    })

    const plannedQuantity = 4000
    await tx.productionOrder.create({
      data: {
        id: 'prd_planned',
        companyId: COMPANY_ID,
        orderNumber: 'MO-00002',
        productId: 'prod_bottle',
        bomId: 'bom_bottle_v1',
        materialWarehouseId: 'wh_raw',
        outputWarehouseId: 'wh_fg',
        plannedQuantity: qty(plannedQuantity),
        status: ProductionOrderStatus.PLANNED,
        plannedStartDate: dateOnly(1),
        createdById: 'user_production',
        materials: {
          create: bottleComponents.map((component) => {
            const requirement = calculateMaterialRequirement(component.quantity, plannedQuantity, component.wastage)
            return {
              productId: component.productId,
              unit: component.unit,
              quantityPerUnit: qty(component.quantity),
              wastagePercentage: component.wastage.toFixed(4),
              requiredQuantity: qty(requirement.requiredQuantity),
            }
          }),
        },
      },
    })

    await tx.payment.create({
      data: {
        id: 'pay_sale_1',
        companyId: COMPANY_ID,
        direction: PaymentDirection.INCOMING,
        method: PaymentMethod.BANK_TRANSFER,
        amount: '10000.0000',
        paidAt: now,
        customerId: 'cus_ali',
        salesOrderId: 'so_delivered',
        reference: 'HBL-10421',
        createdById: 'user_accountant',
      },
    })

    await tx.notification.createMany({
      data: [
        { companyId: COMPANY_ID, type: NotificationType.LOW_STOCK, title: 'Low stock', message: 'Plastic Granules is below its minimum stock.', entityType: 'Product', entityId: 'prod_plastic' },
        { companyId: COMPANY_ID, type: NotificationType.LOW_STOCK, title: 'Low stock', message: 'Blue Masterbatch is below its minimum stock.', entityType: 'Product', entityId: 'prod_masterbatch' },
        { companyId: COMPANY_ID, type: NotificationType.PURCHASE_RECEIVED, title: 'Purchase received', message: 'PO-00001 was received into the raw material warehouse.', entityType: 'PurchaseOrder', entityId: 'po_received' },
        { companyId: COMPANY_ID, type: NotificationType.PRODUCTION_COMPLETED, title: 'Production completed', message: 'MO-00001 finished 10,000 PCS of 500ml Plastic Bottle.', entityType: 'ProductionOrder', entityId: 'prd_done' },
        { companyId: COMPANY_ID, type: NotificationType.SALES_DELIVERED, title: 'Sales order delivered', message: 'SO-00001 was delivered to Ali Traders.', entityType: 'SalesOrder', entityId: 'so_delivered' },
      ],
    })

    await tx.auditLog.createMany({
      data: [
        { companyId: COMPANY_ID, userId: 'user_admin', action: 'product.created', entity: 'Product', entityId: 'prod_bottle', metadata: { sku: 'FG-BTL-500' } },
        { companyId: COMPANY_ID, userId: 'user_store', action: 'purchase_order.received', entity: 'PurchaseOrder', entityId: 'po_received', metadata: { orderNumber: 'PO-00001' } },
        { companyId: COMPANY_ID, userId: 'user_production', action: 'production_order.completed', entity: 'ProductionOrder', entityId: 'prd_done', metadata: { orderNumber: 'MO-00001', producedQuantity: 10000 } },
        { companyId: COMPANY_ID, userId: 'user_sales', action: 'sales_order.delivered', entity: 'SalesOrder', entityId: 'so_delivered', metadata: { orderNumber: 'SO-00001' } },
      ],
    })

    await tx.numberSequence.createMany({
      data: [
        { companyId: COMPANY_ID, key: DocumentSequenceKey.PURCHASE_ORDER, lastValue: 2 },
        { companyId: COMPANY_ID, key: DocumentSequenceKey.PURCHASE_RECEIPT, lastValue: 1 },
        { companyId: COMPANY_ID, key: DocumentSequenceKey.SALES_ORDER, lastValue: 2 },
        { companyId: COMPANY_ID, key: DocumentSequenceKey.SALES_DELIVERY, lastValue: 1 },
        { companyId: COMPANY_ID, key: DocumentSequenceKey.PRODUCTION_ORDER, lastValue: 2 },
        { companyId: COMPANY_ID, key: DocumentSequenceKey.STOCK_TRANSFER, lastValue: 0 },
      ],
    })
  }, { timeout: 30000 })

  console.log('Seeded Demo Manufacturing Co.')
  console.log(`Demo password for every user: ${DEMO_PASSWORD}`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
