import { describe, expect, it } from 'vitest'
import { addDays, mondayOf, weekdayIndex } from './dates'

describe('dates', () => {
  it('ajoute des jours en traversant les mois et le changement d’heure', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  })
  it('trouve le lundi', () => {
    expect(mondayOf('2026-11-10')).toBe('2026-11-09')
    expect(mondayOf('2026-11-15')).toBe('2026-11-09')
    expect(weekdayIndex('2026-11-15')).toBe(6)
  })
})
