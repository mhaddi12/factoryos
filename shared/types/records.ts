import type { Paginated } from './api'

export type ProductRecord = {
  id: string
  sku: string
  name: string
  description: string | null
  categoryId: string | null
  categoryName: string | null
  unit: string
  type: string
  costPrice: string
  sellingPrice: string
  minimumStock: string
  onHand: string
  isActive: boolean
}

export type CategoryRecord = {
  id: string
  name: string
  description: string | null
}

export type WarehouseRecord = {
  id: string
  name: string
  location: string | null
  isActive: boolean
}

export type PartyRecord = {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  taxNumber: string | null
  isActive: boolean
}

export type StockBalanceRow = {
  id: string
  productId: string
  productName: string
  sku: string
  unit: string
  warehouseId: string
  warehouseName: string
  quantity: string
  averageCost: string
  value: string
}

export type StockMovementRow = {
  id: string
  createdAt: string
  type: string
  productName: string
  sku: string
  warehouseName: string
  quantity: string
  unit: string
  unitCost: string
  notes: string | null
  createdByName: string
}

export type OrderListItem = {
  id: string
  orderNumber: string
  partyName: string
  orderDate: string
  status: string
  total: string
  amountPaid: string
  paymentStatus: string
}

export type OrderItemRecord = {
  id: string
  productId: string
  productName: string
  sku: string
  unit: string
  quantity: string
  movedQuantity: string
  unitPrice: string
  lineTotal: string
}

export type OrderDocument = {
  id: string
  number: string
  at: string
  items: Array<{
    productName: string
    quantity: string
    unitCost: string
  }>
}

export type OrderPayment = {
  id: string
  amount: string
  method: string
  paidAt: string
  reference: string | null
}

export type OrderDetail = OrderListItem & {
  partyId: string
  warehouseId: string
  warehouseName: string
  notes: string | null
  subtotal: string
  discount: string
  tax: string
  items: OrderItemRecord[]
  documents: OrderDocument[]
  payments: OrderPayment[]
}

export type BomRecord = {
  id: string
  name: string
  version: number
  isActive: boolean
  productId: string
  productName: string
  sku: string
  items: Array<{
    id: string
    materialProductId: string
    materialName: string
    sku: string
    quantity: string
    unit: string
    wastagePercentage: string
  }>
}

export type ProductionRecord = {
  id: string
  orderNumber: string
  productId: string
  productName: string
  sku: string
  unit: string
  status: string
  plannedQuantity: string
  producedQuantity: string
  bomName: string
  materialWarehouseName: string
  outputWarehouseName: string
  plannedStartDate: string | null
  materialCost: string
  labourCost: string
  otherCost: string
  totalCost: string
  unitCost: string
  notes: string | null
  materials: Array<{
    productName: string
    sku: string
    unit: string
    requiredQuantity: string
    consumedQuantity: string
    wastagePercentage: string
  }>
}

export type CompanyProfile = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string
  currency: string
  timezone: string
}

export type UserRecord = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  isActive: boolean
  lastLoginAt: string | null
}

export type NamedOption = {
  id: string
  label: string
}

export type ProductOption = NamedOption & {
  unit: string
  productType: string
  costPrice: string
  sellingPrice: string
}

export type BomOption = NamedOption & {
  productId: string
}

export type FormOptions = {
  products: ProductOption[]
  warehouses: NamedOption[]
  customers: NamedOption[]
  suppliers: NamedOption[]
  boms: BomOption[]
  categories: NamedOption[]
}

export type ReportData = {
  inventory: null | {
    value: string
    rows: StockBalanceRow[]
    lowStock: Array<{
      name: string
      sku: string
      onHand: string
      minimum: string
      unit: string
    }>
  }
  production: null | {
    completedQuantity: string
    completedCost: string
    orders: Array<{
      id: string
      orderNumber: string
      productName: string
      status: string
      plannedQuantity: string
      producedQuantity: string
      unit: string
      totalCost: string
    }>
  }
  sales: null | {
    orderTotal: string
    outstanding: string
    orders: OrderListItem[]
  }
  purchases: null | {
    orderTotal: string
    outstanding: string
    orders: OrderListItem[]
  }
  financial: null | {
    receivables: string
    payables: string
    inventoryValue: string
    incomingPayments: string
    outgoingPayments: string
  }
}

export type OrderPage = Paginated<OrderListItem>
export type MovementPage = Paginated<StockMovementRow>
