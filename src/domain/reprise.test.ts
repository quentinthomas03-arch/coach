import { describe, expect, it } from 'vitest'
import { estimateDurationSec, toIntervalsText } from './workout'
import { getLevel, isDeloadWeek, nextLevel, repriseLabel, repriseWorkout, startLevelFor } from './reprise'

describe('reprise', () => {
  it('niveau de départ selon la capacité actuelle', () => {
    expect(startLevelFor('moins-5')).toBe(1)
    expect(startLevelFor('10-20')).toBe(4)
    expect(startLevelFor('plus-30')).toBe(8)
  })

  it('borne les niveaux', () => {
    expect(getLevel(0).level).toBe(1)
    expect(getLevel(42).level).toBe(9)
  })

  it('la séance du niveau 2 dure 5 + 6×3.5 + 5 min', () => {
    const w = repriseWorkout(2)
    expect(estimateDurationSec(w)).toBe(300 + 6 * 210 + 300)
    expect(toIntervalsText(w)).toContain('6x\n- Course facile 2m Z2 HR\n- Marche 1m30s Z1 HR')
  })

  it('la sortie longue ajoute 2 répétitions ou 10 min en continu', () => {
    expect(toIntervalsText(repriseWorkout(2, true))).toContain('8x')
    expect(estimateDurationSec(repriseWorkout(9, true))).toBe(300 + 40 * 60 + 300)
    expect(repriseLabel(2, true)).toBe('8 × (2 min course + 1 min 30 marche)')
    expect(repriseLabel(9, true)).toBe('40 min de course continue')
  })

  it('la durée de course sans pause augmente à chaque niveau', () => {
    // Principe de reprise : on allonge d'abord la course continue (le total peut
    // baisser au passage en continu : 2 × 12 min → 20 min d'affilée est plus dur).
    let prev = 0
    for (let l = 1; l <= 9; l++) {
      const g = getLevel(l)
      expect(g.runSec).toBeGreaterThan(prev)
      prev = g.runSec
    }
  })
})

describe('progression de niveau', () => {
  it('monte si semaine validée', () => {
    expect(nextLevel(3, { planned: 3, done: 3, avgRpe: 5, pain: false })).toMatchObject({ level: 4, change: 'monte' })
  })
  it('reste si effort trop élevé', () => {
    expect(nextLevel(3, { planned: 3, done: 3, avgRpe: 7.5, pain: false })).toMatchObject({ level: 3, change: 'stable' })
  })
  it('reste si moins de 2 séances', () => {
    expect(nextLevel(3, { planned: 3, done: 1, pain: false }).level).toBe(3)
  })
  it('redescend si douleur ou aucune séance', () => {
    expect(nextLevel(3, { planned: 3, done: 3, avgRpe: 4, pain: true })).toMatchObject({ level: 2, change: 'baisse' })
    expect(nextLevel(3, { planned: 3, done: 0, pain: false }).level).toBe(2)
    expect(nextLevel(1, { planned: 3, done: 0, pain: false })).toMatchObject({ level: 1, change: 'stable' })
  })
  it('plafonne au dernier niveau', () => {
    expect(nextLevel(9, { planned: 3, done: 3, avgRpe: 4, pain: false })).toMatchObject({ level: 9, completed: true })
    expect(nextLevel(9, { planned: 3, done: 1, pain: false }).completed).toBeUndefined()
  })
  it('semaine allégée toutes les 4 semaines', () => {
    expect([0, 1, 2, 3, 4, 7].map(isDeloadWeek)).toEqual([false, false, false, true, false, true])
  })
})
