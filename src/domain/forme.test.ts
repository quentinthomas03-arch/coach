import { describe, expect, it } from 'vitest'
import { estimateDurationSec, toIntervalsText } from './workout'
import { fartlekWorkout, formeWeek, nextBaseMinutes, weekMinutes } from './forme'

const total = (ss: { minutes: number }[]) => ss.reduce((a, b) => a + b.minutes, 0)

describe('forme continue', () => {
  it('semaine 1 du cycle : longue + faciles, pas de séance soutenue', () => {
    const w = formeWeek(150, 3, 0)
    expect(w.map((s) => s.kind)).toEqual(['sortie-longue', 'endurance', 'endurance'])
    expect(w[0].minutes).toBe(53)
    expect(total(w)).toBe(150)
  })
  it('semaines 2-3 : une séance soutenue courte', () => {
    const w = formeWeek(150, 3, 1)
    expect(w.map((s) => s.kind)).toEqual(['sortie-longue', 'fractionne', 'endurance'])
    expect(w[1].key).toBe(true)
  })
  it('80/20 : au moins ~80 % du temps en facile', () => {
    const w = formeWeek(200, 4, 2)
    const q = w.find((s) => s.kind === 'fractionne')!
    const hard = Number(/(\d+)x/.exec(toIntervalsText(q.workout))![1]) // minutes en zone 4
    expect(hard / total(w)).toBeLessThan(0.2)
  })
  it('semaine allégée : −25 % et pas de séance soutenue', () => {
    expect(weekMinutes(160, 3)).toBe(120)
    expect(formeWeek(120, 3, 3).some((s) => s.kind === 'fractionne')).toBe(false)
  })
  it('les durées des séances correspondent à leur contenu', () => {
    for (const s of formeWeek(180, 3, 1)) {
      expect(Math.abs(estimateDurationSec(s.workout) / 60 - s.minutes)).toBeLessThanOrEqual(3)
    }
    expect(fartlekWorkout(45).reps).toBe(6)
  })
  it('progression : +8 % max, maintien, baisse en cas de douleur', () => {
    expect(nextBaseMinutes(150, { planned: 3, done: 3, avgRpe: 5, pain: false }, 0, 600).minutes).toBe(162)
    expect(nextBaseMinutes(150, { planned: 3, done: 1, pain: false }, 0, 600).minutes).toBe(150)
    expect(nextBaseMinutes(150, { planned: 3, done: 3, avgRpe: 7.5, pain: false }, 0, 600).minutes).toBe(150)
    expect(nextBaseMinutes(150, { planned: 3, done: 3, pain: true }, 0, 600).minutes).toBe(120)
    expect(nextBaseMinutes(150, { planned: 3, done: 3, pain: false }, 3, 600).minutes).toBe(150)
    expect(nextBaseMinutes(150, { planned: 3, done: 3, pain: false }, 0, 155).minutes).toBe(155)
  })
})
