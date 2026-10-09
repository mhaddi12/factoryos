import { describe, expect, it } from 'vitest'
import { startOfZonedDay } from '../shared/domain/time'

describe('company timezone days', () => {
  it('uses the start of the day in Asia/Karachi', () => {
    const start = startOfZonedDay('Asia/Karachi', new Date('2026-10-07T20:00:00Z'))
    expect(start.toISOString()).toBe('2026-10-07T19:00:00.000Z')
  })
})
