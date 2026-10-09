import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { userCreateSchema, userUpdateSchema } from '../../../shared/validation/records'
import { createUser, listUsers, updateUser } from '../services/company-admin'
import { asActor, requirePermission } from '../utils/access'
import { jsonSuccess } from '../utils/http'
import { routeId } from '../utils/params'
import { run } from '../common/http'

@Controller('users')
export class UsersController {
  @Get()
  list(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'users.read')
      return jsonSuccess(res, await listUsers(user.companyId))
    })
  }

  @Post()
  create(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'users.write')
      return jsonSuccess(res, await createUser(asActor(user), userCreateSchema.parse(body)))
    })
  }

  @Patch(':id')
  update(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      const user = await requirePermission(req, res, 'users.write')
      const id = routeId(req.params.id, 'User')
      return jsonSuccess(res, await updateUser(asActor(user), id, userUpdateSchema.parse(body)))
    })
  }
}
