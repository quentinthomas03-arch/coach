import { describe, expect, it } from 'vitest'
import type { Activity, PlannedSession } from '../data/types'
import { addDays } from './dates'
import { buildLoadEntries, loadStatus, weeklyLoads, type LoadEntry } from './load'

const today = '2026-12-10' // jeudi
const e = (daysAgo: number, minutes: number, rpe = 4, run = true): LoadEntry => ({ date: addDays(today, -daysAgo), minutes, rpe, load: minutes * rpe, run, source: 'manuel' })

describe('charge', () => {
  it('activité + retour + séance manuelle', () => {
    const s: PlannedSession[] = [
      { id: 's1', date: '2026-12-08', kind: 'marche-course', title: '', durationMin: 31, reasons: [], status: 'done', externalId: '', sync: { status: 'sent' } },
      { id: 's2', date: '2026-12-09', kind: 'renfo', title: '', durationMin: 16, reasons: [], status: 'done', externalId: '', sync: { status: 'sent' } },
    ]
    const a: Activity[] = [{ id: 'a1', date: '2026-12-08', type: 'Run', durationSec: 1860, distanceM: 4200, matchedSessionId: 's1' }]
    const fb = [{ id: 'f', sessionId: 's1', date: '2026-12-08', rpe: 6, at: '' }]
    const out = buildLoadEntries(a, s, fb)
    expect(out).toEqual([
      { date: '2026-12-08', minutes: 31, rpe: 6, load: 186, run: true, km: 4.2, source: 'activite' },
      { date: '2026-12-09', minutes: 16, rpe: 5, load: 80, run: false, source: 'manuel' },
    ])
  })
  it('semaines', () => {
    const w = weeklyLoads([e(0, 30), e(2, 20, 5, false), e(8, 40)], '2026-12-07', 2)
    expect(w).toEqual([
      { weekStart: '2026-11-30', load: 160, runMinutes: 40, runKm: 0, strengthSessions: 0, sessions: 1 },
      { weekStart: '2026-12-07', load: 220, runMinutes: 30, runKm: 0, strengthSessions: 1, sessions: 2 },
    ])
  })
})

describe('garde-fous', () => {
  it('pas d’alerte sans historique suffisant', () => {
    expect(loadStatus([e(1, 60, 8), e(2, 60, 8)], today).ratio).toBeUndefined()
  })
  it('charge stable : ratio ~1, pas d’alerte', () => {
    const hist = [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25].map((d) => e(d, 40))
    const st = loadStatus(hist, today)
    expect(st.ratio).toBeGreaterThan(0.8)
    expect(st.ratio).toBeLessThan(1.3)
    expect(st.alerts).toEqual([])
  })
  it('pic de charge : alerte ratio', () => {
    const hist = [14, 17, 21, 24].map((d) => e(d, 30, 3)).concat([0, 1, 2, 3, 4].map((d) => e(d, 60, 6)))
    expect(loadStatus(hist, today).alerts.map((a) => a.rule)).toContain('acwr')
  })
  it('volume qui saute de plus de 15 % : alerte', () => {
    // semaine dernière (lun 30/11 → dim 6/12) : 100 min ; cette semaine (depuis lun 7/12) : 130 min
    const hist = [e(5, 50), e(7, 50), e(1, 65), e(2, 65)]
    const st = loadStatus(hist, today)
    expect(st.thisWeekRunMin).toBe(130)
    expect(st.lastWeekRunMin).toBe(100)
    expect(st.alerts.map((a) => a.rule)).toContain('volume')
  })
})
