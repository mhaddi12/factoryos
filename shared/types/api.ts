export type ApiSuccess<T> = {
  success: true
  data: T
  message?: string
}

export type ApiFailure = {
  success: false
  message: string
  errors?: Record<string, string[]>
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export type Paginated<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  pageCount: number
}
