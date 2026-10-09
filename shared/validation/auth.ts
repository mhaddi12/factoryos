import { z } from 'zod'
import { businessNameSchema, emailSchema, optionalCitySchema, optionalPhoneSchema, personNameSchema } from './common'

export const passwordSchema = z.string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Password must be 72 characters or fewer.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.')

export const registerSchema = z.object({
  companyName: businessNameSchema(150),
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
  phone: optionalPhoneSchema,
  city: optionalCitySchema,
}).refine(value => value.password === value.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(72),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, 'This reset link is not valid.'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).refine(value => value.password === value.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})
