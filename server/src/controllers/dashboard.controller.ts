import { Controller, Get, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { hasPermission } from '../../../shared/auth/permissions'
import { getDashboard } from '../services/dashboard'
import { getFormOptions } from '../services/options'
import { expressCookieContext, requireUser } from '../services/auth/session'
import { asActor, requirePermission } from '../utils/access'
import { jsonSuccess } from '../utils/http'
import { forbidden } from '../utils/errors'
import { run } from '../common/http'

@Controller()
export class DashboardController {
  @Get('dashboard')
  dashboard(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requireUser(expressCookieContext(req, res))
      if (!hasPermission(user.role, 'dashboard.read')) {
        throw forbidden()
      }
      return jsonSuccess(res, await getDashboard(user.companyId, user.company.timezone))
    })
  }

  @Get('options')
  options(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'dashboard.read')
      return jsonSuccess(res, await getFormOptions(asActor(user)))
    })
  }
}
