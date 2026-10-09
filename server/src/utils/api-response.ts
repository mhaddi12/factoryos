import type { ApiFailure, ApiSuccess } from '../../../shared/types/api'

export function apiSuccess<T>(data: T, message?: string): ApiSuccess<T> {
  return {
    success: true,
    data,
    message,
  }
}

export function apiError(message: string, errors?: Record<string, string[]>): ApiFailure {
  return {
    success: false,
    message,
    errors,
  }
}
