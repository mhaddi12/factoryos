import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../../../shared/validation/auth'
import { getPrisma } from '../database/prisma'
import { authenticate, registerOwner, requestPasswordReset, resetPassword } from '../services/auth/service'
import { clearTokens, expressCookieContext, issueTokens, refreshTokens, requireUser, toSessionUser } from '../services/auth/session'
import { jsonSuccess } from '../utils/http'
import { clientAddress, rateLimit } from '../utils/rate-limit'
import { run } from '../common/http'

@Controller('auth')
export class AuthController {
  @Post('login')
  login(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      rateLimit(`login:${clientAddress(req)}`, 10, 15 * 60 * 1000)
      const input = loginSchema.parse(body)
      const user = await authenticate(input.email, input.password)
      await issueTokens(user.id, expressCookieContext(req, res))
      return jsonSuccess(res, { user: toSessionUser(user) }, 200, 'Signed in.')
    })
  }

  @Post('register')
  register(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      rateLimit(`register:${clientAddress(req)}`, 5, 60 * 60 * 1000)
      const input = registerSchema.parse(body)
      const account = await registerOwner(input)
      await issueTokens(account.userId, expressCookieContext(req, res))
      const user = await getPrisma().user.findUniqueOrThrow({
        where: { id: account.userId },
        include: { company: { select: { id: true, name: true, currency: true, timezone: true } } },
      })
      return jsonSuccess(res, { user: toSessionUser(user) }, 200, 'Company created.')
    })
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await clearTokens(expressCookieContext(req, res))
      if (user) {
        await getPrisma().auditLog.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            action: 'user.logout',
            entity: 'User',
            entityId: user.id,
          },
        })
      }
      return jsonSuccess(res, { signedOut: true }, 200, 'Signed out.')
    })
  }

  @Get('me')
  me(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      const user = await requireUser(expressCookieContext(req, res))
      return jsonSuccess(res, { user: toSessionUser(user) })
    })
  }

  @Post('refresh')
  refresh(@Req() req: Request, @Res() res: Response) {
    return run(res, async () => {
      await refreshTokens(expressCookieContext(req, res))
      return jsonSuccess(res, { refreshed: true })
    })
  }

  @Post('forgot-password')
  forgot(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      rateLimit(`forgot:${clientAddress(req)}`, 5, 15 * 60 * 1000)
      const input = forgotPasswordSchema.parse(body)
      const token = await requestPasswordReset(input.email)
      const devResetUrl = token && process.env.NODE_ENV !== 'production'
        ? `/reset-password?token=${encodeURIComponent(token)}`
        : undefined
      return jsonSuccess(res, { devResetUrl }, 200, 'If that email has an account, you can reset the password.')
    })
  }

  @Post('reset-password')
  reset(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    return run(res, async () => {
      rateLimit(`reset:${clientAddress(req)}`, 10, 15 * 60 * 1000)
      const input = resetPasswordSchema.parse(body)
      await resetPassword(input.token, input.password)
      return jsonSuccess(res, { reset: true }, 200, 'Password updated. Sign in with the new password.')
    })
  }
}
