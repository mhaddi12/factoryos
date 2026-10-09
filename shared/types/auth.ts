import type { Permission, UserRole } from '../auth/permissions'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
  company: {
    id: string
    name: string
    currency: string
    timezone: string
  }
  permissions: Permission[]
}
