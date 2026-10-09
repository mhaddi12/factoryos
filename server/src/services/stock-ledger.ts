import { randomUUID } from 'node:crypto'
import type { StockMovementType } from '../../../generated/prisma/client'
import { applyInbound, applyOutbound } from '../../../shared/domain/stock'
import { badRequest } from '../utils/errors'
import { decimalOf, money, quantity } from '../utils/money'
import { notify, type Tx } from './documents'

type StockPost = {
  companyId: string
  productId: string
  warehouseId: string
  type: StockMovementType
  quantity: number | string
  unitCost?: number | string
  referenceType: string | null
  referenceId: string | null
  notes?: string | null
  createdById: string
  productName?: string
}

async function lockBalance(tx: Tx, companyId: string, productId: string, warehouseId: string) {
  await tx.$executeRaw`
    INSERT INTO "StockBalance" ("id", "companyId", "productId", "warehouseId", "quantity", "averageCost", "updatedAt")
    VALUES (${randomUUID()}, ${companyId}, ${productId}, ${warehouseId}, 0, 0, NOW())
    ON CONFLICT ("companyId", "productId", "warehouseId") DO NOTHING
  `

  const rows = await tx.$queryRaw<Array<{ quantity: string, averageCost: string }>>`
    SELECT "quantity"::text AS "quantity", "averageCost"::text AS "averageCost"
    FROM "StockBalance"
    WHERE "companyId" = ${companyId}
      AND "productId" = ${productId}
      AND "warehouseId" = ${warehouseId}
    FOR UPDATE
  `
  const row = rows[0]

  if (!row) {
    throw badRequest('Stock for this product could not be opened.')
  }

  return {
    quantity: decimalOf(row.quantity),
    averageCost: decimalOf(row.averageCost),
  }
}

async function saveBalance(tx: Tx, companyId: string, productId: string, warehouseId: string, state: { quantity: { toString(): string }, averageCost: { toString(): string } }) {
  await tx.stockBalance.update({
    where: {
      companyId_productId_warehouseId: { companyId, productId, warehouseId },
    },
    data: {
      quantity: quantity(state.quantity.toString()),
      averageCost: money(state.averageCost.toString()),
    },
  })
}

async function rememberLowStock(tx: Tx, companyId: string, productId: string) {
  const product = await tx.product.findFirst({
    where: { id: productId, companyId },
    select: { name: true, minimumStock: true },
  })

  if (!product || decimalOf(product.minimumStock).lte(0)) {
    return
  }

  const totals = await tx.stockBalance.aggregate({
    where: { companyId, productId },
    _sum: { quantity: true },
  })
  const onHand = decimalOf(totals._sum.quantity ?? 0)

  if (onHand.gte(decimalOf(product.minimumStock))) {
    return
  }

  const existing = await tx.notification.findFirst({
    where: {
      companyId,
      type: 'LOW_STOCK',
      entityType: 'Product',
      entityId: productId,
      isRead: false,
    },
  })

  if (existing) {
    return
  }

  await notify(tx, {
    companyId,
    type: 'LOW_STOCK',
    title: 'Low stock',
    message: `${product.name} is below its minimum stock.`,
    entityType: 'Product',
    entityId: productId,
  })
}

function rejectStockError(error: unknown, productName?: string): never {
  if (error instanceof Error && error.message === 'Insufficient stock.') {
    throw badRequest(productName
      ? `${productName} does not have enough stock in this warehouse.`
      : 'There is not enough stock in that warehouse.')
  }

  if (error instanceof Error && error.message) {
    throw badRequest(error.message)
  }

  throw error
}

export async function ensureBalances(tx: Tx, companyId: string, pairs: Array<{ productId: string, warehouseId: string }>) {
  const unique = [...new Map(pairs.map(pair => [`${pair.productId}:${pair.warehouseId}`, pair])).values()]
  unique.sort((left, right) => `${left.productId}:${left.warehouseId}`.localeCompare(`${right.productId}:${right.warehouseId}`))

  for (const pair of unique) {
    await lockBalance(tx, companyId, pair.productId, pair.warehouseId)
  }
}

export async function postInbound(tx: Tx, input: StockPost) {
  const current = await lockBalance(tx, input.companyId, input.productId, input.warehouseId)
  let next

  try {
    next = applyInbound(current, input.quantity, input.unitCost ?? 0)
  } catch (error) {
    rejectStockError(error, input.productName)
  }

  await saveBalance(tx, input.companyId, input.productId, input.warehouseId, next)
  await tx.stockMovement.create({
    data: {
      companyId: input.companyId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: quantity(input.quantity),
      unitCost: money(input.unitCost ?? 0),
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes,
      createdById: input.createdById,
    },
  })
  await rememberLowStock(tx, input.companyId, input.productId)
  return next
}

export async function postOutbound(tx: Tx, input: StockPost) {
  const current = await lockBalance(tx, input.companyId, input.productId, input.warehouseId)
  let next

  try {
    next = applyOutbound(current, input.quantity)
  } catch (error) {
    rejectStockError(error, input.productName)
  }

  await saveBalance(tx, input.companyId, input.productId, input.warehouseId, next)
  await tx.stockMovement.create({
    data: {
      companyId: input.companyId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: quantity(decimalOf(input.quantity).negated()),
      unitCost: money(current.averageCost),
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes,
      createdById: input.createdById,
    },
  })
  await rememberLowStock(tx, input.companyId, input.productId)
  return {
    state: next,
    unitCost: current.averageCost,
  }
}
