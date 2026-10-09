import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { categorySchema, listQuerySchema, productSchema, warehouseSchema } from '../../../shared/validation/records'
import { createCategory, createProduct, createWarehouse, listCategories, listProducts, listWarehouses, updateProduct, updateWarehouse } from '../services/catalog'
import { asActor, requirePermission } from '../utils/access'
import { jsonSuccess } from '../utils/http'
import { routeId } from '../utils/params'
import { run } from '../common/http'

@Controller('products')
export class ProductsController {
  @Get()
  list(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'products.read')
      const query = listQuerySchema.parse(req.query)
      return jsonSuccess(res, await listProducts(user.companyId, query.search))
    })
  }

  @Post()
  create(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'products.write')
      return jsonSuccess(res, await createProduct(asActor(user), productSchema.parse(body)))
    })
  }

  @Patch(':id')
  update(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'products.write')
      const id = routeId(req.params.id, 'Product')
      return jsonSuccess(res, await updateProduct(asActor(user), id, productSchema.parse(body)))
    })
  }
}

@Controller('categories')
export class CategoriesController {
  @Get()
  list(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'categories.read')
      return jsonSuccess(res, await listCategories(user.companyId))
    })
  }

  @Post()
  create(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'categories.write')
      return jsonSuccess(res, await createCategory(asActor(user), categorySchema.parse(body)))
    })
  }
}

@Controller('warehouses')
export class WarehousesController {
  @Get()
  list(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'warehouses.read')
      return jsonSuccess(res, await listWarehouses(user.companyId))
    })
  }

  @Post()
  create(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'warehouses.write')
      return jsonSuccess(res, await createWarehouse(asActor(user), warehouseSchema.parse(body)))
    })
  }

  @Patch(':id')
  update(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'warehouses.write')
      const id = routeId(req.params.id, 'Warehouse')
      return jsonSuccess(res, await updateWarehouse(asActor(user), id, warehouseSchema.parse(body)))
    })
  }
}
