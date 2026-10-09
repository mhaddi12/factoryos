import type { MovementPage, StockBalanceRow } from '../../../shared/types/records'
import { badRequest } from '../utils/errors'
import { getPrisma } from '../database/prisma'
import { mapDatabaseError } from '../utils/db-error'
import { blankToNull, decimalOf, money, quantity } from '../utils/money'
import { pageResult, pageWindow } from '../utils/paging'
import { loadActiveProducts, loadActiveWarehouse, nextDocumentNumber, writeAudit } from './documents'
import { ensureBalances, postInbound, postOutbound } from './stock-ledger'
import type { Actor } from './types'

export async function listBalances(companyId: string): Promise<StockBalanceRow[]> {
  const balances = await getPrisma().stockBalance.findMany({
    where: { companyId },
    include: {
      product: { select: { name: true, sku: true, unit: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: [{ product: { name: 'asc' } }, { warehouse: { name: 'asc' } }],
  })

  return balances.map(balance => ({
    id: balance.id,
    productId: balance.productId,
    productName: balance.product.name,
    sku: balance.product.sku,
    unit: balance.product.unit,
    warehouseId: balance.warehouseId,
    warehouseName: balance.warehouse.name,
    quantity: quantity(balance.quantity.toString()),
    averageCost: money(balance.averageCost.toString()),
    value: money(decimalOf(balance.quantity).mul(decimalOf(balance.averageCost))),
  }))
}

export async function listMovements(companyId: string, query: { page: number, pageSize: number, search?: string }): Promise<MovementPage> {
  const where = {
    companyId,
    ...(query.search
      ? {
          OR: [
            { product: { name: { contains: query.search, mode: 'insensitive' as const } } },
            { product: { sku: { contains: query.search, mode: 'insensitive' as const } } },
            { warehouse: { name: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }
  const prisma = getPrisma()
  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        warehouse: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...pageWindow(query.page, query.pageSize),
    }),
  ])

  return pageResult(movements.map(movement => ({
    id: movement.id,
    createdAt: movement.createdAt.toISOString(),
    type: movement.type,
    productName: movement.product.name,
    sku: movement.product.sku,
    warehouseName: movement.warehouse.name,
    quantity: quantity(movement.quantity.toString()),
    unit: movement.product.unit,
    unitCost: money(movement.unitCost.toString()),
    notes: movement.notes,
    createdByName: movement.createdBy.name,
  })), total, query.page, query.pageSize)
}

export async function adjustStock(actor: Actor, input: {
  productId: string
  warehouseId: string
  direction: 'IN' | 'OUT'
  quantity: number
  unitCost?: number
  notes?: string
}) {
  try {
    await getPrisma().$transaction(async (tx) => {
      const products = await loadActiveProducts(tx, actor.companyId, [input.productId])
      const product = products.get(input.productId)!
      await loadActiveWarehouse(tx, actor.companyId, input.warehouseId)
      const notes = blankToNull(input.notes)

      if (input.direction === 'IN') {
        if (input.unitCost === undefined) {
          throw badRequest('Enter the unit cost.')
        }

        await postInbound(tx, {
          companyId: actor.companyId,
          productId: product.id,
          warehouseId: input.warehouseId,
          type: 'ADJUSTMENT',
          quantity: input.quantity,
          unitCost: input.unitCost,
          referenceType: null,
          referenceId: null,
          notes,
          createdById: actor.userId,
          productName: product.name,
        })
      } else {
        await postOutbound(tx, {
          companyId: actor.companyId,
          productId: product.id,
          warehouseId: input.warehouseId,
          type: 'ADJUSTMENT',
          quantity: input.quantity,
          referenceType: null,
          referenceId: null,
          notes,
          createdById: actor.userId,
          productName: product.name,
        })
      }

      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'stock.adjusted',
        entity: 'Product',
        entityId: product.id,
        metadata: { direction: input.direction, quantity: input.quantity },
      })
    })
  } catch (error) {
    mapDatabaseError(error, 'That adjustment could not be saved.')
  }
}

export async function transferStock(actor: Actor, input: {
  productId: string
  fromWarehouseId: string
  toWarehouseId: string
  quantity: number
  notes?: string
}) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw badRequest('Choose two different warehouses.')
  }

  try {
    await getPrisma().$transaction(async (tx) => {
      const products = await loadActiveProducts(tx, actor.companyId, [input.productId])
      const product = products.get(input.productId)!
      await loadActiveWarehouse(tx, actor.companyId, input.fromWarehouseId)
      await loadActiveWarehouse(tx, actor.companyId, input.toWarehouseId)
      await ensureBalances(tx, actor.companyId, [
        { productId: product.id, warehouseId: input.fromWarehouseId },
        { productId: product.id, warehouseId: input.toWarehouseId },
      ])

      const transferNumber = await nextDocumentNumber(tx, actor.companyId, 'STOCK_TRANSFER')
      const transfer = await tx.stockTransfer.create({
        data: {
          companyId: actor.companyId,
          transferNumber,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          notes: blankToNull(input.notes),
          createdById: actor.userId,
          items: {
            create: {
              productId: product.id,
              quantity: quantity(input.quantity),
            },
          },
        },
        include: { items: true },
      })
      const item = transfer.items[0]!
      const issued = await postOutbound(tx, {
        companyId: actor.companyId,
        productId: product.id,
        warehouseId: input.fromWarehouseId,
        type: 'TRANSFER_OUT',
        quantity: input.quantity,
        referenceType: 'STOCK_TRANSFER_ITEM',
        referenceId: item.id,
        notes: blankToNull(input.notes),
        createdById: actor.userId,
        productName: product.name,
      })
      await postInbound(tx, {
        companyId: actor.companyId,
        productId: product.id,
        warehouseId: input.toWarehouseId,
        type: 'TRANSFER_IN',
        quantity: input.quantity,
        unitCost: money(issued.unitCost),
        referenceType: 'STOCK_TRANSFER_ITEM',
        referenceId: item.id,
        notes: blankToNull(input.notes),
        createdById: actor.userId,
        productName: product.name,
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'stock.transferred',
        entity: 'StockTransfer',
        entityId: transfer.id,
        metadata: { transferNumber },
      })
    })
  } catch (error) {
    mapDatabaseError(error, 'That transfer could not be saved.')
  }
}
