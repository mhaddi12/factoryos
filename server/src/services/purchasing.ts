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
import { ensureBalances, postInbound } from './stock-ledger'
import type { Actor } from './types'

type DraftInput = {
  partyId: string
  warehouseId: string
  orderDate: string
  notes?: string
  items: Array<{ productId: string, quantity: number, unitPrice: number }>
}

type ReceiveInput = {
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
  supplier: { name: string }
}): OrderListItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    partyName: order.supplier.name,
    orderDate: dateText(order.orderDate),
    status: order.status,
    total: money(order.total.toString()),
    amountPaid: money(order.amountPaid.toString()),
    paymentStatus: order.paymentStatus,
  }
}

export async function listPurchaseOrders(companyId: string, query: { page: number, pageSize: number, search?: string }): Promise<OrderPage> {
  const where = {
    companyId,
    ...(query.search
      ? {
          OR: [
            { orderNumber: { contains: query.search, mode: 'insensitive' as const } },
            { supplier: { name: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }
  const prisma = getPrisma()
  const [total, orders] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      ...pageWindow(query.page, query.pageSize),
    }),
  ])

  return pageResult(orders.map(listItem), total, query.page, query.pageSize)
}

export async function getPurchaseOrder(companyId: string, orderId: string): Promise<OrderDetail> {
  const order = await getPrisma().purchaseOrder.findFirst({
    where: { id: orderId, companyId },
    include: {
      supplier: true,
      warehouse: true,
      items: { include: { product: true }, orderBy: { product: { name: 'asc' } } },
      receipts: { include: { items: { include: { product: true } } }, orderBy: { receivedAt: 'desc' } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
  })

  if (!order) {
    throw notFound('Purchase order not found.')
  }

  return {
    ...listItem(order),
    partyId: order.supplierId,
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
      movedQuantity: quantity(item.receivedQuantity.toString()),
      unitPrice: money(item.unitPrice.toString()),
      lineTotal: money(item.lineTotal.toString()),
    })),
    documents: order.receipts.map(receipt => ({
      id: receipt.id,
      number: receipt.receiptNumber,
      at: receipt.receivedAt.toISOString(),
      items: receipt.items.map(item => ({
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
  const supplier = await loadActiveParty(tx, 'supplier', actor.companyId, input.partyId)
  const warehouse = await loadActiveWarehouse(tx, actor.companyId, input.warehouseId)
  const products = await loadActiveProducts(tx, actor.companyId, input.items.map(item => item.productId))
  const priced = priceLines(input.items)
  const items = priced.priced.map((item) => {
    const product = products.get(item.productId)!
    return {
      productId: item.productId,
      quantity: quantity(item.quantity),
      receivedQuantity: quantity(0),
      unit: product.unit,
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
    }
  })
  const shared = {
    supplierId: supplier.id,
    warehouseId: warehouse.id,
    orderDate: dateOnly(input.orderDate),
    subtotal: money(priced.subtotal),
    discount: money(0),
    tax: money(0),
    total: money(priced.total),
    notes: blankToNull(input.notes),
  }

  if (!orderId) {
    const orderNumber = await nextDocumentNumber(tx, actor.companyId, 'PURCHASE_ORDER')
    return tx.purchaseOrder.create({
      data: {
        companyId: actor.companyId,
        orderNumber,
        ...shared,
        createdById: actor.userId,
        items: { create: items },
      },
    })
  }

  await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: orderId } })
  return tx.purchaseOrder.update({
    where: { id: orderId },
    data: {
      ...shared,
      items: { create: items },
    },
  })
}

export async function createPurchaseOrder(actor: Actor, input: DraftInput) {
  try {
    const orderId = await getPrisma().$transaction(async (tx) => {
      const order = await writeDraft(tx, actor, input)
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'purchase_order.created',
        entity: 'PurchaseOrder',
        entityId: order.id,
        metadata: { orderNumber: order.orderNumber },
      })
      return order.id
    })
    return getPurchaseOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That purchase order could not be saved.')
  }
}

export async function updatePurchaseOrder(actor: Actor, orderId: string, input: DraftInput) {
  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'PurchaseOrder', orderId, actor.companyId)
      const existing = await tx.purchaseOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
      })

      if (!existing) {
        throw notFound('Purchase order not found.')
      }

      if (existing.status !== 'DRAFT') {
        throw badRequest('Only a draft purchase order can be edited.')
      }

      await writeDraft(tx, actor, input, orderId)
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'purchase_order.updated',
        entity: 'PurchaseOrder',
        entityId: orderId,
      })
    })
    return getPurchaseOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That purchase order could not be saved.')
  }
}

export async function confirmPurchaseOrder(actor: Actor, orderId: string) {
  await getPrisma().$transaction(async (tx) => {
    await lockDocument(tx, 'PurchaseOrder', orderId, actor.companyId)
    const order = await tx.purchaseOrder.findFirst({
      where: { id: orderId, companyId: actor.companyId },
      include: { items: true },
    })

    if (!order) {
      throw notFound('Purchase order not found.')
    }

    if (order.status !== 'DRAFT') {
      throw badRequest('Only a draft purchase order can be confirmed.')
    }

    if (order.items.length === 0) {
      throw badRequest('Add at least one line before confirming.')
    }

    await tx.purchaseOrder.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
    })
    await writeAudit(tx, {
      companyId: actor.companyId,
      userId: actor.userId,
      action: 'purchase_order.confirmed',
      entity: 'PurchaseOrder',
      entityId: orderId,
      metadata: { orderNumber: order.orderNumber },
    })
  })
  return getPurchaseOrder(actor.companyId, orderId)
}

