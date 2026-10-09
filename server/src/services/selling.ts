import { Decimal } from '../../../shared/domain/decimal'
import type { OrderDetail, OrderListItem, OrderPage } from '../../../shared/types/records'
import { badRequest, notFound } from '../utils/errors'
import { getPrisma } from '../database/prisma'
import { mapDatabaseError } from '../utils/db-error'
import { blankToNull, dateOnly, dateText, decimalOf, money, quantity } from '../utils/money'
import { pageResult, pageWindow } from '../utils/paging'
import {
  loadActiveParty,
  loadActiveProducts,
  loadActiveWarehouse,
  lockDocument,
  movedQuantity,
  nextDocumentNumber,
  notify,
  paymentStatusFor,
  priceLines,
  writeAudit,
} from './documents'
import { ensureBalances, postOutbound } from './stock-ledger'
import type { Actor } from './types'

type DraftInput = {
  partyId: string
  warehouseId: string
  orderDate: string
  notes?: string
  items: Array<{ productId: string, quantity: number, unitPrice: number }>
}

type DeliverInput = {
  items: Array<{ itemId: string, quantity: number }>
}

type PaymentInput = {
  amount: number
  method: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'
  paidAt: string
  reference?: string
  notes?: string
}

function listItem(order: {
  id: string
  orderNumber: string
  orderDate: Date
  status: string
  total: { toString(): string }
  amountPaid: { toString(): string }
  paymentStatus: string
  customer: { name: string }
}): OrderListItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    partyName: order.customer.name,
    orderDate: dateText(order.orderDate),
    status: order.status,
    total: money(order.total.toString()),
    amountPaid: money(order.amountPaid.toString()),
    paymentStatus: order.paymentStatus,
  }
}

export async function listSalesOrders(companyId: string, query: { page: number, pageSize: number, search?: string }): Promise<OrderPage> {
  const where = {
    companyId,
    ...(query.search
      ? {
          OR: [
            { orderNumber: { contains: query.search, mode: 'insensitive' as const } },
            { customer: { name: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }
  const prisma = getPrisma()
  const [total, orders] = await Promise.all([
    prisma.salesOrder.count({ where }),
    prisma.salesOrder.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      ...pageWindow(query.page, query.pageSize),
    }),
  ])

  return pageResult(orders.map(listItem), total, query.page, query.pageSize)
}

export async function getSalesOrder(companyId: string, orderId: string): Promise<OrderDetail> {
  const order = await getPrisma().salesOrder.findFirst({
    where: { id: orderId, companyId },
    include: {
      customer: true,
      warehouse: true,
      items: { include: { product: true }, orderBy: { product: { name: 'asc' } } },
      deliveries: { include: { items: { include: { product: true } } }, orderBy: { deliveredAt: 'desc' } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
  })

  if (!order) {
    throw notFound('Sales order not found.')
  }

  return {
    ...listItem(order),
    partyId: order.customerId,
    warehouseId: order.warehouseId,
    warehouseName: order.warehouse.name,
    notes: order.notes,
    subtotal: money(order.subtotal.toString()),
    discount: money(order.discount.toString()),
    tax: money(order.tax.toString()),
    items: order.items.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      sku: item.product.sku,
      unit: item.unit,
      quantity: quantity(item.quantity.toString()),
      movedQuantity: quantity(item.deliveredQuantity.toString()),
      unitPrice: money(item.unitPrice.toString()),
      lineTotal: money(item.lineTotal.toString()),
    })),
    documents: order.deliveries.map(delivery => ({
      id: delivery.id,
      number: delivery.deliveryNumber,
      at: delivery.deliveredAt.toISOString(),
      items: delivery.items.map(item => ({
        productName: item.product.name,
        quantity: quantity(item.quantity.toString()),
        unitCost: money(item.unitCost.toString()),
      })),
    })),
    payments: order.payments.map(payment => ({
      id: payment.id,
      amount: money(payment.amount.toString()),
      method: payment.method,
      paidAt: dateText(payment.paidAt),
      reference: payment.reference,
    })),
  }
}

async function writeDraft(tx: Parameters<typeof loadActiveProducts>[0], actor: Actor, input: DraftInput, orderId?: string) {
  const customer = await loadActiveParty(tx, 'customer', actor.companyId, input.partyId)
  const warehouse = await loadActiveWarehouse(tx, actor.companyId, input.warehouseId)
  const products = await loadActiveProducts(tx, actor.companyId, input.items.map(item => item.productId))
  const priced = priceLines(input.items)
  const items = priced.priced.map((item) => {
    const product = products.get(item.productId)!
    return {
      productId: item.productId,
      quantity: quantity(item.quantity),
      deliveredQuantity: quantity(0),
      unit: product.unit,
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
    }
  })
  const shared = {
    customerId: customer.id,
    warehouseId: warehouse.id,
    orderDate: dateOnly(input.orderDate),
    subtotal: money(priced.subtotal),
    discount: money(0),
    tax: money(0),
    total: money(priced.total),
    notes: blankToNull(input.notes),
  }

  if (!orderId) {
    const orderNumber = await nextDocumentNumber(tx, actor.companyId, 'SALES_ORDER')
    return tx.salesOrder.create({
      data: {
        companyId: actor.companyId,
        orderNumber,
        ...shared,
        createdById: actor.userId,
        items: { create: items },
      },
    })
  }

  await tx.salesOrderItem.deleteMany({ where: { salesOrderId: orderId } })
  return tx.salesOrder.update({
    where: { id: orderId },
    data: {
      ...shared,
      items: { create: items },
    },
  })
}

export async function createSalesOrder(actor: Actor, input: DraftInput) {
  try {
    const orderId = await getPrisma().$transaction(async (tx) => {
      const order = await writeDraft(tx, actor, input)
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'sales_order.created',
        entity: 'SalesOrder',
        entityId: order.id,
        metadata: { orderNumber: order.orderNumber },
      })
      return order.id
    })
    return getSalesOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That sales order could not be saved.')
  }
}

