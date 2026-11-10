import { describe, expect, it } from 'vitest'
import { testRunEvent, testStrengthEvent } from './diagnostic'

describe('séances de test', () => {
  it('course : texte structuré et durée', () => {
    const e = testRunEvent('2026-11-11')
    expect(e.type).toBe('Run')
    expect(e.start_date_local).toBe('2026-11-11T00:00:00')
    expect(e.description).toContain('5x\n- Course tres facile 2m Z2 HR')
    expect(e.moving_time).toBe(300 + 5 * 180 + 300)
  })
  it('renfo : type WeightTraining, id stable', () => {
    const a = testStrengthEvent('2026-11-11')
    const b = testStrengthEvent('2026-11-12')
    expect(a.type).toBe('WeightTraining')
    expect(a.external_id).toBe(b.external_id)
  })
})
