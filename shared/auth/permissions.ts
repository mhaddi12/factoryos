export const USER_ROLES = [
  'OWNER',
  'ADMIN',
  'PRODUCTION_MANAGER',
  'STORE_KEEPER',
  'SALES',
  'ACCOUNTANT',
] as const

export type UserRole = (typeof USER_ROLES)[number]

export const PERMISSIONS = [
  'dashboard.read',
  'products.read',
  'products.write',
  'categories.read',
  'categories.write',
  'inventory.read',
  'inventory.write',
  'warehouses.read',
  'warehouses.write',
  'suppliers.read',
  'suppliers.write',
  'customers.read',
  'customers.write',
  'purchases.read',
  'purchases.write',
  'purchases.receive',
  'sales.read',
  'sales.write',
  'sales.deliver',
  'payments.read',
  'payments.write',
  'bom.read',
  'bom.write',
  'production.read',
  'production.write',
  'production.complete',
  'reports.inventory',
  'reports.production',
  'reports.sales',
  'reports.purchases',
  'reports.financial',
  'users.read',
  'users.write',
  'company.read',
  'company.write',
  'company.ownership',
  'audit.read',
  'notifications.read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ALL = PERMISSIONS

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter(permission => permission !== 'company.ownership'),
  PRODUCTION_MANAGER: [
    'dashboard.read',
    'products.read',
    'products.write',
    'categories.read',
    'categories.write',
    'inventory.read',
    'warehouses.read',
    'bom.read',
    'bom.write',
    'production.read',
    'production.write',
    'production.complete',
    'reports.inventory',
    'reports.production',
    'notifications.read',
  ],
  STORE_KEEPER: [
    'dashboard.read',
    'products.read',
    'categories.read',
    'inventory.read',
    'inventory.write',
    'warehouses.read',
    'warehouses.write',
    'purchases.read',
    'purchases.receive',
    'reports.inventory',
    'notifications.read',
  ],
  SALES: [
    'dashboard.read',
    'products.read',
    'customers.read',
    'customers.write',
    'sales.read',
    'sales.write',
    'sales.deliver',
    'reports.sales',
    'notifications.read',
  ],
  ACCOUNTANT: [
    'dashboard.read',
    'products.read',
    'suppliers.read',
    'suppliers.write',
    'customers.read',
    'purchases.read',
    'purchases.write',
    'sales.read',
    'payments.read',
    'payments.write',
    'production.read',
    'reports.inventory',
    'reports.production',
    'reports.sales',
    'reports.purchases',
    'reports.financial',
    'audit.read',
    'notifications.read',
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function permissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}
