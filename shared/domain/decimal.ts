import Decimal from 'decimal.js'

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
})

export { Decimal }

export function roundQuantity(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
}

export function roundMoney(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
}
