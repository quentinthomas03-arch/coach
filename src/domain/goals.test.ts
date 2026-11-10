import { describe, expect, it } from 'vitest'
import { estimateFitness } from './fitness'
import { assessGoal, goalLabel, vdotAfter, vdotWeeks, volumeWeeks, type Goal } from './goals'
import { DISTANCES } from './paces'

const today = '2026-11-10'
const records = [
  { id: 'r1', date: '2026-05-10', distanceM: DISTANCES.marathon, timeSec: 3 * 3600 + 34 * 60, source: 'record' as const, label: 'Marathon' },
  { id: 'r2', date: '2026-03-15', distanceM: DISTANCES.semi, timeSec: 6000, source: 'record' as const, label: 'Semi' },
]
const goal = (over: Partial<Goal>): Goal => ({ id: 'g', type: 'route', distance: '10k', date: '2027-04-11', createdAt: '', ...over })

describe('forme actuelle', () => {
  it('records anciens → estimée et corrigée de l’arrêt', () => {
    const f = estimateFitness(records, today)
    expect(f.confidence).toBe('estimee')
    expect(f.pastBest).toBeGreaterThan(44)
    expect(f.vdot!).toBeLessThan(f.pastBest!)
    expect(f.vdot!).toBeGreaterThan(34)
  })
  it('test récent → mesurée', () => {
    const f = estimateFitness([...records, { id: 't', date: '2026-12-20', distanceM: 5600, timeSec: 1800, source: 'test', label: 'Test 30 min' }], '2027-01-05')
    expect(f.confidence).toBe('mesuree')
    expect(f.basis).toMatch(/Test 30 min/)
  })
  it('rien → inconnue', () => {
    expect(estimateFitness([], today).confidence).toBe('inconnue')
  })
})

describe('outils', () => {
  it('volume : de 90 à 144 min ≈ 9 semaines (avec allègements)', () => {
    expect(volumeWeeks(90, 144)).toBe(9)
    expect(volumeWeeks(200, 150)).toBe(0)
  })
  it('VDOT : plus rapide pour retrouver son niveau passé', () => {
    expect(vdotWeeks(38, 42, 45)).toBe(10)
    expect(vdotWeeks(44, 46, 45)).toBe(Math.ceil(1 / 0.4 + 1 / 0.15))
    expect(vdotAfter(38, 10, 45)).toBeCloseTo(42, 5)
  })
})

describe('bilan d’objectif', () => {
  const fitness = estimateFitness(records, today)
  const base = { today, fitness, recentWeeklyMin: 60, canRun30: false, repriseLevel: 2 }

  it('10 km en avril, sans chrono : réaliste', () => {
    const a = assessGoal({ ...base, goal: goal({}) })
    expect(a.verdict).toBe('realiste')
    expect(a.lines.join(' ')).toMatch(/reprise \(niveau 2\/9\)/)
    expect(a.predictionNow).toBeDefined()
  })
  it('marathon en 3h15 en mars : déconseillé, avec alternatives et avis médical', () => {
    const a = assessGoal({ ...base, goal: goal({ distance: 'marathon', targetTimeSec: 3 * 3600 + 15 * 60, date: '2027-03-07' }) })
    expect(a.verdict).toBe('deconseille')
    expect(a.alternatives.join(' ')).toMatch(/semi-marathon comme objectif d’étape/)
    expect(a.alternatives.join(' ')).toMatch(/Décaler la date/)
    expect(a.lines.join(' ')).toMatch(/avis médical/)
    expect(a.earliestDate > '2027-03-07').toBe(true)
  })
  it('semi en 1h45 à l’automne 2027 : réaliste grâce au niveau déjà atteint', () => {
    const a = assessGoal({ ...base, goal: goal({ distance: 'semi', targetTimeSec: 6300, date: '2027-10-17' }) })
    expect(a.verdict).toBe('realiste')
    expect(a.lines.join(' ')).toMatch(/tu as déjà eu ce niveau/)
  })
  it('trail : selon km-effort', () => {
    const a = assessGoal({ ...base, goal: { id: 't', type: 'trail', trailKm: 25, elevationGainM: 1200, date: '2027-06-13', createdAt: '' } })
    expect(['realiste', 'ambitieux']).toContain(a.verdict)
    expect(goalLabel({ id: 't', type: 'trail', trailKm: 25, elevationGainM: 1200, date: '', createdAt: '' })).toBe('Trail 25 km · 1200 m D+')
  })
  it('libellés', () => {
    expect(goalLabel(goal({ distance: 'semi', targetTimeSec: 6300 }))).toBe('Semi-marathon en 1h45')
    expect(goalLabel(goal({ type: 'chrono', distance: '5k', targetTimeSec: 1380 }))).toBe('Record sur 5 km en 23:00')
  })
})
