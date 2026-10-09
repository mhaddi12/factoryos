import { hasPermission, type UserRole } from '../../../shared/auth/permissions'
import { Decimal } from '../../../shared/domain/decimal'
import type { ReportData } from '../../../shared/types/records'
import { forbidden } from '../utils/errors'
import { getPrisma } from '../database/prisma'
import { dateText, decimalOf, money, quantity } from '../utils/money'
import { listBalances } from './inventory'

function addOutstanding(rows: Array<{ total: { toString(): string }, amountPaid: { toString(): string }, status: string }>) {
  return rows.reduce((sum, row) => {
    if (row.status === 'CANCELLED') {
      return sum
    }
    return sum.plus(decimalOf(row.total).minus(decimalOf(row.amountPaid)))
  }, new Decimal(0))
}

export async function getReports(companyId: string, role: UserRole): Promise<ReportData> {
  const inventory = hasPermission(role, 'reports.inventory')
  const production = hasPermission(role, 'reports.production')
  const sales = hasPermission(role, 'reports.sales')
  const purchases = hasPermission(role, 'reports.purchases')
  const financial = hasPermission(role, 'reports.financial')

  if (!inventory && !production && !sales && !purchases && !financial) {
    throw forbidden()
  }

  const prisma = getPrisma()
  const report: ReportData = {
    inventory: null,
    production: null,
    sales: null,
    purchases: null,
    financial: null,
  }

  if (inventory || financial) {
    const balances = await listBalances(companyId)
    const inventoryValue = balances.reduce((sum, row) => sum.plus(decimalOf(row.value)), new Decimal(0))

    if (inventory) {
      const products = await prisma.product.findMany({
        where: { companyId, isActive: true, minimumStock: { gt: 0 } },
        select: { id: true, name: true, sku: true, unit: true, minimumStock: true },
      })
      const onHand = new Map<string, Decimal>()

      for (const row of balances) {
        onHand.set(row.productId, (onHand.get(row.productId) ?? new Decimal(0)).plus(decimalOf(row.quantity)))
      }

      report.inventory = {
        value: money(inventoryValue),
        rows: balances,
        lowStock: products.flatMap((product) => {
          const current = onHand.get(product.id) ?? new Decimal(0)
          if (current.gte(decimalOf(product.minimumStock))) {
            return []
          }
          return [{
            name: product.name,
            sku: product.sku,
            onHand: quantity(current),
            minimum: quantity(product.minimumStock.toString()),
            unit: product.unit,
          }]
        }),
      }
    }

    if (financial) {
      const [salesOrders, purchaseOrders, payments] = await Promise.all([
        prisma.salesOrder.findMany({
          where: { companyId, status: { not: 'CANCELLED' } },
          select: { total: true, amountPaid: true, status: true },
        }),
        prisma.purchaseOrder.findMany({
          where: { companyId, status: { not: 'CANCELLED' } },
          select: { total: true, amountPaid: true, status: true },
        }),
        prisma.payment.findMany({
          where: { companyId },
          select: { direction: true, amount: true },
        }),
      ])
      const incoming = payments.filter(payment => payment.direction === 'INCOMING')
        .reduce((sum, payment) => sum.plus(decimalOf(payment.amount)), new Decimal(0))
      const outgoing = payments.filter(payment => payment.direction === 'OUTGOING')
        .reduce((sum, payment) => sum.plus(decimalOf(payment.amount)), new Decimal(0))

      report.financial = {
        receivables: money(addOutstanding(salesOrders)),
        payables: money(addOutstanding(purchaseOrders)),
        inventoryValue: money(inventoryValue),
        incomingPayments: money(incoming),
        outgoingPayments: money(outgoing),
      }
    }
  }

  if (production) {
    const [orders, completedOrders] = await Promise.all([
      prisma.productionOrder.findMany({
        where: { companyId },
        include: { product: { select: { name: true, unit: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.productionOrder.findMany({
        where: { companyId, status: 'COMPLETED' },
        select: { producedQuantity: true, totalCost: true },
      }),
    ])
    report.production = {
      completedQuantity: quantity(completedOrders.reduce((sum, order) => sum.plus(decimalOf(order.producedQuantity)), new Decimal(0))),
      completedCost: money(completedOrders.reduce((sum, order) => sum.plus(decimalOf(order.totalCost)), new Decimal(0))),
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        productName: order.product.name,
        status: order.status,
        plannedQuantity: quantity(order.plannedQuantity.toString()),
        producedQuantity: quantity(order.producedQuantity.toString()),
        unit: order.product.unit,
        totalCost: money(order.totalCost.toString()),
      })),
    }
  }

  if (sales) {
    const [orders, totals] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { companyId },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.salesOrder.findMany({
        where: { companyId },
        select: { total: true, amountPaid: true, status: true },
      }),
    ])
    const active = totals.filter(order => order.status !== 'CANCELLED')
    report.sales = {
      orderTotal: money(active.reduce((sum, order) => sum.plus(decimalOf(order.total)), new Decimal(0))),
      outstanding: money(addOutstanding(totals)),
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        partyName: order.customer.name,
        orderDate: dateText(order.orderDate),
        status: order.status,
        total: money(order.total.toString()),
        amountPaid: money(order.amountPaid.toString()),
        paymentStatus: order.paymentStatus,
      })),
    }
  }

  if (purchases) {
    const [orders, totals] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { companyId },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.purchaseOrder.findMany({
        where: { companyId },
        select: { total: true, amountPaid: true, status: true },
      }),
    ])
    const active = totals.filter(order => order.status !== 'CANCELLED')
    report.purchases = {
      orderTotal: money(active.reduce((sum, order) => sum.plus(decimalOf(order.total)), new Decimal(0))),
      outstanding: money(addOutstanding(totals)),
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        partyName: order.supplier.name,
        orderDate: dateText(order.orderDate),
        status: order.status,
        total: money(order.total.toString()),
        amountPaid: money(order.amountPaid.toString()),
        paymentStatus: order.paymentStatus,
      })),
    }
  }

  return report
}
