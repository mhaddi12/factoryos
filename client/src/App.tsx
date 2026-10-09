import { Navigate, Route, Routes } from 'react-router-dom'
import { GuestOnly, AppShell } from './layout/shell'
import { ForgotPasswordPage } from './pages/auth/forgot-password-page'
import { LoginPage } from './pages/auth/login-page'
import { RegisterPage } from './pages/auth/register-page'
import { ResetPasswordPage } from './pages/auth/reset-password-page'
import { DashboardPage } from './pages/dashboard/dashboard-page'
import { ProductsPage } from './pages/inventory/products-page'
import { StockPage } from './pages/inventory/stock-page'
import { WarehousesPage } from './pages/inventory/warehouses-page'
import { OrderDetailPage } from './pages/orders/order-detail-page'
import { OrdersPage } from './pages/orders/orders-page'
import { PartyPage } from './pages/parties/party-page'
import { BomDetailPage } from './pages/production/bom-detail-page'
import { BomPage } from './pages/production/bom-page'
import { ProductionOrderPage } from './pages/production/production-order-page'
import { ProductionOrdersPage } from './pages/production/production-orders-page'
import { ReportsPage } from './pages/reports/reports-page'
import { CompanyPage } from './pages/settings/company-page'
import { RolesPage } from './pages/settings/roles-page'
import { UsersPage } from './pages/settings/users-page'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/customers" element={<PartyPage kind="customer" />} />
        <Route path="/suppliers" element={<PartyPage kind="supplier" />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/warehouses" element={<WarehousesPage />} />
        <Route path="/stock-movements" element={<StockPage />} />
        <Route path="/purchase-orders" element={<OrdersPage kind="purchase" />} />
        <Route path="/purchase-orders/:id" element={<OrderDetailPage kind="purchase" />} />
        <Route path="/sales-orders" element={<OrdersPage kind="sales" />} />
        <Route path="/sales-orders/:id" element={<OrderDetailPage kind="sales" />} />
        <Route path="/bom" element={<BomPage />} />
        <Route path="/bom/:id" element={<BomDetailPage />} />
        <Route path="/production-orders" element={<ProductionOrdersPage />} />
        <Route path="/production-orders/:id" element={<ProductionOrderPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings/company" element={<CompanyPage />} />
        <Route path="/settings/users" element={<UsersPage />} />
        <Route path="/settings/roles" element={<RolesPage />} />
      </Route>
    </Routes>
  )
}
