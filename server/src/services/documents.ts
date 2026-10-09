import type { DocumentSequenceKey, Prisma, PaymentStatus } from '../../../generated/prisma/client'
import { Decimal, roundMoney, roundQuantity } from '../../../shared/domain/decimal'
import { badRequest, notFound } from '../utils/errors'
import { decimalOf, quantity } from '../utils/money'

export type Tx = Prisma.TransactionClient

const PREFIXES: Record<DocumentSequenceKey, string> = {
  PURCHASE_ORDER: 'PO',
  PURCHASE_RECEIPT: 'PR',
  SALES_ORDER: 'SO',
  SALES_DELIVERY: 'SD',
  PRODUCTION_ORDER: 'MO',
  STOCK_TRANSFER: 'ST',
}

export async function nextDocumentNumber(tx: Tx, companyId: string, key: DocumentSequenceKey) {
  const updated = await tx.numberSequence.update({
    where: { companyId_key: { companyId, key } },
    data: { lastValue: { increment: 1 } },
    select: { lastValue: true },
  })

  return `${PREFIXES[key]}-${String(updated.lastValue).padStart(5, '0')}`
}

export async function writeAudit(tx: Tx, input: {
  companyId: string
  userId: string
  action: string
  entity: string
  entityId?: string
  metadata?: Prisma.InputJsonValue
}) {
  await tx.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  })
}

export async function notify(tx: Tx, input: {
  companyId: string
  type: 'LOW_STOCK' | 'PRODUCTION_COMPLETED' | 'PURCHASE_RECEIVED' | 'SALES_DELIVERED' | 'GENERAL'
  title: string
  message: string
  entityType?: string
  entityId?: string
}) {
  await tx.notification.create({
    data: input,
  })
}

export function paymentStatusFor(total: Decimal, paid: Decimal): PaymentStatus {
  if (paid.lte(0)) {
    return 'UNPAID'
  }

  if (paid.gte(total)) {
    return 'PAID'
  }

  return 'PARTIAL'
}

export function priceLines(items: Array<{ productId: string, quantity: number, unitPrice: number }>) {
  const priced = items.map((item) => {
    const lineQuantity = roundQuantity(item.quantity)
    const unitPrice = roundMoney(item.unitPrice)
    return {
      productId: item.productId,
      quantity: lineQuantity,
      unitPrice,
      lineTotal: roundMoney(lineQuantity.mul(unitPrice)),
    }
  })
  const subtotal = roundMoney(priced.reduce((sum, item) => sum.plus(item.lineTotal), new Decimal(0)))

  return {
    priced,
    subtotal,
    total: subtotal,
  }
}

export async function loadActiveProducts(tx: Tx, companyId: string, ids: string[]) {
  const uniqueIds = [...new Set(ids)]
  const products = await tx.product.findMany({
    where: {
      companyId,
      id: { in: uniqueIds },
      isActive: true,
    },
  })

  if (products.length !== uniqueIds.length) {
    throw badRequest('One of the products is not available.')
  }

  return new Map(products.map(product => [product.id, product]))
}

export async function loadActiveWarehouse(tx: Tx, companyId: string, warehouseId: string) {
  const warehouse = await tx.warehouse.findFirst({
    where: { id: warehouseId, companyId, isActive: true },
  })

  if (!warehouse) {
    throw badRequest('Choose an active warehouse.')
  }

  return warehouse
}

export async function loadActiveParty(tx: Tx, kind: 'customer' | 'supplier', companyId: string, partyId: string) {
  const party = kind === 'customer'
    ? await tx.customer.findFirst({ where: { id: partyId, companyId, isActive: true } })
    : await tx.supplier.findFirst({ where: { id: partyId, companyId, isActive: true } })

  if (!party) {
    throw badRequest(kind === 'customer' ? 'Choose an active customer.' : 'Choose an active supplier.')
  }

  return party
}

export async function lockDocument(tx: Tx, table: 'PurchaseOrder' | 'SalesOrder' | 'ProductionOrder', id: string, companyId: string) {
  const rows = table === 'PurchaseOrder'
    ? await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PurchaseOrder" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`
    : table === 'SalesOrder'
      ? await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "SalesOrder" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`
      : await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "ProductionOrder" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`

  if (rows.length === 0) {
    throw notFound('That record was not found.')
  }
}

export function movedQuantity(current: Decimal.Value, added: Decimal) {
  return quantity(decimalOf(current).plus(added))
}
