import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { listQuerySchema, partySchema } from '../../../shared/validation/records'
import { createParty, listParties, updateParty } from '../services/parties'
import { asActor, requirePermission } from '../utils/access'
import { jsonSuccess } from '../utils/http'
import { routeId } from '../utils/params'
import { run } from '../common/http'

function partyRoutes(kind: 'customer' | 'supplier') {
  const read = kind === 'customer' ? 'customers.read' as const : 'suppliers.read' as const
  const write = kind === 'customer' ? 'customers.write' as const : 'suppliers.write' as const
  const label = kind === 'customer' ? 'Customer' : 'Supplier'

  @Controller(kind === 'customer' ? 'customers' : 'suppliers')
  class PartyController {
    @Get()
    list(@Req() req: Request, @Res() res: Response) {
      return run(res, async () => {
        const user = await requirePermission(req, res, read)
        const query = listQuerySchema.parse(req.query)
        return jsonSuccess(res, await listParties(kind, user.companyId, query.search))
      })
    }

    @Post()
    create(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
      return run(res, async () => {
        const user = await requirePermission(req, res, write)
        return jsonSuccess(res, await createParty(kind, asActor(user), partySchema.parse(body)))
      })
    }

    @Patch(':id')
    update(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
      return run(res, async () => {
        const user = await requirePermission(req, res, write)
        const id = routeId(req.params.id, label)
        return jsonSuccess(res, await updateParty(kind, asActor(user), id, partySchema.parse(body)))
      })
    }
  }

  return PartyController
}

export const CustomersController = partyRoutes('customer')
export const SuppliersController = partyRoutes('supplier')
