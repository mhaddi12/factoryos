import { Decimal, roundMoney, roundQuantity } from './decimal'

export type StockState = {
  quantity: Decimal
  averageCost: Decimal
}

export function shortageQuantity(available: Decimal.Value, required: Decimal.Value): Decimal {
  const gap = new Decimal(required).minus(available)
  return gap.gt(0) ? roundQuantity(gap) : new Decimal(0)
}

export function hasSufficientStock(available: Decimal.Value, required: Decimal.Value): boolean {
  return new Decimal(available).gte(required)
}

export function applyOutbound(state: StockState, quantity: Decimal.Value): StockState {
  const outgoing = roundQuantity(quantity)

  if (outgoing.lte(0)) {
    throw new Error('Outbound quantity must be greater than zero.')
  }

  if (state.quantity.lt(outgoing)) {
    throw new Error('Insufficient stock.')
  }

  return {
    quantity: roundQuantity(state.quantity.minus(outgoing)),
    averageCost: state.averageCost,
  }
}

export function nextAverageCost(input: {
  currentQuantity: Decimal.Value
  currentAverageCost: Decimal.Value
  incomingQuantity: Decimal.Value
  incomingUnitCost: Decimal.Value
}): Decimal {
  const currentQuantity = new Decimal(input.currentQuantity)
  const currentAverageCost = new Decimal(input.currentAverageCost)
  const incomingQuantity = new Decimal(input.incomingQuantity)
  const incomingUnitCost = new Decimal(input.incomingUnitCost)

  if (incomingQuantity.lte(0)) {
    throw new Error('Incoming quantity must be greater than zero.')
  }

  if (currentQuantity.lt(0) || currentAverageCost.lt(0) || incomingUnitCost.lt(0)) {
    throw new Error('Stock quantities and costs cannot be negative.')
  }

  if (currentQuantity.eq(0)) {
    return roundMoney(incomingUnitCost)
  }

  const existingValue = currentQuantity.mul(currentAverageCost)
  const incomingValue = incomingQuantity.mul(incomingUnitCost)
  const nextQuantity = currentQuantity.plus(incomingQuantity)

  return roundMoney(existingValue.plus(incomingValue).div(nextQuantity))
}

export function applyInbound(
  state: StockState,
  quantity: Decimal.Value,
  unitCost: Decimal.Value,
): StockState {
  const incoming = roundQuantity(quantity)
  const averageCost = nextAverageCost({
    currentQuantity: state.quantity,
    currentAverageCost: state.averageCost,
    incomingQuantity: incoming,
    incomingUnitCost: unitCost,
  })

  return {
    quantity: roundQuantity(state.quantity.plus(incoming)),
    averageCost,
  }
}
