import { Decimal } from '../../../shared/domain/decimal'
import { addDays, startOfZonedDay } from '../../../shared/domain/time'
import { getPrisma } from '../database/prisma'

function money(value: Decimal) {
  return value.toFixed(2)
}

function quantity(value: Decimal) {
  return value.toFixed(4)
}

export async function getDashboard(companyId: string, timeZone: string) {
  const prisma = getPrisma()
  const todayStart = startOfZonedDay(timeZone)
  const tomorrowStart = addDays(todayStart, 1)

  const [
    productCount,
    products,
    balances,
    pendingPurchases,
    pendingSales,
    productionInProgress,
    todayProduction,
    todayDeliveries,
    recentProduction,
    recentPurchases,
    recentSales,
  ] = await Promise.all([
    prisma.product.count({ where: { companyId, isActive: true } }),
    prisma.product.findMany({
      where: { companyId, isActive: true, minimumStock: { gt: 0 } },
      select: { id: true, name: true, sku: true, unit: true, minimumStock: true },
    }),
    prisma.stockBalance.groupBy({
      by: ['productId'],
      where: { companyId },
      _sum: { quantity: true },
    }),
    prisma.purchaseOrder.count({
      where: {
        companyId,
        status: { in: ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED'] },
      },
    }),
    prisma.salesOrder.count({
      where: {
        companyId,
        status: { in: ['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED'] },
      },
    }),
    prisma.productionOrder.count({
      where: { companyId, status: 'IN_PROGRESS' },
    }),
    prisma.productionOrder.aggregate({
      where: {
        companyId,
        status: 'COMPLETED',
        completedAt: { gte: todayStart, lt: tomorrowStart },
      },
      _sum: { producedQuantity: true },
    }),
    prisma.salesDelivery.findMany({
      where: {
        companyId,
        deliveredAt: { gte: todayStart, lt: tomorrowStart },
      },
      select: { salesOrderId: true, salesOrder: { select: { total: true } } },
    }),
    prisma.productionOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        producedQuantity: true,
        plannedQuantity: true,
        product: { select: { name: true, unit: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        orderDate: true,
        supplier: { select: { name: true } },
      },
    }),
    prisma.salesOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        orderDate: true,
        customer: { select: { name: true } },
      },
    }),
  ])

  const onHand = new Map(balances.map(row => [row.productId, new Decimal(row._sum.quantity?.toString() ?? 0)]))
  const valueRows = await prisma.stockBalance.findMany({
    where: { companyId },
    select: { quantity: true, averageCost: true },
  })

  let inventoryValue = new Decimal(0)
  for (const row of valueRows) {
    inventoryValue = inventoryValue.plus(new Decimal(row.quantity.toString()).mul(row.averageCost.toString()))
  }

  const lowStockItems = products.flatMap((product) => {
    const current = onHand.get(product.id) ?? new Decimal(0)
    const minimum = new Decimal(product.minimumStock.toString())
    if (current.gte(minimum)) {
      return []
    }
    return [{
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      current: quantity(current),
      minimum: quantity(minimum),
    }]
  }).sort((left, right) => Number(left.current) - Number(right.current))
  const lowStock = lowStockItems.slice(0, 5)

  const deliveredOrderIds = new Set<string>()
  let todaySales = new Decimal(0)
  for (const delivery of todayDeliveries) {
    if (deliveredOrderIds.has(delivery.salesOrderId)) {
      continue
    }
    deliveredOrderIds.add(delivery.salesOrderId)
    todaySales = todaySales.plus(delivery.salesOrder.total.toString())
  }

  return {
    counts: {
      products: productCount,
      lowStock: lowStockItems.length,
      pendingPurchases,
      pendingSales,
      productionInProgress,
    },
    today: {
      productionQuantity: quantity(new Decimal(todayProduction._sum.producedQuantity?.toString() ?? 0)),
      salesTotal: money(todaySales),
    },
    inventoryValue: money(inventoryValue),
    recentProduction: recentProduction.map((order) => {
      const amount = order.status === 'COMPLETED' ? order.producedQuantity : order.plannedQuantity
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        productName: order.product.name,
        quantity: quantity(new Decimal(amount.toString())),
        unit: order.product.unit,
        status: order.status,
      }
    }),
    lowStock,
    recentPurchases: recentPurchases.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      party: order.supplier.name,
      status: order.status,
      total: money(new Decimal(order.total.toString())),
      orderDate: order.orderDate.toISOString().slice(0, 10),
    })),
    recentSales: recentSales.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      party: order.customer.name,
      status: order.status,
      total: money(new Decimal(order.total.toString())),
      orderDate: order.orderDate.toISOString().slice(0, 10),
    })),
  }
}
