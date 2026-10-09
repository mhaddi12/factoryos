import type { Prisma } from '../../../generated/prisma/client'
import type { CategoryRecord, ProductRecord, WarehouseRecord } from '../../../shared/types/records'
import { badRequest, notFound } from '../utils/errors'
import { getPrisma } from '../database/prisma'
import { mapDatabaseError } from '../utils/db-error'
import { blankToNull, decimalOf, money, quantity } from '../utils/money'
import { writeAudit, type Tx } from './documents'
import type { Actor } from './types'

function productRecord(product: {
  id: string
  sku: string
  name: string
  description: string | null
  categoryId: string | null
  unit: string
  type: string
  costPrice: { toString(): string }
  sellingPrice: { toString(): string }
  minimumStock: { toString(): string }
  isActive: boolean
  category: { name: string } | null
  stockBalances: Array<{ quantity: { toString(): string } }>
}): ProductRecord {
  const onHand = product.stockBalances.reduce(
    (sum, balance) => sum.plus(decimalOf(balance.quantity)),
    decimalOf(0),
  )

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    categoryName: product.category?.name ?? null,
    unit: product.unit,
    type: product.type,
    costPrice: money(product.costPrice.toString()),
    sellingPrice: money(product.sellingPrice.toString()),
    minimumStock: quantity(product.minimumStock.toString()),
    onHand: quantity(onHand),
    isActive: product.isActive,
  }
}

const productInclude = {
  category: { select: { name: true } },
  stockBalances: { select: { quantity: true } },
} satisfies Prisma.ProductInclude

export async function listProducts(companyId: string, search?: string) {
  const products = await getPrisma().product.findMany({
    where: {
      companyId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: productInclude,
    orderBy: { name: 'asc' },
    take: 200,
  })

  return products.map(productRecord)
}

export async function listCategories(companyId: string) {
  const categories = await getPrisma().productCategory.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  })

  return categories.map((category): CategoryRecord => ({
    id: category.id,
    name: category.name,
    description: category.description,
  }))
}

async function categoryIdFor(tx: Tx, actor: Actor, categoryId?: string, categoryName?: string) {
  const name = blankToNull(categoryName)

  if (name) {
    const created = await tx.productCategory.upsert({
      where: { companyId_name: { companyId: actor.companyId, name } },
      create: { companyId: actor.companyId, name },
      update: {},
    })
    return created.id
  }

  if (!categoryId) {
    return null
  }

  const category = await tx.productCategory.findFirst({
    where: { id: categoryId, companyId: actor.companyId },
  })

  if (!category) {
    throw badRequest('Choose a category from this company.')
  }

  return category.id
}

export async function createProduct(actor: Actor, input: {
  sku: string
  name: string
  description?: string
  categoryId?: string
  categoryName?: string
  unit: 'PCS' | 'KG' | 'GRAM' | 'LITER' | 'METER' | 'BOX' | 'PACK'
  type: 'RAW_MATERIAL' | 'SEMI_FINISHED' | 'FINISHED_GOOD'
  costPrice: number
  sellingPrice: number
  minimumStock: number
  isActive: boolean
}) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const categoryId = await categoryIdFor(tx, actor, input.categoryId, input.categoryName)
      const product = await tx.product.create({
        data: {
          companyId: actor.companyId,
          sku: input.sku,
          name: input.name,
          description: blankToNull(input.description),
          categoryId,
          unit: input.unit,
          type: input.type,
          costPrice: money(input.costPrice),
          sellingPrice: money(input.sellingPrice),
          minimumStock: quantity(input.minimumStock),
          isActive: input.isActive,
        },
        include: productInclude,
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'product.created',
        entity: 'Product',
        entityId: product.id,
        metadata: { sku: product.sku },
      })
      return productRecord(product)
    })
  } catch (error) {
    mapDatabaseError(error, 'A product with this SKU already exists.')
  }
}

