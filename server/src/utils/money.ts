import { Decimal, roundMoney, roundQuantity } from '../../../shared/domain/decimal'

export function money(value: Decimal.Value) {
  return roundMoney(value).toFixed(4)
}

export function quantity(value: Decimal.Value) {
  return roundQuantity(value).toFixed(4)
}

export function decimalOf(value: Decimal.Value | { toString(): string }) {
  return new Decimal(String(value))
}

export function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

export function dateText(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function blankToNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
