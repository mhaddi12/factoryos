import { Decimal, roundMoney } from './decimal'

export type ProductionCost = {
  materialCost: Decimal
  labourCost: Decimal
  otherCost: Decimal
  totalCost: Decimal
  unitCost: Decimal
}

export function calculateProductionCost(input: {
  materialCost: Decimal.Value
  labourCost: Decimal.Value
  otherCost: Decimal.Value
  producedQuantity: Decimal.Value
}): ProductionCost {
  const materialCost = roundMoney(input.materialCost)
  const labourCost = roundMoney(input.labourCost)
  const otherCost = roundMoney(input.otherCost)
  const producedQuantity = new Decimal(input.producedQuantity)

  if (materialCost.lt(0) || labourCost.lt(0) || otherCost.lt(0)) {
    throw new Error('Costs cannot be negative.')
  }

  if (producedQuantity.lte(0)) {
    throw new Error('Produced quantity must be greater than zero.')
  }

  const totalCost = roundMoney(materialCost.plus(labourCost).plus(otherCost))
  const unitCost = roundMoney(totalCost.div(producedQuantity))

  return {
    materialCost,
    labourCost,
    otherCost,
    totalCost,
    unitCost,
  }
}
