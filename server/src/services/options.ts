import { hasPermission } from '../../../shared/auth/permissions'
import type { FormOptions } from '../../../shared/types/records'
import { getPrisma } from '../database/prisma'
import { money } from '../utils/money'
import type { Actor } from './types'

export async function getFormOptions(actor: Actor): Promise<FormOptions> {
  const prisma = getPrisma()
  const options: FormOptions = {
    products: [],
    warehouses: [],
    customers: [],
    suppliers: [],
    boms: [],
    categories: [],
  }
  const allowed = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(actor.role, permission)

  if (allowed('products.read') || allowed('products.write')) {
    const products = await prisma.product.findMany({
      where: { companyId: actor.companyId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, name: true, unit: true, type: true, costPrice: true, sellingPrice: true },
    })
    options.products = products.map(product => ({
      id: product.id,
      label: `${product.sku} · ${product.name}`,
      unit: product.unit,
      productType: product.type,
      costPrice: money(product.costPrice.toString()),
      sellingPrice: money(product.sellingPrice.toString()),
    }))
  }

  if (
    allowed('warehouses.read')
    || allowed('sales.write')
    || allowed('purchases.write')
    || allowed('production.write')
    || allowed('inventory.write')
    || allowed('purchases.receive')
    || allowed('sales.deliver')
  ) {
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId: actor.companyId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    options.warehouses = warehouses.map(warehouse => ({ id: warehouse.id, label: warehouse.name }))
  }

  if (allowed('customers.read') || allowed('customers.write')) {
    const customers = await prisma.customer.findMany({
      where: { companyId: actor.companyId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    options.customers = customers.map(customer => ({ id: customer.id, label: customer.name }))
  }

  if (allowed('suppliers.read') || allowed('suppliers.write')) {
    const suppliers = await prisma.supplier.findMany({
      where: { companyId: actor.companyId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    options.suppliers = suppliers.map(supplier => ({ id: supplier.id, label: supplier.name }))
  }

  if (allowed('bom.read') || allowed('production.write')) {
    const boms = await prisma.bom.findMany({
      where: { companyId: actor.companyId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, version: true, productId: true },
    })
    options.boms = boms.map(bom => ({
      id: bom.id,
      productId: bom.productId,
      label: `${bom.name} (v${bom.version})`,
    }))
  }

  if (allowed('categories.read') || allowed('products.write')) {
    const categories = await prisma.productCategory.findMany({
      where: { companyId: actor.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    options.categories = categories.map(category => ({ id: category.id, label: category.name }))
  }

  return options
}
