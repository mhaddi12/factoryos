import { z } from 'zod'
import { USER_ROLES } from '../auth/permissions'
import { businessNameSchema, emailSchema, nonNegativeDecimalSchema, optionalAddressSchema, optionalCitySchema, optionalPersonNameSchema, optionalPhoneSchema, optionalTaxNumberSchema, paginationQuerySchema, personNameSchema, positiveDecimalSchema, requiredString, skuSchema } from './common'
import { passwordSchema } from './auth'

const optionalText = (max: number) => z.string().trim().max(max).optional()
const optionalEmail = z.union([emailSchema, z.literal('')]).optional()
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')
const idSchema = z.string().trim().min(1, 'Choose a value.')

export const listQuerySchema = paginationQuerySchema.pick({
  page: true,
  pageSize: true,
  search: true,
})

export const productSchema = z.object({
  sku: skuSchema,
  name: requiredString('Name', 160),
  description: optionalText(1000),
  categoryId: z.string().trim().optional(),
  categoryName: optionalText(120),
  unit: z.enum(['PCS', 'KG', 'GRAM', 'LITER', 'METER', 'BOX', 'PACK']),
  type: z.enum(['RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD']),
  costPrice: nonNegativeDecimalSchema,
  sellingPrice: nonNegativeDecimalSchema,
  minimumStock: nonNegativeDecimalSchema,
  isActive: z.boolean().default(true),
})

export const categorySchema = z.object({
  name: requiredString('Name', 120),
  description: optionalText(500),
})

export const warehouseSchema = z.object({
  name: requiredString('Name', 120),
  location: optionalText(200),
  isActive: z.boolean().default(true),
})

export const partySchema = z.object({
  name: businessNameSchema(160),
  contactPerson: optionalPersonNameSchema,
  phone: optionalPhoneSchema,
  email: optionalEmail,
  address: optionalAddressSchema,
  city: optionalCitySchema,
  taxNumber: optionalTaxNumberSchema,
  isActive: z.boolean().default(true),
})

const orderLineSchema = z.object({
  productId: idSchema,
  quantity: positiveDecimalSchema,
  unitPrice: nonNegativeDecimalSchema,
})

export const orderDraftSchema = z.object({
  partyId: idSchema,
  warehouseId: idSchema,
  orderDate: dateSchema,
  notes: optionalText(1000),
  items: z.array(orderLineSchema).min(1, 'Add at least one line.').max(50),
}).superRefine((value, ctx) => {
  const seen = new Set<string>()

  value.items.forEach((item, index) => {
    if (seen.has(item.productId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Each product can only appear once.',
        path: ['items', index, 'productId'],
      })
    }
    seen.add(item.productId)
  })
})

export const receiveSchema = z.object({
  items: z.array(z.object({
    itemId: idSchema,
    quantity: nonNegativeDecimalSchema,
  })).min(1, 'Add a quantity.'),
}).superRefine((value, ctx) => {
  const seen = new Set<string>()

  value.items.forEach((item, index) => {
    if (seen.has(item.itemId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Each line can only be received once.',
        path: ['items', index, 'itemId'],
      })
    }
    seen.add(item.itemId)
  })
})

export const paymentSchema = z.object({
  amount: positiveDecimalSchema,
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  paidAt: dateSchema,
  reference: optionalText(100),
  notes: optionalText(500),
})

export const adjustmentSchema = z.object({
  productId: idSchema,
  warehouseId: idSchema,
  direction: z.enum(['IN', 'OUT']),
  quantity: positiveDecimalSchema,
  unitCost: nonNegativeDecimalSchema.optional(),
  notes: optionalText(500),
}).superRefine((value, ctx) => {
  if (value.direction === 'IN' && value.unitCost === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter the unit cost.',
      path: ['unitCost'],
    })
  }
})

export const transferSchema = z.object({
  productId: idSchema,
  fromWarehouseId: idSchema,
  toWarehouseId: idSchema,
  quantity: positiveDecimalSchema,
  notes: optionalText(500),
}).refine(value => value.fromWarehouseId !== value.toWarehouseId, {
  message: 'Choose two different warehouses.',
  path: ['toWarehouseId'],
})

const bomLineSchema = z.object({
  materialProductId: idSchema,
  quantity: positiveDecimalSchema,
  wastagePercentage: nonNegativeDecimalSchema.max(100, 'Wastage cannot be more than 100%.'),
})

export const bomSchema = z.object({
  productId: idSchema,
  name: requiredString('Name', 160),
  items: z.array(bomLineSchema).min(1, 'Add at least one material.').max(50),
}).superRefine((value, ctx) => {
  const seen = new Set<string>()

  value.items.forEach((item, index) => {
    if (item.materialProductId === value.productId) {
      ctx.addIssue({
        code: 'custom',
        message: 'A product cannot be a component of its own BOM.',
        path: ['items', index, 'materialProductId'],
      })
    }
    if (seen.has(item.materialProductId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Each material can only appear once.',
        path: ['items', index, 'materialProductId'],
      })
    }
    seen.add(item.materialProductId)
  })
})

export const productionOrderSchema = z.object({
  productId: idSchema,
  bomId: idSchema,
  materialWarehouseId: idSchema,
  outputWarehouseId: idSchema,
  plannedQuantity: positiveDecimalSchema,
  plannedStartDate: z.union([dateSchema, z.literal('')]).optional(),
  notes: optionalText(1000),
})

export const completeProductionSchema = z.object({
  producedQuantity: positiveDecimalSchema,
  labourCost: nonNegativeDecimalSchema,
  otherCost: nonNegativeDecimalSchema,
})

export const companySchema = z.object({
  name: businessNameSchema(150),
  email: optionalEmail,
  phone: optionalPhoneSchema,
  address: optionalAddressSchema,
  city: optionalCitySchema,
})

export const userCreateSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
  role: z.enum(USER_ROLES),
  password: passwordSchema,
})

export const userUpdateSchema = z.object({
  name: personNameSchema,
  phone: optionalPhoneSchema,
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
})
