import { describe, expect, it } from 'vitest'
import type { PlannedSession } from '../data/types'
import { reviewText, weeklyReview } from './weeklyReview'

const s = (id: string, date: string, kind: PlannedSession['kind'], status: PlannedSession['status']): PlannedSession => ({
  id, date, kind, title: kind === 'renfo' ? 'Renfo A' : 'Marche-course', durationMin: 40, reasons: [], status, externalId: '', sync: { status: 'sent' },
})

describe('bilan de la semaine', () => {
  const base = {
    monday: '2026-11-16', tone: 'direct' as const, entries: [], sleepHours: [], waterMl: [], weights: [], notesCount: 0,
    checkins: Array.from({ length: 6 }, (_, i) => ({ date: `2026-11-1${6 + i}`, physique: 4, moral: 4, travail: 3, viePerso: 4, at: '' })),
    nextSessions: [s('n1', '2026-11-24', 'marche-course', 'planned'), s('n2', '2026-11-23', 'renfo', 'planned')],
  }
  it('semaine complète : félicitations, programme de la suivante dans l’ordre', () => {
    const r = weeklyReview({ ...base, sessions: [s('a', '2026-11-17', 'marche-course', 'done'), s('b', '2026-11-18', 'renfo', 'done'), s('c', '2026-11-22', 'sortie-longue', 'done')] })
    expect(r.facts[0]).toMatch(/Course : 2\/2/)
    expect(r.coach[0]).toMatch(/Bravo/)
    expect(r.nextWeek).toEqual(['lundi : Renfo A (40 min)', 'mardi : Marche-course (40 min)'])
    expect(reviewText(r)).toMatch(/^Bilan de la semaine du 16\/11/)
  })
  it('en cours de semaine : les séances à venir ne comptent pas', () => {
    const r = weeklyReview({ ...base, today: '2026-11-18', sessions: [s('a', '2026-11-17', 'marche-course', 'done'), s('b', '2026-11-19', 'renfo', 'planned'), s('c', '2026-11-22', 'sortie-longue', 'planned')] })
    expect(r.title).toMatch(/^Bilan en cours/)
    expect(r.facts[0]).toMatch(/Course : 1\/1/)
    expect(r.coach.join(' ')).not.toMatch(/Peu de séances|trappe/)
  })
  it('renfo oublié et semaine incomplète : le coach le dit', () => {
    const r = weeklyReview({ ...base, sessions: [s('a', '2026-11-17', 'marche-course', 'done'), s('b', '2026-11-18', 'renfo', 'missed'), s('c', '2026-11-22', 'sortie-longue', 'missed')] })
    expect(r.coach.join(' ')).toMatch(/renfo est passé à la trappe/)
    expect(r.coach.join(' ')).toMatch(/Peu de séances|Correct/)
  })
})
