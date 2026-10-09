import type { UserRole } from '../../../shared/auth/permissions'

export type Actor = {
  companyId: string
  userId: string
  role: UserRole
}