export async function updateProduct(actor: Actor, productId: string, input: {
  sku: string
  name: string
  description?: string
  categoryId?: string
  categoryName?: string
  unit: 'PCS' | 'KG' | 'GRAM' | 'LITER' | 'METER' | 'BOX' | 'PACK'
  type: 'RAW_MATERIAL' | 'SEMI_FINISHED' | 'FINISHED_GOOD'
  costPrice: number
  sellingPrice: number
  minimumStock: number
  isActive: boolean
}) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id: productId, companyId: actor.companyId },
      })

      if (!existing) {
        throw notFound('Product not found.')
      }

      if (input.type === 'RAW_MATERIAL' && existing.type !== 'RAW_MATERIAL') {
        const bom = await tx.bom.findFirst({
          where: { companyId: actor.companyId, productId },
          select: { id: true },
        })

        if (bom) {
          throw badRequest('A product with a BOM has to stay finished or semi-finished.')
        }
      }

      const categoryId = await categoryIdFor(tx, actor, input.categoryId, input.categoryName)
      const product = await tx.product.update({
        where: { id: productId },
        data: {
          sku: input.sku,
          name: input.name,
          description: blankToNull(input.description),
          categoryId,
          unit: input.unit,
          type: input.type,
          costPrice: money(input.costPrice),
          sellingPrice: money(input.sellingPrice),
          minimumStock: quantity(input.minimumStock),
          isActive: input.isActive,
        },
        include: productInclude,
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'product.updated',
        entity: 'Product',
        entityId: product.id,
        metadata: { sku: product.sku },
      })
      return productRecord(product)
    })
  } catch (error) {
    mapDatabaseError(error, 'A product with this SKU already exists.')
  }
}

export async function createCategory(actor: Actor, input: { name: string, description?: string }) {
  try {
    const category = await getPrisma().productCategory.create({
      data: {
        companyId: actor.companyId,
        name: input.name,
        description: blankToNull(input.description),
      },
    })
    return {
      id: category.id,
      name: category.name,
      description: category.description,
    } satisfies CategoryRecord
  } catch (error) {
    mapDatabaseError(error, 'A category with this name already exists.')
  }
}

export async function listWarehouses(companyId: string) {
  const warehouses = await getPrisma().warehouse.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  })

  return warehouses.map((warehouse): WarehouseRecord => ({
    id: warehouse.id,
    name: warehouse.name,
    location: warehouse.location,
    isActive: warehouse.isActive,
  }))
}

export async function createWarehouse(actor: Actor, input: { name: string, location?: string, isActive: boolean }) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const warehouse = await tx.warehouse.create({
        data: {
          companyId: actor.companyId,
          name: input.name,
          location: blankToNull(input.location),
          isActive: input.isActive,
        },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'warehouse.created',
        entity: 'Warehouse',
        entityId: warehouse.id,
      })
      return {
        id: warehouse.id,
        name: warehouse.name,
        location: warehouse.location,
        isActive: warehouse.isActive,
      } satisfies WarehouseRecord
    })
  } catch (error) {
    mapDatabaseError(error, 'A warehouse with this name already exists.')
  }
}

export async function updateWarehouse(actor: Actor, warehouseId: string, input: { name: string, location?: string, isActive: boolean }) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const existing = await tx.warehouse.findFirst({
        where: { id: warehouseId, companyId: actor.companyId },
      })

      if (!existing) {
        throw notFound('Warehouse not found.')
      }

      const warehouse = await tx.warehouse.update({
        where: { id: warehouseId },
        data: {
          name: input.name,
          location: blankToNull(input.location),
          isActive: input.isActive,
        },
      })
      await writeAudit(tx, {
        companyId: actor.companyId,
        userId: actor.userId,
        action: 'warehouse.updated',
        entity: 'Warehouse',
        entityId: warehouse.id,
      })
      return {
        id: warehouse.id,
        name: warehouse.name,
        location: warehouse.location,
        isActive: warehouse.isActive,
      } satisfies WarehouseRecord
    })
  } catch (error) {
    mapDatabaseError(error, 'A warehouse with this name already exists.')
  }
}
