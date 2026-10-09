export type NavLink = {
  label: string
  to: string
  icon?: string
}

export type NavGroup = {
  label: string
  items: NavLink[]
}

export const APP_NAV: Array<NavLink | NavGroup> = [
  { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
  {
    label: 'Sales',
    items: [
      { label: 'Customers', to: '/customers' },
      { label: 'Sales orders', to: '/sales-orders' },
    ],
  },
  {
    label: 'Purchases',
    items: [
      { label: 'Suppliers', to: '/suppliers' },
      { label: 'Purchase orders', to: '/purchase-orders' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Products', to: '/products' },
      { label: 'Warehouses', to: '/warehouses' },
      { label: 'Stock movements', to: '/stock-movements' },
    ],
  },
  {
    label: 'Production',
    items: [
      { label: 'BOM', to: '/bom' },
      { label: 'Production orders', to: '/production-orders' },
    ],
  },
  { label: 'Reports', to: '/reports', icon: 'i-lucide-chart-column' },
  {
    label: 'Settings',
    items: [
      { label: 'Company', to: '/settings/company' },
      { label: 'Users', to: '/settings/users' },
      { label: 'Roles', to: '/settings/roles' },
    ],
  },
]

export function isNavGroup(entry: NavLink | NavGroup): entry is NavGroup {
  return 'items' in entry
}

export const SECTION_TITLES: Record<string, string> = {
  'customers': 'Customers',
  'sales-orders': 'Sales orders',
  'suppliers': 'Suppliers',
  'purchase-orders': 'Purchase orders',
  'products': 'Products',
  'warehouses': 'Warehouses',
  'stock-movements': 'Stock movements',
  'bom': 'Bill of materials',
  'production-orders': 'Production orders',
  'reports': 'Reports',
}

export const SETTINGS_TITLES: Record<string, string> = {
  company: 'Company',
  users: 'Users',
  roles: 'Roles',
}

export const ROLE_LABELS = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  PRODUCTION_MANAGER: 'Production manager',
  STORE_KEEPER: 'Store keeper',
  SALES: 'Sales',
  ACCOUNTANT: 'Accountant',
} as const
