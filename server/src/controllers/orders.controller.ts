import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { listQuerySchema, orderDraftSchema, paymentSchema, receiveSchema } from '../../../shared/validation/records'
import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  payPurchaseOrder,
  receivePurchaseOrder,
  updatePurchaseOrder,
} from '../services/purchasing'
import {
  cancelSalesOrder,
  confirmSalesOrder,
  createSalesOrder,
  deliverSalesOrder,
  getSalesOrder,
  listSalesOrders,
  paySalesOrder,
  updateSalesOrder,
} from '../services/selling'
import { asActor, requirePermission } from '../utils/access'
import { notFound } from '../utils/errors'
import { jsonSuccess } from '../utils/http'
import { routeId } from '../utils/params'
import { run } from '../common/http'
import type { Permission } from '../../../shared/auth/permissions'
import type { Actor } from '../services/types'

type Kind = 'purchase' | 'sales'

function orderController(kind: Kind) {
  const read: Permission = kind === 'purchase' ? 'purchases.read' : 'sales.read'
  const write: Permission = kind === 'purchase' ? 'purchases.write' : 'sales.write'
  const move: Permission = kind === 'purchase' ? 'purchases.receive' : 'sales.deliver'
  const missing = kind === 'purchase' ? 'Purchase order' : 'Sales order'

  @Controller(kind === 'purchase' ? 'purchase-orders' : 'sales-orders')
  class OrdersController {
    @Get()
    list(@Req() req: Request, @Res() res: Response) {
      return run(res, async () => {
        const user = await requirePermission(req, res, read)
        const parsed = listQuerySchema.parse(req.query)
        const page = kind === 'purchase'
          ? await listPurchaseOrders(user.companyId, parsed)
          : await listSalesOrders(user.companyId, parsed)
        return jsonSuccess(res, page)
      })
    }

    @Post()
    create(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
      return run(res, async () => {
        const user = await requirePermission(req, res, write)
        const input = orderDraftSchema.parse(body)
        const order = kind === 'purchase'
          ? await createPurchaseOrder(asActor(user), input)
          : await createSalesOrder(asActor(user), input)
        return jsonSuccess(res, order)
      })
    }

    @Get(':id')
    get(@Req() req: Request, @Res() res: Response) {
      return run(res, async () => {
        const user = await requirePermission(req, res, read)
        const id = routeId(req.params.id, missing)
        const order = kind === 'purchase'
          ? await getPurchaseOrder(user.companyId, id)
          : await getSalesOrder(user.companyId, id)
        return jsonSuccess(res, order)
      })
    }

    @Patch(':id')
    update(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
      return run(res, async () => {
        const user = await requirePermission(req, res, write)
        const id = routeId(req.params.id, missing)
        const input = orderDraftSchema.parse(body)
        const order = kind === 'purchase'
          ? await updatePurchaseOrder(asActor(user), id, input)
          : await updateSalesOrder(asActor(user), id, input)
        return jsonSuccess(res, order)
      })
    }

    @Post(':id/:action')
    action(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
      return run(res, async () => {
        const id = routeId(req.params.id, missing)
        const action = routeId(req.params.action, 'Action')
        const actorOf = async (permission: Permission): Promise<Actor> => asActor(await requirePermission(req, res, permission))

        if (action === 'confirm' || action === 'cancel') {
          const actor = await actorOf(write)
          const order = kind === 'purchase'
            ? (action === 'confirm' ? await confirmPurchaseOrder(actor, id) : await cancelPurchaseOrder(actor, id))
            : (action === 'confirm' ? await confirmSalesOrder(actor, id) : await cancelSalesOrder(actor, id))
          return jsonSuccess(res, order)
        }

        if (action === 'receive' || action === 'deliver') {
          if ((kind === 'purchase' && action !== 'receive') || (kind === 'sales' && action !== 'deliver')) {
            throw notFound('That action was not found.')
          }
          const actor = await actorOf(move)
          const input = receiveSchema.parse(body)
          const order = kind === 'purchase'
            ? await receivePurchaseOrder(actor, id, input)
            : await deliverSalesOrder(actor, id, input)
          return jsonSuccess(res, order)
        }

        if (action === 'payments') {
          const actor = await actorOf('payments.write')
          const input = paymentSchema.parse(body)
          const order = kind === 'purchase'
            ? await payPurchaseOrder(actor, id, input)
            : await paySalesOrder(actor, id, input)
          return jsonSuccess(res, order)
        }

        throw notFound('That action was not found.')
      })
    }
  }

  return OrdersController
}

export const PurchaseOrdersController = orderController('purchase')
export const SalesOrdersController = orderController('sales')
