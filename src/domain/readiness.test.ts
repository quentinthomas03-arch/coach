import { describe, expect, it } from 'vitest'
import type { MorningCheckin, PlannedSession } from '../data/types'
import { planWeek } from './planner'
import { computeReadiness, proposeAdjustment, sleepScore } from './readiness'

const base: MorningCheckin = { date: '2026-11-16', physique: 4, moral: 4, travail: 4, viePerso: 4, at: '' }

describe('forme du jour', () => {
  it('sommeil', () => {
    expect(sleepScore(4)).toBe(0)
    expect(sleepScore(7)).toBe(75)
    expect(sleepScore(9)).toBe(100)
  })
  it('vert quand tout va bien', () => {
    const r = computeReadiness(base, { date: base.date, sleepHours: 7.5 })
    expect(r.color).toBe('vert')
    expect(r.score).toBeGreaterThanOrEqual(55)
  })
  it('un jour normal (3/5 partout, 7 h) est vert', () => {
    expect(computeReadiness({ ...base, physique: 3, moral: 3, travail: 3, viePerso: 3 }, { date: base.date, sleepHours: 7 }).color).toBe('vert')
  })
  it('orange avec fatigue et nuit courte', () => {
    const r = computeReadiness({ ...base, physique: 2, travail: 2 }, { date: base.date, sleepHours: 5.8 })
    expect(r.color).toBe('orange')
    expect(r.reasons.join(' ')).toMatch(/Nuit courte/)
  })
  it('rouge si tout est bas', () => {
    expect(computeReadiness({ ...base, physique: 1, moral: 2, travail: 1, viePerso: 2 }).color).toBe('rouge')
  })
  it('alcool et FC de repos pèsent sur le score', () => {
    const a = computeReadiness(base, { date: base.date, sleepHours: 7, restingHr: 62 }, 55)
    const b = computeReadiness({ ...base, alcool: '3+' }, { date: base.date, sleepHours: 7, restingHr: 62 }, 55)
    expect(b.score).toBe(a.score - 15)
    expect(a.reasons.join(' ')).toMatch(/FC de repos/)
  })
  it('douleur modérée = rouge, gêne légère = simple vigilance', () => {
    expect(computeReadiness({ ...base, douleur: { zone: 'genou', intensite: 2 } })).toMatchObject({ color: 'rouge', pain: true })
    const light = computeReadiness({ ...base, douleur: { zone: 'mollet', intensite: 1 } })
    expect(light.pain).toBe(false)
    expect(light.reasons.join(' ')).toMatch(/Gêne légère/)
  })
})

describe('proposition d’adaptation', () => {
  const week = planWeek({
    weekStart: '2026-11-16', planStart: '2026-11-16', today: '2026-11-16', weekIndex: 0,
    availability: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, available: true, maxMinutes: 60 })),
    runsPerWeek: 3, strengthPerWeek: 2, longRunWeekday: 6, repriseLevel: 3, strengthLevel: 2,
    equipment: ['tapis', 'kettlebell', 'escalier', 'mur'], existing: [],
  }).sessions
  const run = week.find((s) => s.kind === 'marche-course')!
  const renfo = week.find((s) => s.kind === 'renfo')!
  const orange = computeReadiness({ ...base, physique: 2, travail: 2, moral: 3 }, { date: base.date, sleepHours: 6 })
  const rouge = computeReadiness({ ...base, douleur: { zone: 'tendon d’Achille', intensite: 3 } })

  it('orange : course raccourcie', () => {
    expect(orange.color).toBe('orange')
    const p = proposeAdjustment(run, orange)
    expect(p.change).toBe('allegee')
    expect(p.session.durationMin).toBeLessThan(run.durationMin)
    expect(p.session.workoutText).toContain('4x')
  })
  it('orange : renfo avec une série de moins', () => {
    const p = proposeAdjustment(renfo, orange)
    expect(p.session.strength!.items[0].sets).toBe(Math.max(1, renfo.strength!.items[0].sets - 1))
  })
  it('rouge (douleur) : repos et renvoi vers un pro si ça dure', () => {
    const p = proposeAdjustment(run, rouge)
    expect(p.change).toBe('repos')
    expect(p.why).toMatch(/médecin ou un kiné/)
  })
  it('ne touche jamais une séance verrouillée', () => {
    const locked: PlannedSession = { ...run, locked: true }
    expect(proposeAdjustment(locked, rouge)).toMatchObject({ change: 'aucun', session: locked })
  })
})
