export type DashboardData = {
  counts: {
    products: number
    lowStock: number
    pendingPurchases: number
    pendingSales: number
    productionInProgress: number
  }
  today: {
    productionQuantity: string
    salesTotal: string
  }
  inventoryValue: string
  recentProduction: Array<{
    id: string
    orderNumber: string
    productName: string
    quantity: string
    unit: string
    status: string
  }>
  lowStock: Array<{
    id: string
    name: string
    sku: string
    unit: string
    current: string
    minimum: string
  }>
  recentPurchases: Array<{
    id: string
    orderNumber: string
    party: string
    status: string
    total: string
    orderDate: string
  }>
  recentSales: Array<{
    id: string
    orderNumber: string
    party: string
    status: string
    total: string
    orderDate: string
  }>
}
