import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { bomSchema, completeProductionSchema, productionOrderSchema } from '../../../shared/validation/records'
import {
  cancelProductionOrder,
  completeProductionOrder,
  createBom,
  createProductionOrder,
  deactivateBom,
  getBom,
  getProductionOrder,
  listBoms,
  listProductionOrders,
  startProductionOrder,
} from '../services/manufacturing'
import { asActor, requirePermission } from '../utils/access'
import { notFound } from '../utils/errors'
import { jsonSuccess } from '../utils/http'
import { routeId } from '../utils/params'
import { run } from '../common/http'

@Controller('boms')
export class BomsController {
  @Get()
  list(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'bom.read')
      return jsonSuccess(res, await listBoms(user.companyId))
    })
  }

  @Post()
  create(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'bom.write')
      return jsonSuccess(res, await createBom(asActor(user), bomSchema.parse(body)))
    })
  }

  @Get(':id')
  get(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'bom.read')
      return jsonSuccess(res, await getBom(user.companyId, routeId(req.params.id, 'BOM')))
    })
  }

  @Post(':id/deactivate')
  deactivate(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'bom.write')
      return jsonSuccess(res, await deactivateBom(asActor(user), routeId(req.params.id, 'BOM')))
    })
  }
}

@Controller('production-orders')
export class ProductionOrdersController {
  @Get()
  list(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'production.read')
      return jsonSuccess(res, await listProductionOrders(user.companyId))
    })
  }

  @Post()
  create(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'production.write')
      const input = productionOrderSchema.parse(body)
      return jsonSuccess(res, await createProductionOrder(asActor(user), {
        ...input,
        plannedStartDate: input.plannedStartDate || undefined,
      }))
    })
  }

  @Get(':id')
  get(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'production.read')
      return jsonSuccess(res, await getProductionOrder(user.companyId, routeId(req.params.id, 'Production order')))
    })
  }

  @Post(':id/:action')
  action(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const id = routeId(req.params.id, 'Production order')
      const action = routeId(req.params.action, 'Action')

      if (action === 'start' || action === 'cancel') {
        const user = await requirePermission(req, res, 'production.write')
        const actor = asActor(user)
        const order = action === 'start'
          ? await startProductionOrder(actor, id)
          : await cancelProductionOrder(actor, id)
        return jsonSuccess(res, order)
      }

      if (action === 'complete') {
        const user = await requirePermission(req, res, 'production.complete')
        return jsonSuccess(res, await completeProductionOrder(asActor(user), id, completeProductionSchema.parse(body)))
      }

      throw notFound('That action was not found.')
    })
  }
}
