import type { Request, Response } from 'express'
import { ZodError } from 'zod'
import { apiError, apiSuccess } from './api-response'
import { AppError } from './errors'

function fieldErrors(error: ZodError) {
  const errors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    errors[key] ??= []
    errors[key].push(issue.message)
  }

  return errors
}

export function jsonSuccess<T>(res: Response, data: T, status = 200, message?: string) {
  return res.status(status).json(apiSuccess(data, message))
}

export function jsonError(res: Response, message: string, status = 400, errors?: Record<string, string[]>) {
  return res.status(status).json(apiError(message, errors))
}

export function handleApiError(res: Response, error: unknown) {
  if (error instanceof ZodError) {
    return res.status(422).json(
      apiError('Check the form and try again.', fieldErrors(error)),
    )
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json(
      apiError(error.message, error.details),
    )
  }

  console.error(error)
  return res.status(500).json(
    apiError('Something went wrong. Try again.'),
  )
}
