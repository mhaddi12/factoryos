import { Module } from '@nestjs/common'
import { AuthController } from './controllers/auth.controller'
import { CategoriesController, ProductsController, WarehousesController } from './controllers/catalog.controller'
import { CompanyController } from './controllers/company.controller'
import { DashboardController } from './controllers/dashboard.controller'
import { HealthController } from './controllers/health.controller'
import { StockController } from './controllers/inventory.controller'
import { BomsController, ProductionOrdersController } from './controllers/manufacturing.controller'
import { PurchaseOrdersController, SalesOrdersController } from './controllers/orders.controller'
import { CustomersController, SuppliersController } from './controllers/parties.controller'
import { ReportsController } from './controllers/reports.controller'
import { UsersController } from './controllers/users.controller'

@Module({
  controllers: [
    AuthController,
    HealthController,
    DashboardController,
    CompanyController,
    ReportsController,
    ProductsController,
    CategoriesController,
    WarehousesController,
    CustomersController,
    SuppliersController,
    StockController,
    UsersController,
    BomsController,
    ProductionOrdersController,
    PurchaseOrdersController,
    SalesOrdersController,
  ],
})
export class AppModule {}
