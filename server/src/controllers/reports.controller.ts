import { Controller, Get, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { getReports } from '../services/reports'
import { expressCookieContext, requireUser } from '../services/auth/session'
import { jsonSuccess } from '../utils/http'
import { run } from '../common/http'

@Controller()
export class ReportsController {
  @Get('reports')
  reports(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requireUser(expressCookieContext(req, res))
      return jsonSuccess(res, await getReports(user.companyId, user.role))
    })
  }
}
