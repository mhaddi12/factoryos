import { Decimal } from '../../../shared/domain/decimal'
import { calculateProductionCost } from '../../../shared/domain/costing'
import { calculateMaterialRequirement } from '../../../shared/domain/materials'
import type { BomRecord, ProductionRecord } from '../../../shared/types/records'
import { badRequest, notFound } from '../utils/errors'
import { getPrisma } from '../database/prisma'
import { mapDatabaseError } from '../utils/db-error'
import { blankToNull, dateOnly, dateText, decimalOf, money, quantity } from '../utils/money'
import {
  loadActiveProducts,
  loadActiveWarehouse,
  lockDocument,
  nextDocumentNumber,
  notify,
  writeAudit,
} from './documents'
import { ensureBalances, postInbound, postOutbound } from './stock-ledger'
import type { Actor } from './types'

type BomInput = {
  productId: string
  name: string
  items: Array<{ materialProductId: string, quantity: number, wastagePercentage: number }>
}

type ProductionInput = {
  productId: string
  bomId: string
  materialWarehouseId: string
  outputWarehouseId: string
  plannedQuantity: number
  plannedStartDate?: string
  notes?: string
}

function bomRecord(bom: {
  id: string
  name: string
  version: number
  isActive: boolean
  productId: string
  product: { name: string, sku: string }
  items: Array<{
    id: string
    materialProductId: string
    quantity: { toString(): string }
    unit: string
    wastagePercentage: { toString(): string }
    material: { name: string, sku: string }
  }>
}): BomRecord {
  return {
    id: bom.id,
    name: bom.name,
    version: bom.version,
    isActive: bom.isActive,
    productId: bom.productId,
    productName: bom.product.name,
    sku: bom.product.sku,
    items: bom.items.map(item => ({
      id: item.id,
      materialProductId: item.materialProductId,
      materialName: item.material.name,
      sku: item.material.sku,
      quantity: quantity(item.quantity.toString()),
      unit: item.unit,
      wastagePercentage: quantity(item.wastagePercentage.toString()),
    })),
  }
}

const bomInclude = {
  product: { select: { name: true, sku: true } },
  items: {
    include: { material: { select: { name: true, sku: true } } },
    orderBy: { material: { name: 'asc' as const } },
  },
}

export async function listBoms(companyId: string) {
  const boms = await getPrisma().bom.findMany({
    where: { companyId },
    include: bomInclude,
    orderBy: [{ product: { name: 'asc' } }, { version: 'desc' }],
  })
  return boms.map(bomRecord)
}

export async function getBom(companyId: string, bomId: string) {
  const bom = await getPrisma().bom.findFirst({
    where: { id: bomId, companyId },
    include: bomInclude,
  })

  if (!bom) {
    throw notFound('BOM not found.')
  }

  return bomRecord(bom)
}

export async function createBom(actor: Actor, input: BomInput) {
  try {
    const bomId = await getPrisma().$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: input.productId, companyId: actor.companyId, isActive: true },
      })

      if (!product) {
        throw badRequest('Choose an active product.')
      }

      if (product.type === 'RAW_MATERIAL') {
        throw badRequest('A BOM can only belong to a finished or semi-finished product.')
      }

      const materials = await loadActiveProducts(tx, actor.companyId, input.items.map(item => item.materialProductId))
      const latest = await tx.bom.findFirst({
        where: { companyId: actor.companyId, productId: product.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      })

      await tx.bom.updateMany({
        where: { companyId: actor.companyId, productId: product.id, isActive: true },
        data: { isActive: false },
      })

      const bom = await tx.bom.create({
        data: {
          companyId: actor.companyId,
          productId: product.id,
          name: input.name,
          version: (latest?.version ?? 0) + 1,
          isActive: true,
          items: {
            create: input.items.map((item) => {
              const material = materials.get(item.materialProductId)!
              return {
                materialProductId: material.id,
                quantity: quantity(item.quantity),
                unit: material.unit,
                wastagePercentage: quantity(item.wastagePercentage),
              }
            }),
          },
        },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'bom.created',
        entity: 'Bom',
        entityId: bom.id,
        metadata: { version: bom.version, sku: product.sku },
      })
      return bom.id
    })
    return getBom(actor.companyId, bomId)
  } catch (error) {
    mapDatabaseError(error, 'That BOM could not be saved.')
  }
}

