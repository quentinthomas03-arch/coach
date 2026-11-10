import { describe, expect, it } from 'vitest'
import type { MorningCheckin } from '../data/types'
import { addDays } from './dates'
import { detectOverload } from './overload'

const today = '2026-12-10'
const series = (n: number, v: Partial<MorningCheckin>): MorningCheckin[] =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(today, -i), physique: 3, moral: 3, travail: 3, viePerso: 3, at: '', ...v }))

describe('surcharge prolongée', () => {
  it('pas assez de check-ins : rien', () => {
    expect(detectOverload(series(5, { travail: 1 }), today).active).toBe(false)
  })
  it('travail écrasant sur 3 semaines : active', () => {
    const o = detectOverload(series(15, { travail: 2 }), today)
    expect(o.active).toBe(true)
    expect(o.reasons[0]).toMatch(/charge de travail/)
  })
  it('semaines normales : inactive', () => {
    expect(detectOverload(series(15, { travail: 3, moral: 3 }), today).active).toBe(false)
  })
})
