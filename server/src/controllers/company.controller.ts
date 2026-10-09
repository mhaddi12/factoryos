import { Body, Controller, Get, Patch, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { companySchema } from '../../../shared/validation/records'
import { getCompany, updateCompany } from '../services/company-admin'
import { asActor, requirePermission } from '../utils/access'
import { jsonSuccess } from '../utils/http'
import { run } from '../common/http'

@Controller()
export class CompanyController {
  @Get('company')
  company(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'company.read')
      return jsonSuccess(res, await getCompany(user.companyId))
    })
  }

  @Patch('company')
  updateCompany(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'company.write')
      const input = companySchema.parse(body)
      return jsonSuccess(res, await updateCompany(asActor(user), input))
    })
  }
}
