export class ApiError extends Error {
  errors: Record<string, string[]>

  constructor(message: string, errors?: Record<string, string[]>) {
    super(message)
    this.errors = errors ?? {}
  }
}

export function fieldError(error: unknown, field: string) {
  return error instanceof ApiError ? error.errors[field]?.[0] : undefined
}

function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
  return `${base}${path}`
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const body = await response.json() as {
    success: boolean
    data?: T
    message?: string
    errors?: Record<string, string[]>
  }

  if (!response.ok || !body.success) {
    throw new ApiError(body.message || 'The request failed.', body.errors)
  }

  return body.data as T
}
