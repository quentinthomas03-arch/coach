import { describe, expect, it } from 'vitest'
import type { Activity, PlannedSession } from '../data/types'
import { cadenceInfo, newRecords, personalRecords, trophies, vo2Compare } from './progress'

const run = (date: string, km: number, min: number, cadence?: number, name?: string): Activity => ({ id: date + km, date, type: 'Run', distanceM: km * 1000, durationSec: min * 60, cadence, name })

describe('progrès', () => {
  it('cadence basse : cible +5 % et exercices', () => {
    const c = cadenceInfo([run('2026-11-01', 6, 40, 152), run('2026-11-05', 6, 40, 156), run('2026-10-01', 6, 40, 150)], '2026-11-11')
    expect(c.current).toBe(154)
    expect(c.advice[0]).toMatch(/162/)
    expect(c.advice.at(-1)).toMatch(/\+4 pas/)
    expect(cadenceInfo([], '2026-11-11').current).toBeUndefined()
  })
  it('VO2max : accord, montre optimiste, absente', () => {
    const w = [{ date: '2026-10-01', vo2max: 46 }, { date: '2026-11-10', vo2max: 48 }]
    expect(vo2Compare(w, 46.5, '2026-11-11').text).toMatch(/concordent/)
    expect(vo2Compare(w, 46.5, '2026-11-11').garminTrend).toBe(2)
    expect(vo2Compare(w, 42, '2026-11-11').text).toMatch(/optimiste/)
    expect(vo2Compare([], 42, '2026-11-11').garmin).toBeUndefined()
  })
  it('records et nouveaux records du mois', () => {
    const acts = [run('2026-09-01', 10, 55), run('2026-11-03', 10.1, 52), run('2026-11-08', 15, 90), run('2026-11-09', 5, 24)]
    const r = personalRecords(acts)
    expect(r.find((x) => x.id === 'distance')?.value).toBe('15,0 km')
    expect(r.find((x) => x.id === '10k')?.date).toBe('2026-11-03')
    expect(newRecords(acts, '2026-11-01', '2026-11-30')).toEqual([])
    expect(newRecords(acts, '2026-11-01', '2026-11-30', 1).map((x) => x.id).sort()).toEqual(['10k', '5k', 'distance', 'duree'])
  })
  it('trophées', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, date: `2026-11-${String(i + 1).padStart(2, '0')}`, status: 'done', kind: i % 3 ? 'endurance' : 'renfo' })) as unknown as PlannedSession[]
    const t = trophies({ acts: [run('2026-11-02', 5.2, 31), run('2026-11-04', 3, 20, undefined, 'Marche-course')], sessions, streak: 4, races: 0, smokeFreeDays: 8, smokeFreeSince: '2027-01-01' })
    const got = (id: string) => t.find((x) => x.id === id)?.earned
    expect(got('premiere')).toBe('2026-11-01')
    expect(got('dix')).toBe('2026-11-10')
    expect(got('30min')).toBe('2026-11-02')
    expect(got('5k')).toBe('2026-11-02')
    expect(got('10k')).toBeUndefined()
    expect(got('serie4')).toBe(true)
    expect(got('sanstabac7')).toBe('2027-01-08')
  })
})
