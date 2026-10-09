export class AppError extends Error {
  readonly statusCode: number
  readonly details?: Record<string, string[]>

  constructor(statusCode: number, message: string, details?: Record<string, string[]>) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
  }
}

export function badRequest(message: string) {
  return new AppError(400, message)
}

export function unauthorized(message = 'Sign in to continue.') {
  return new AppError(401, message)
}

export function forbidden(message = 'You do not have access to this action.') {
  return new AppError(403, message)
}

export function notFound(message: string) {
  return new AppError(404, message)
}

export function conflict(message: string) {
  return new AppError(409, message)
}

export function validationError(message: string, details?: Record<string, string[]>) {
  return new AppError(422, message, details)
}

export function tooManyRequests(message = 'Too many attempts. Wait a few minutes and try again.') {
  return new AppError(429, message)
}
