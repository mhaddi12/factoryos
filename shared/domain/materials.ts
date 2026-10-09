import { Decimal, roundQuantity } from './decimal'

export type MaterialRequirement = {
  baseQuantity: Decimal
  wastageQuantity: Decimal
  requiredQuantity: Decimal
}

export function calculateMaterialRequirement(
  quantityPerUnit: Decimal.Value,
  plannedQuantity: Decimal.Value,
  wastagePercentage: Decimal.Value,
): MaterialRequirement {
  const perUnit = new Decimal(quantityPerUnit)
  const planned = new Decimal(plannedQuantity)
  const wastagePct = new Decimal(wastagePercentage)

  if (perUnit.lte(0)) {
    throw new Error('BOM quantity must be greater than zero.')
  }

  if (planned.lte(0)) {
    throw new Error('Planned quantity must be greater than zero.')
  }

  if (wastagePct.lt(0) || wastagePct.gt(100)) {
    throw new Error('Wastage percentage must be between 0 and 100.')
  }

  const baseQuantity = roundQuantity(perUnit.mul(planned))
  const wastageQuantity = roundQuantity(baseQuantity.mul(wastagePct).div(100))
  const requiredQuantity = roundQuantity(baseQuantity.plus(wastageQuantity))

  return {
    baseQuantity,
    wastageQuantity,
    requiredQuantity,
  }
}
