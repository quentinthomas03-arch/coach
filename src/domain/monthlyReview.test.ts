import { describe, expect, it } from 'vitest'
import type { Activity, PlannedSession } from '../data/types'
import { monthBounds, monthlyReview } from './monthlyReview'

describe('bilan du mois', () => {
  it('bornes', () => {
    expect(monthBounds('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28', prevFrom: '2027-01-01' })
    expect(monthBounds('2027-01').prevFrom).toBe('2026-12-01')
  })
  it('faits et avis', () => {
    const acts: Activity[] = [
      { id: 'a', date: '2026-11-03', type: 'Run', durationSec: 2400, distanceM: 6000 },
      { id: 'b', date: '2026-11-08', type: 'Run', durationSec: 3600, distanceM: 9000 },
      { id: 'c', date: '2026-10-08', type: 'Run', durationSec: 3000, distanceM: 7000 },
    ]
    const sessions = [
      { id: '1', date: '2026-11-03', kind: 'endurance', status: 'done' },
      { id: '2', date: '2026-11-05', kind: 'renfo', status: 'done' },
      { id: '3', date: '2026-11-08', kind: 'sortie-longue', status: 'done' },
      { id: '5', date: '2026-11-10', kind: 'endurance', status: 'done' },
      { id: '4', date: '2026-11-20', kind: 'endurance', status: 'planned' },
    ] as unknown as PlannedSession[]
    const r = monthlyReview({ month: '2026-11', today: '2026-11-11', acts, sessions, checkins: [{ date: '2026-11-02', sortie: true, alcool: '3+', cigarettes: 8 } as never], sleepHours: [], cravings: [{ at: '2026-11-04T12:00:00Z', resisted: true }], trophies: [{ id: 'premiere', emoji: '👟', label: 'Première séance', hint: '', earned: '2026-11-03' }] })
    expect(r.title).toBe('Bilan de novembre 2026')
    expect(r.facts[0]).toBe('Course : 2 sorties, 15,0 km, 1,7 h (mois d’avant : 7,0 km).')
    expect(r.facts).toContain('Séances faites : 4 sur 4 (100 %).')
    expect(r.facts.join(' ')).toMatch(/Envies de fumer : 1 tenues sur 1/)
    expect(r.facts.join(' ')).toMatch(/Trophée : Première séance/)
    expect(r.coach[0]).toMatch(/très régulier/)
    expect(r.coach.join(' ')).toMatch(/Gros mois/)
    const early = monthlyReview({ month: '2026-11', today: '2026-11-03', acts: [], sessions: sessions.slice(0, 1), checkins: [], sleepHours: [], cravings: [], trophies: [] })
    expect(early.coach).toEqual(['Trop tôt pour juger ce mois : reviens en fin de mois.'])
  })
})
