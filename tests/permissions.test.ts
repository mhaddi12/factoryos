import { describe, expect, it } from 'vitest'
import { USER_ROLES, hasPermission } from '../shared/auth/permissions'

describe('role permissions', () => {
  it('keeps the V1 roles aligned with the names used in the database', () => {
    expect(USER_ROLES).toEqual([
      'OWNER',
      'ADMIN',
      'PRODUCTION_MANAGER',
      'STORE_KEEPER',
      'SALES',
      'ACCOUNTANT',
    ])
  })

  it('gives the owner company ownership and withholds it from the admin', () => {
    expect(hasPermission('OWNER', 'company.ownership')).toBe(true)
    expect(hasPermission('ADMIN', 'company.ownership')).toBe(false)
    expect(hasPermission('ADMIN', 'users.write')).toBe(true)
  })

  it('stops the storekeeper from recording payments or changing sales', () => {
    expect(hasPermission('STORE_KEEPER', 'inventory.write')).toBe(true)
    expect(hasPermission('STORE_KEEPER', 'purchases.receive')).toBe(true)
    expect(hasPermission('STORE_KEEPER', 'payments.write')).toBe(false)
    expect(hasPermission('STORE_KEEPER', 'sales.write')).toBe(false)
    expect(hasPermission('STORE_KEEPER', 'production.complete')).toBe(false)
  })

  it('limits sales and accounting to their own work', () => {
    expect(hasPermission('SALES', 'sales.write')).toBe(true)
    expect(hasPermission('SALES', 'purchases.write')).toBe(false)
    expect(hasPermission('ACCOUNTANT', 'payments.write')).toBe(true)
    expect(hasPermission('ACCOUNTANT', 'production.write')).toBe(false)
    expect(hasPermission('PRODUCTION_MANAGER', 'production.complete')).toBe(true)
    expect(hasPermission('PRODUCTION_MANAGER', 'payments.read')).toBe(false)
  })
})
