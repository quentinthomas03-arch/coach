import { describe, expect, it } from 'vitest'
import { buildSteps } from './strengthSteps'
import type { StrengthItem } from './strength'

const item = (over: Partial<StrengthItem>): StrengthItem => ({ exerciseId: 'x', name: 'X', description: '', sets: 2, reps: 10, restSec: 45, unilateral: false, ...over })

describe('déroulé du renfo', () => {
  it('séries, repos entre séries, transition entre exercices', () => {
    const s = buildSteps([item({ name: 'A' }), item({ name: 'B', sets: 1, reps: undefined, sec: 30 })])
    expect(s.map((x) => x.type)).toEqual(['work', 'rest', 'work', 'rest', 'work'])
    expect(s[1]).toMatchObject({ type: 'rest', sec: 45 })
    expect(s[3]).toMatchObject({ type: 'rest', sec: 30, next: 'B' })
    expect(s[4]).toMatchObject({ type: 'work', sec: 30 })
  })
  it('exercice unilatéral : côté droit puis gauche, puis repos', () => {
    const s = buildSteps([item({ unilateral: true, sets: 2 })])
    expect(s.map((x) => (x.type === 'work' ? x.side : 'repos'))).toEqual(['droit', 'gauche', 'repos', 'droit', 'gauche'])
  })
})