export async function updateSalesOrder(actor: Actor, orderId: string, input: DraftInput) {
  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'SalesOrder', orderId, actor.companyId)
      const existing = await tx.salesOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
      })

      if (!existing) {
        throw notFound('Sales order not found.')
      }

      if (existing.status !== 'DRAFT') {
        throw badRequest('Only a draft sales order can be edited.')
      }

      await writeDraft(tx, actor, input, orderId)
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'sales_order.updated',
        entity: 'SalesOrder',
        entityId: orderId,
      })
    })
    return getSalesOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That sales order could not be saved.')
  }
}

export async function confirmSalesOrder(actor: Actor, orderId: string) {
  await getPrisma().$transaction(async (tx) => {
    await lockDocument(tx, 'SalesOrder', orderId, actor.companyId)
    const order = await tx.salesOrder.findFirst({
      where: { id: orderId, companyId: actor.companyId },
      include: { items: true },
    })

    if (!order) {
      throw notFound('Sales order not found.')
    }

    if (order.status !== 'DRAFT') {
      throw badRequest('Only a draft sales order can be confirmed.')
    }

    if (order.items.length === 0) {
      throw badRequest('Add at least one line before confirming.')
    }

    await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
    })
    await writeAudit(tx, {
      companyId: actor.companyId,
      userId: actor.userId,
      action: 'sales_order.confirmed',
      entity: 'SalesOrder',
      entityId: orderId,
      metadata: { orderNumber: order.orderNumber },
    })
  })
  return getSalesOrder(actor.companyId, orderId)
}

export async function cancelSalesOrder(actor: Actor, orderId: string) {
  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'SalesOrder', orderId, actor.companyId)
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
      })

      if (!order) {
        throw notFound('Sales order not found.')
      }

      if (order.status !== 'DRAFT' && order.status !== 'CONFIRMED') {
        throw badRequest('This sales order can no longer be cancelled.')
      }

      await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'sales_order.cancelled',
        entity: 'SalesOrder',
        entityId: orderId,
      })
    })
    return getSalesOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That sales order could not be cancelled.')
  }
}

