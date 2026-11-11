import { describe, expect, it } from 'vitest'
import type { PlannedSession } from '../data/types'
import { addDays } from './dates'
import { controlWorkout, cycleReview, efficiencyDelta, efficiencyFrom } from './cycle'
import { toIntervalsText } from './workout'

const start = '2026-11-16'
const s = (d: number, kind: PlannedSession['kind'], status: PlannedSession['status']): PlannedSession => ({ id: `${d}${kind}`, date: addDays(start, d), kind, title: '', durationMin: 40, reasons: [], status, externalId: '', sync: { status: 'sent' } })
const weeks = (done: boolean) => [0, 7, 14, 21].flatMap((w) => [s(w + 1, 'endurance', done ? 'done' : 'missed'), s(w + 2, 'renfo', done ? 'done' : 'missed'), s(w + 3, 'endurance', 'done'), s(w + 6, 'sortie-longue', 'done')])

describe('fin de cycle', () => {
  it('contrôle aérobie en FC (pas en allure)', () => {
    expect(toIntervalsText(controlWorkout())).toMatch(/Contrôle à FC zone 2, allure régulière 20m Z2 HR/)
  })
  it('mesure : tour de 20 min sinon sortie entière', () => {
    const a = { id: 'a', date: '2026-12-10', type: 'Run', durationSec: 2100, distanceM: 5000, avgHr: 150 }
    expect(efficiencyFrom(a, [{ durationSec: 600, pace: 450, avgHr: 130 }, { durationSec: 1200, pace: 410, avgHr: 145 }])).toEqual({ date: '2026-12-10', pace: 410, hr: 145 })
    expect(efficiencyFrom(a)).toEqual({ date: '2026-12-10', pace: 420, hr: 150 })
  })
  it('progrès à FC égale', () => {
    expect(efficiencyDelta({ date: '', pace: 430, hr: 145 }, { date: '', pace: 418, hr: 145 })).toBe(-12)
    expect(efficiencyDelta({ date: '', pace: 430, hr: 145 }, { date: '', pace: 425, hr: 150 })).toBe(15)
  })
  it('cycle réussi avec progrès d’endurance', () => {
    const r = cycleReview({ start, sessions: weeks(true), entries: [], checkins: [], wellness: [], weights: [], controls: [{ date: '2026-10-25', pace: 440, hr: 145 }, { date: addDays(start, 24), pace: 425, hr: 145 }], levelStart: 'reprise 4/9', levelEnd: 'reprise 7/9' })
    expect(r.verdict).toBe('reussi')
    expect(r.coach.join(' ')).toMatch(/environ 15 s\/km plus vite/)
  })
  it('cycle irrégulier', () => {
    const r = cycleReview({ start, sessions: weeks(false), entries: [], checkins: [], wellness: [], weights: [], controls: [], levelStart: '3', levelEnd: '3' })
    expect(r.verdict).toBe('correct')
    expect(r.coach.join(' ')).toMatch(/renfo reste ton point faible/)
  })
})
