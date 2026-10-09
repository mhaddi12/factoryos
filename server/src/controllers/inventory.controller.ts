import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { adjustmentSchema, listQuerySchema, transferSchema } from '../../../shared/validation/records'
import { adjustStock, listBalances, listMovements, transferStock } from '../services/inventory'
import { asActor, requirePermission } from '../utils/access'
import { jsonSuccess } from '../utils/http'
import { run } from '../common/http'

@Controller('stock')
export class StockController {
  @Get('balances')
  balances(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'inventory.read')
      return jsonSuccess(res, await listBalances(user.companyId))
    })
  }

  @Get('movements')
  movements(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'inventory.read')
      const query = listQuerySchema.parse(req.query)
      return jsonSuccess(res, await listMovements(user.companyId, query))
    })
  }

  @Post('adjustments')
  adjust(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'inventory.write')
      await adjustStock(asActor(user), adjustmentSchema.parse(body))
      return jsonSuccess(res, { saved: true })
    })
  }

  @Post('transfers')
  transfer(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'inventory.write')
      await transferStock(asActor(user), transferSchema.parse(body))
      return jsonSuccess(res, { saved: true })
    })
  }
}