export async function deliverSalesOrder(actor: Actor, orderId: string, input: DeliverInput) {
  const lines = input.items.filter(item => item.quantity > 0)

  if (lines.length === 0) {
    throw badRequest('Enter a quantity to deliver.')
  }

  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'SalesOrder', orderId, actor.companyId)
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
        include: { items: { include: { product: true } }, customer: true },
      })

      if (!order) {
        throw notFound('Sales order not found.')
      }

      if (order.status !== 'CONFIRMED' && order.status !== 'PARTIALLY_DELIVERED') {
        throw badRequest('Confirm the sales order before delivering it.')
      }

      const prepared = lines.map((line) => {
        const item = order.items.find(entry => entry.id === line.itemId)

        if (!item) {
          throw badRequest('One of the lines is not on this sales order.')
        }

        const remaining = decimalOf(item.quantity).minus(decimalOf(item.deliveredQuantity))
        const delivered = decimalOf(line.quantity)

        if (delivered.gt(remaining)) {
          throw badRequest(`${item.product.name} only has ${quantity(remaining)} ${item.unit} left to deliver.`)
        }

        return { item, delivered }
      })

      await ensureBalances(tx, actor.companyId, prepared.map(line => ({
        productId: line.item.productId,
        warehouseId: order.warehouseId,
      })))

      const deliveryNumber = await nextDocumentNumber(tx, actor.companyId, 'SALES_DELIVERY')
      const delivery = await tx.salesDelivery.create({
        data: {
          companyId: actor.companyId,
          salesOrderId: order.id,
          deliveryNumber,
          warehouseId: order.warehouseId,
          deliveredAt: new Date(),
          createdById: actor.userId,
          items: {
            create: prepared.map(line => ({
              productId: line.item.productId,
              quantity: quantity(line.delivered),
              unitCost: money(0),
              lineTotal: money(0),
            })),
          },
        },
        include: { items: true },
      })

      for (const deliveryItem of delivery.items) {
        const line = prepared.find(entry => entry.item.productId === deliveryItem.productId)!
        const issued = await postOutbound(tx, {
          companyId: actor.companyId,
          productId: deliveryItem.productId,
          warehouseId: order.warehouseId,
          type: 'SALE',
          quantity: deliveryItem.quantity.toString(),
          referenceType: 'SALES_DELIVERY_ITEM',
          referenceId: deliveryItem.id,
          createdById: actor.userId,
          productName: line.item.product.name,
        })
        const lineTotal = issued.unitCost.mul(line.delivered)
        await tx.salesDeliveryItem.update({
          where: { id: deliveryItem.id },
          data: {
            unitCost: money(issued.unitCost),
            lineTotal: money(lineTotal),
          },
        })
        await tx.salesOrderItem.update({
          where: { id: line.item.id },
          data: { deliveredQuantity: movedQuantity(line.item.deliveredQuantity, line.delivered) },
        })
      }

      const fullyDelivered = order.items.every((item) => {
        const line = prepared.find(entry => entry.item.id === item.id)
        const delivered = decimalOf(item.deliveredQuantity).plus(line?.delivered ?? new Decimal(0))
        return delivered.gte(decimalOf(item.quantity))
      })

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: fullyDelivered ? 'DELIVERED' : 'PARTIALLY_DELIVERED' },
      })
      await notify(tx, {
        companyId: actor.companyId,
        type: 'SALES_DELIVERED',
        title: 'Sales order delivered',
        message: `${order.orderNumber} was delivered to ${order.customer.name}.`,
        entityType: 'SalesOrder',
        entityId: order.id,
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'sales_order.delivered',
        entity: 'SalesOrder',
        entityId: order.id,
        metadata: { orderNumber: order.orderNumber, deliveryNumber },
      })
    })
    return getSalesOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That delivery could not be saved.')
  }
}

export async function paySalesOrder(actor: Actor, orderId: string, input: PaymentInput) {
  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'SalesOrder', orderId, actor.companyId)
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
      })

      if (!order) {
        throw notFound('Sales order not found.')
      }

      if (order.status === 'DRAFT' || order.status === 'CANCELLED') {
        throw badRequest('Confirm the sales order before recording a payment.')
      }

      const amount = decimalOf(input.amount)
      const paid = decimalOf(order.amountPaid).plus(amount)

      if (paid.gt(decimalOf(order.total))) {
        throw badRequest('The payment is more than the balance due.')
      }

      await tx.payment.create({
        data: {
          companyId: actor.companyId,
          direction: 'INCOMING',
          method: input.method,
          amount: money(amount),
          paidAt: dateOnly(input.paidAt),
          customerId: order.customerId,
          salesOrderId: order.id,
          reference: blankToNull(input.reference),
          notes: blankToNull(input.notes),
          createdById: actor.userId,
        },
      })
      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          amountPaid: money(paid),
          paymentStatus: paymentStatusFor(decimalOf(order.total), paid),
        },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'sales_order.payment',
        entity: 'SalesOrder',
        entityId: order.id,
        metadata: { amount: money(amount) },
      })
    })
    return getSalesOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That payment could not be saved.')
  }
}
