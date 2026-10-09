import { z } from 'zod'
import { canonicalAddress, canonicalBusinessName, canonicalCity, canonicalPersonName, canonicalPhone, canonicalTaxNumber } from '../domain/pakistan'

export const emailSchema = z.email().max(255).transform(value => value.toLowerCase())

export const requiredString = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required.`).max(max)

function checkedString(check: (value: string) => string | null, message: string, max = 200) {
  return z.string().trim().max(max).transform((value, ctx) => {
    if (!value) {
      ctx.addIssue({ code: 'custom', message: 'Enter a name.' })
      return z.NEVER
    }

    const next = check(value)

    if (!next) {
      ctx.addIssue({ code: 'custom', message })
      return z.NEVER
    }

    return next
  })
}

function optionalChecked(check: (value: string) => string | null, message: string, max = 200) {
  return z.string().trim().max(max).optional().transform((value, ctx) => {
    if (!value) {
      return undefined
    }

    const next = check(value)

    if (!next) {
      ctx.addIssue({ code: 'custom', message })
      return z.NEVER
    }

    return next
  })
}

export const personNameSchema = checkedString(canonicalPersonName, 'Enter a name using letters.', 120)

export const optionalPersonNameSchema = optionalChecked(canonicalPersonName, 'Enter a name using letters.', 120)

export const businessNameSchema = (max = 160) => checkedString(
  value => canonicalBusinessName(value, max),
  'Enter a name that includes letters.',
  max,
)

export const optionalPhoneSchema = optionalChecked(
  canonicalPhone,
  'Enter a Pakistan mobile (0300-1234567) or landline.',
  20,
)

export const optionalCitySchema = optionalChecked(canonicalCity, 'Enter a city in Pakistan.', 100)

export const optionalTaxNumberSchema = optionalChecked(
  canonicalTaxNumber,
  'Enter an NTN (1234567-8), a CNIC (35202-1234567-1), or a 13-digit sales tax number.',
  20,
)

export const optionalAddressSchema = optionalChecked(
  canonicalAddress,
  'Enter a street address of at least 5 characters.',
  300,
)

export const skuSchema = z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'SKU can contain letters, numbers, dots, hyphens, and underscores.').transform(value => value.toUpperCase())

export const positiveDecimalSchema = z.coerce.number().positive('Enter a number greater than zero.')

export const nonNegativeDecimalSchema = z.coerce.number().nonnegative('Enter zero or a positive number.')

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})
