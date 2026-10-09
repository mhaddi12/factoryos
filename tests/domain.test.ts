import { describe, expect, it } from 'vitest'
import { Decimal } from '../shared/domain/decimal'
import { calculateProductionCost } from '../shared/domain/costing'
import { calculateMaterialRequirement } from '../shared/domain/materials'
import { applyInbound, applyOutbound, hasSufficientStock, shortageQuantity } from '../shared/domain/stock'

const zero = { quantity: new Decimal(0), averageCost: new Decimal(0) }

describe('BOM material requirements', () => {
  it('calculates required materials and wastage for 10,000 bottles', () => {
    const plastic = calculateMaterialRequirement('0.025', 10000, 5)

    expect(plastic.baseQuantity.toFixed(4)).toBe('250.0000')
    expect(plastic.wastageQuantity.toFixed(4)).toBe('12.5000')
    expect(plastic.requiredQuantity.toFixed(4)).toBe('262.5000')

    const cap = calculateMaterialRequirement(1, 10000, 2)
    expect(cap.requiredQuantity.toFixed(4)).toBe('10200.0000')

    const label = calculateMaterialRequirement(1, 10000, 1)
    expect(label.requiredQuantity.toFixed(4)).toBe('10100.0000')
  })

  it('rejects wastage outside 0 to 100 percent', () => {
    expect(() => calculateMaterialRequirement(1, 10, 101)).toThrow(/Wastage/)
  })
})

describe('stock rules', () => {
  it('reports the shortage when available stock is not enough', () => {
    expect(hasSufficientStock(200, '262.5')).toBe(false)
    expect(shortageQuantity(200, '262.5').toFixed(4)).toBe('62.5000')
  })

  it('prevents stock from going negative', () => {
    const state = { quantity: new Decimal(200), averageCost: new Decimal(400) }

    expect(() => applyOutbound(state, '262.5')).toThrow(/Insufficient stock/)
  })

  it('increases stock on receipt and decreases it on issue without changing average cost', () => {
    const received = applyInbound(zero, 500, 400)

    expect(received.quantity.toFixed(4)).toBe('500.0000')
    expect(received.averageCost.toFixed(4)).toBe('400.0000')

    const issued = applyOutbound(received, 100)
    expect(issued.quantity.toFixed(4)).toBe('400.0000')
    expect(issued.averageCost.toFixed(4)).toBe('400.0000')
  })

  it('recalculates moving average cost when more stock is purchased', () => {
    const first = applyInbound(zero, 100, 10)
    const second = applyInbound(first, 100, 20)

    expect(second.quantity.toFixed(4)).toBe('200.0000')
    expect(second.averageCost.toFixed(4)).toBe('15.0000')
  })
})

describe('production costing', () => {
  it('adds material, labour, and other cost, then divides by produced quantity', () => {
    const cost = calculateProductionCost({
      materialCost: 500000,
      labourCost: 80000,
      otherCost: 20000,
      producedQuantity: 10000,
    })

    expect(cost.totalCost.toFixed(4)).toBe('600000.0000')
    expect(cost.unitCost.toFixed(4)).toBe('60.0000')
  })

  it('rejects a zero produced quantity', () => {
    expect(() => calculateProductionCost({
      materialCost: 10,
      labourCost: 0,
      otherCost: 0,
      producedQuantity: 0,
    })).toThrow(/Produced quantity/)
  })
})