export async function deactivateBom(actor: Actor, bomId: string) {
  const existing = await getPrisma().bom.findFirst({
    where: { id: bomId, companyId: actor.companyId },
  })

  if (!existing) {
    throw notFound('BOM not found.')
  }

  await getPrisma().bom.update({
    where: { id: bomId },
    data: { isActive: false },
  })
  return getBom(actor.companyId, bomId)
}

function productionRecord(order: {
  id: string
  orderNumber: string
  productId: string
  status: string
  plannedQuantity: { toString(): string }
  producedQuantity: { toString(): string }
  plannedStartDate: Date | null
  materialCost: { toString(): string }
  labourCost: { toString(): string }
  otherCost: { toString(): string }
  totalCost: { toString(): string }
  unitCost: { toString(): string }
  notes: string | null
  product: { name: string, sku: string, unit: string }
  bom: { name: string }
  materialWarehouse: { name: string }
  outputWarehouse: { name: string }
  materials: Array<{
    requiredQuantity: { toString(): string }
    consumedQuantity: { toString(): string }
    wastagePercentage: { toString(): string }
    unit: string
    product: { name: string, sku: string }
  }>
}): ProductionRecord {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    productId: order.productId,
    productName: order.product.name,
    sku: order.product.sku,
    unit: order.product.unit,
    status: order.status,
    plannedQuantity: quantity(order.plannedQuantity.toString()),
    producedQuantity: quantity(order.producedQuantity.toString()),
    bomName: order.bom.name,
    materialWarehouseName: order.materialWarehouse.name,
    outputWarehouseName: order.outputWarehouse.name,
    plannedStartDate: order.plannedStartDate ? dateText(order.plannedStartDate) : null,
    materialCost: money(order.materialCost.toString()),
    labourCost: money(order.labourCost.toString()),
    otherCost: money(order.otherCost.toString()),
    totalCost: money(order.totalCost.toString()),
    unitCost: money(order.unitCost.toString()),
    notes: order.notes,
    materials: order.materials.map(item => ({
      productName: item.product.name,
      sku: item.product.sku,
      unit: item.unit,
      requiredQuantity: quantity(item.requiredQuantity.toString()),
      consumedQuantity: quantity(item.consumedQuantity.toString()),
      wastagePercentage: quantity(item.wastagePercentage.toString()),
    })),
  }
}

const productionInclude = {
  product: { select: { name: true, sku: true, unit: true } },
  bom: { select: { name: true } },
  materialWarehouse: { select: { name: true } },
  outputWarehouse: { select: { name: true } },
  materials: {
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { product: { name: 'asc' as const } },
  },
}

