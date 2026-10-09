import type { Request } from 'express'
import { tooManyRequests } from './errors'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  existing.count += 1

  if (existing.count > limit) {
    throw tooManyRequests()
  }
}

export function clearRateLimits() {
  buckets.clear()
}

export function clientAddress(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? '127.0.0.1'
  }
  return req.ip ?? '127.0.0.1'
}
