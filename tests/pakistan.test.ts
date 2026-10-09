import { describe, expect, it } from 'vitest'
import { canonicalCity, canonicalPhone, canonicalTaxNumber } from '../shared/domain/pakistan'
import { partySchema } from '../shared/validation/records'

const party = {
  name: 'Ali Traders',
  contactPerson: 'Ali Raza',
  phone: '0300-1112233',
  email: 'ali@alitraders.example',
  address: 'Shop 22, Brandreth Road',
  city: 'lahore',
  taxNumber: '12345678',
  isActive: true,
}

describe('Pakistan field checks', () => {
  it('accepts a known city and normalizes spelling', () => {
    expect(canonicalCity('  lahore city ')).toBe('Lahore')
    expect(canonicalCity('d.g. khan')).toBe('Dera Ghazi Khan')
    expect(canonicalCity('Atlantis')).toBeNull()
  })

  it('accepts Pakistan mobiles, landlines, and country codes', () => {
    expect(canonicalPhone('+92 300 1112233')).toBe('0300-1112233')
    expect(canonicalPhone('042-35700000')).toBe('04235700000')
    expect(canonicalPhone('12345')).toBeNull()
  })

  it('accepts an NTN, a CNIC, and a 13-digit sales tax number', () => {
    expect(canonicalTaxNumber('1234567-8')).toBe('1234567-8')
    expect(canonicalTaxNumber('3520212345671')).toBe('35202-1234567-1')
    expect(canonicalTaxNumber('90897565767464')).toBeNull()
    expect(canonicalTaxNumber('0000000')).toBeNull()
  })

  it('rejects a customer when the city, phone, or tax number is not valid', () => {
    const parsed = partySchema.safeParse({
      ...party,
      city: 'Nope',
      phone: '12345',
      taxNumber: '90897565767464',
      contactPerson: '0321',
    })

    expect(parsed.success).toBe(false)

    if (!parsed.success) {
      const fields = Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join('.'), issue.message]))
      expect(fields.city).toBe('Enter a city in Pakistan.')
      expect(fields.phone).toMatch(/Pakistan mobile/)
      expect(fields.taxNumber).toMatch(/NTN/)
      expect(fields.contactPerson).toMatch(/letters/)
    }
  })

  it('stores the normalized city, phone, and tax number', () => {
    const parsed = partySchema.parse(party)

    expect(parsed.city).toBe('Lahore')
    expect(parsed.phone).toBe('0300-1112233')
    expect(parsed.taxNumber).toBe('1234567-8')
  })
})