export async function cancelPurchaseOrder(actor: Actor, orderId: string) {
  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'PurchaseOrder', orderId, actor.companyId)
      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
      })

      if (!order) {
        throw notFound('Purchase order not found.')
      }

      if (order.status !== 'DRAFT' && order.status !== 'CONFIRMED') {
        throw badRequest('This purchase order can no longer be cancelled.')
      }

      await tx.purchaseOrder.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'purchase_order.cancelled',
        entity: 'PurchaseOrder',
        entityId: orderId,
      })
    })
    return getPurchaseOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That purchase order could not be cancelled.')
  }
}

export async function receivePurchaseOrder(actor: Actor, orderId: string, input: ReceiveInput) {
  const lines = input.items.filter(item => item.quantity > 0)

  if (lines.length === 0) {
    throw badRequest('Enter a quantity to receive.')
  }

  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'PurchaseOrder', orderId, actor.companyId)
      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
        include: { items: { include: { product: true } } },
      })

      if (!order) {
        throw notFound('Purchase order not found.')
      }

      if (order.status !== 'CONFIRMED' && order.status !== 'PARTIALLY_RECEIVED') {
        throw badRequest('Confirm the purchase order before receiving it.')
      }

      const prepared = lines.map((line) => {
        const item = order.items.find(entry => entry.id === line.itemId)

        if (!item) {
          throw badRequest('One of the lines is not on this purchase order.')
        }

        const remaining = decimalOf(item.quantity).minus(decimalOf(item.receivedQuantity))
        const received = decimalOf(line.quantity)

        if (received.gt(remaining)) {
          throw badRequest(`${item.product.name} only has ${quantity(remaining)} ${item.unit} left to receive.`)
        }

        return { item, received }
      })

      await ensureBalances(tx, actor.companyId, prepared.map(line => ({
        productId: line.item.productId,
        warehouseId: order.warehouseId,
      })))

      const receiptNumber = await nextDocumentNumber(tx, actor.companyId, 'PURCHASE_RECEIPT')
      const receipt = await tx.purchaseReceipt.create({
        data: {
          companyId: actor.companyId,
          purchaseOrderId: order.id,
          receiptNumber,
          warehouseId: order.warehouseId,
          receivedAt: new Date(),
          createdById: actor.userId,
          items: {
            create: prepared.map(line => ({
              productId: line.item.productId,
              quantity: quantity(line.received),
              unitCost: money(line.item.unitPrice.toString()),
              lineTotal: money(line.received.mul(decimalOf(line.item.unitPrice))),
            })),
          },
        },
        include: { items: true },
      })

      for (const receiptItem of receipt.items) {
        const line = prepared.find(entry => entry.item.productId === receiptItem.productId)!
        const next = await postInbound(tx, {
          companyId: actor.companyId,
          productId: receiptItem.productId,
          warehouseId: order.warehouseId,
          type: 'PURCHASE',
          quantity: receiptItem.quantity.toString(),
          unitCost: receiptItem.unitCost.toString(),
          referenceType: 'PURCHASE_RECEIPT_ITEM',
          referenceId: receiptItem.id,
          createdById: actor.userId,
          productName: line.item.product.name,
        })
        await tx.purchaseOrderItem.update({
          where: { id: line.item.id },
          data: { receivedQuantity: movedQuantity(line.item.receivedQuantity, line.received) },
        })
        await tx.product.update({
          where: { id: receiptItem.productId },
          data: { costPrice: money(next.averageCost) },
        })
      }

      const fullyReceived = order.items.every((item) => {
        const line = prepared.find(entry => entry.item.id === item.id)
        const received = decimalOf(item.receivedQuantity).plus(line?.received ?? new Decimal(0))
        return received.gte(decimalOf(item.quantity))
      })

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
      })
      await notify(tx, {
        companyId: actor.companyId,
        type: 'PURCHASE_RECEIVED',
        title: 'Purchase received',
        message: `${order.orderNumber} was received.`,
        entityType: 'PurchaseOrder',
        entityId: order.id,
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'purchase_order.received',
        entity: 'PurchaseOrder',
        entityId: order.id,
        metadata: { orderNumber: order.orderNumber, receiptNumber },
      })
    })
    return getPurchaseOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That receipt could not be saved.')
  }
}

export async function payPurchaseOrder(actor: Actor, orderId: string, input: PaymentInput) {
  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'PurchaseOrder', orderId, actor.companyId)
      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
      })

      if (!order) {
        throw notFound('Purchase order not found.')
      }

      if (order.status === 'DRAFT' || order.status === 'CANCELLED') {
        throw badRequest('Confirm the purchase order before recording a payment.')
      }

      const amount = decimalOf(input.amount)
      const paid = decimalOf(order.amountPaid).plus(amount)

      if (paid.gt(decimalOf(order.total))) {
        throw badRequest('The payment is more than the balance due.')
      }

      await tx.payment.create({
        data: {
          companyId: actor.companyId,
          direction: 'OUTGOING',
          method: input.method,
          amount: money(amount),
          paidAt: dateOnly(input.paidAt),
          supplierId: order.supplierId,
          purchaseOrderId: order.id,
          reference: blankToNull(input.reference),
          notes: blankToNull(input.notes),
          createdById: actor.userId,
        },
      })
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          amountPaid: money(paid),
          paymentStatus: paymentStatusFor(decimalOf(order.total), paid),
        },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'purchase_order.payment',
        entity: 'PurchaseOrder',
        entityId: order.id,
        metadata: { amount: money(amount) },
      })
    })
    return getPurchaseOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That payment could not be saved.')
  }
}