export async function listProductionOrders(companyId: string) {
  const orders = await getPrisma().productionOrder.findMany({
    where: { companyId },
    include: productionInclude,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return orders.map(productionRecord)
}

export async function getProductionOrder(companyId: string, orderId: string) {
  const order = await getPrisma().productionOrder.findFirst({
    where: { id: orderId, companyId },
    include: productionInclude,
  })

  if (!order) {
    throw notFound('Production order not found.')
  }

  return productionRecord(order)
}

export async function createProductionOrder(actor: Actor, input: ProductionInput) {
  try {
    const orderId = await getPrisma().$transaction(async (tx) => {
      const bom = await tx.bom.findFirst({
        where: { id: input.bomId, companyId: actor.companyId, isActive: true },
        include: { items: true },
      })

      if (!bom) {
        throw badRequest('Choose an active BOM.')
      }

      if (bom.productId !== input.productId) {
        throw badRequest('The selected BOM does not belong to this product.')
      }

      if (bom.items.length === 0) {
        throw badRequest('This BOM has no materials.')
      }

      await loadActiveWarehouse(tx, actor.companyId, input.materialWarehouseId)
      await loadActiveWarehouse(tx, actor.companyId, input.outputWarehouseId)
      const product = await tx.product.findFirst({
        where: { id: input.productId, companyId: actor.companyId, isActive: true },
      })

      if (!product || product.type === 'RAW_MATERIAL') {
        throw badRequest('Choose a finished or semi-finished product.')
      }

      let materials
      try {
        materials = bom.items.map((item) => {
          const requirement = calculateMaterialRequirement(item.quantity.toString(), input.plannedQuantity, item.wastagePercentage.toString())
          return {
            productId: item.materialProductId,
            unit: item.unit,
            quantityPerUnit: quantity(item.quantity.toString()),
            wastagePercentage: quantity(item.wastagePercentage.toString()),
            requiredQuantity: quantity(requirement.requiredQuantity),
          }
        })
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : 'The material quantities are not valid.')
      }

      const orderNumber = await nextDocumentNumber(tx, actor.companyId, 'PRODUCTION_ORDER')
      const order = await tx.productionOrder.create({
        data: {
          companyId: actor.companyId,
          orderNumber,
          productId: product.id,
          bomId: bom.id,
          materialWarehouseId: input.materialWarehouseId,
          outputWarehouseId: input.outputWarehouseId,
          plannedQuantity: quantity(input.plannedQuantity),
          status: 'PLANNED',
          plannedStartDate: input.plannedStartDate ? dateOnly(input.plannedStartDate) : null,
          notes: blankToNull(input.notes),
          createdById: actor.userId,
          materials: { create: materials },
        },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'production_order.created',
        entity: 'ProductionOrder',
        entityId: order.id,
        metadata: { orderNumber },
      })
      return order.id
    })
    return getProductionOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That production order could not be saved.')
  }
}

export async function startProductionOrder(actor: Actor, orderId: string) {
  await getPrisma().$transaction(async (tx) => {
    await lockDocument(tx, 'ProductionOrder', orderId, actor.companyId)
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: actor.companyId },
    })

    if (!order) {
      throw notFound('Production order not found.')
    }

    if (order.status !== 'PLANNED') {
      throw badRequest('Only a planned production order can be started.')
    }

    await tx.productionOrder.update({
      where: { id: orderId },
      data: { status: 'IN_PROGRESS', actualStartDate: new Date() },
    })
    await writeAudit(tx, {
      companyId: actor.companyId,
      userId: actor.userId,
      action: 'production_order.started',
      entity: 'ProductionOrder',
      entityId: orderId,
    })
  })
  return getProductionOrder(actor.companyId, orderId)
}

export async function cancelProductionOrder(actor: Actor, orderId: string) {
  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'ProductionOrder', orderId, actor.companyId)
      const order = await tx.productionOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
      })

      if (!order) {
        throw notFound('Production order not found.')
      }

      if (order.status !== 'DRAFT' && order.status !== 'PLANNED') {
        throw badRequest('Started production cannot be cancelled from this screen.')
      }

      await tx.productionOrder.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'production_order.cancelled',
        entity: 'ProductionOrder',
        entityId: orderId,
      })
    })
    return getProductionOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That production order could not be cancelled.')
  }
}

