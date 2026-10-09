import type { Request, Response } from 'express'
import { handleApiError } from '../utils/http'

export async function run(res: Response, work: () => Promise<unknown>) {
  try {
    return await work()
  } catch (error) {
    return handleApiError(res, error)
  }
}

export type Http = {
  req: Request
  res: Response
}
