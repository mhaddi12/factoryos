import { Controller, Get, Res } from '@nestjs/common'
import type { Response } from 'express'
import { getPrisma } from '../database/prisma'
import { apiError } from '../utils/api-response'
import { jsonSuccess } from '../utils/http'

@Controller()
export class HealthController {
  @Get('health')
  async health(@Res() res: Response) {
    try {
      await getPrisma().$queryRaw`SELECT 1`
      return jsonSuccess(res, { status: 'ok', database: 'connected' })
    } catch {
      return res.status(503).json(apiError('The application cannot reach the database.'))
    }
  }
}