export async function completeProductionOrder(actor: Actor, orderId: string, input: {
  producedQuantity: number
  labourCost: number
  otherCost: number
}) {
  try {
    await getPrisma().$transaction(async (tx) => {
      await lockDocument(tx, 'ProductionOrder', orderId, actor.companyId)
      const order = await tx.productionOrder.findFirst({
        where: { id: orderId, companyId: actor.companyId },
        include: { materials: { include: { product: true } }, product: true },
      })

      if (!order) {
        throw notFound('Production order not found.')
      }

      if (order.status !== 'PLANNED' && order.status !== 'IN_PROGRESS') {
        throw badRequest('This production order cannot be completed.')
      }

      const planned = decimalOf(order.plannedQuantity)
      const produced = decimalOf(input.producedQuantity)

      if (produced.gt(planned)) {
        throw badRequest('Produced quantity cannot be more than the planned quantity.')
      }

      const ratio = produced.div(planned)
      const consumption = order.materials.map((material) => {
        let consume = decimalOf(material.requiredQuantity).mul(ratio).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)

        if (consume.gt(decimalOf(material.requiredQuantity))) {
          consume = decimalOf(material.requiredQuantity)
        }

        if (consume.lte(0)) {
          throw badRequest('Enter a produced quantity large enough to consume materials.')
        }

        return { material, consume }
      })

      await ensureBalances(tx, actor.companyId, [
        ...consumption.map(line => ({
          productId: line.material.productId,
          warehouseId: order.materialWarehouseId,
        })),
        { productId: order.productId, warehouseId: order.outputWarehouseId },
      ])

      let materialCost = new Decimal(0)

      for (const line of consumption) {
        const issued = await postOutbound(tx, {
          companyId: actor.companyId,
          productId: line.material.productId,
          warehouseId: order.materialWarehouseId,
          type: 'PRODUCTION_OUT',
          quantity: quantity(line.consume),
          referenceType: 'PRODUCTION_ORDER',
          referenceId: order.id,
          createdById: actor.userId,
          productName: line.material.product.name,
        })
        const lineCost = issued.unitCost.mul(line.consume)
        materialCost = materialCost.plus(lineCost)
        await tx.productionMaterial.update({
          where: { id: line.material.id },
          data: {
            consumedQuantity: quantity(line.consume),
            unitCost: money(issued.unitCost),
            lineCost: money(lineCost),
          },
        })
      }

      let costs
      try {
        costs = calculateProductionCost({
          materialCost,
          labourCost: input.labourCost,
          otherCost: input.otherCost,
          producedQuantity: produced,
        })
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : 'The production cost is not valid.')
      }

      await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          status: 'COMPLETED',
          producedQuantity: quantity(produced),
          actualStartDate: order.actualStartDate ?? new Date(),
          completedAt: new Date(),
          materialCost: money(costs.materialCost),
          labourCost: money(costs.labourCost),
          otherCost: money(costs.otherCost),
          totalCost: money(costs.totalCost),
          unitCost: money(costs.unitCost),
        },
      })
      await postInbound(tx, {
        companyId: actor.companyId,
        productId: order.productId,
        warehouseId: order.outputWarehouseId,
        type: 'PRODUCTION_IN',
        quantity: quantity(produced),
        unitCost: money(costs.unitCost),
        referenceType: 'PRODUCTION_ORDER',
        referenceId: order.id,
        createdById: actor.userId,
        productName: order.product.name,
      })
      await tx.product.update({
        where: { id: order.productId },
        data: { costPrice: money(costs.unitCost) },
      })
      await notify(tx, {
        companyId: actor.companyId,
        type: 'PRODUCTION_COMPLETED',
        title: 'Production completed',
        message: `${order.orderNumber} finished ${quantity(produced)} ${order.product.unit} of ${order.product.name}.`,
        entityType: 'ProductionOrder',
        entityId: order.id,
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'production_order.completed',
        entity: 'ProductionOrder',
        entityId: order.id,
        metadata: { orderNumber: order.orderNumber, producedQuantity: quantity(produced) },
      })
    })
    return getProductionOrder(actor.companyId, orderId)
  } catch (error) {
    mapDatabaseError(error, 'That production order could not be completed.')
  }
}
