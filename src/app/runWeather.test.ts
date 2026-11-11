import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { sessionsWeather } from './runWeather'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('météo des séances (service)', () => {
  it('orage jeudi soir : propose l’échange avec le renfo du vendredi', async () => {
    const base = { title: 'S', reasons: [], status: 'planned', sync: { status: 'pending' } }
    await db.sessions.bulkPut([
      { ...base, id: 'run', date: '2026-11-12', kind: 'endurance', durationMin: 45, externalId: 'run' },
      { ...base, id: 'renfo', date: '2026-11-13', kind: 'renfo', durationMin: 20, externalId: 'renfo' },
    ] as never)
    const hours = ['2026-11-12T18:00', '2026-11-12T19:00', '2026-11-13T18:00', '2026-11-13T19:00'].map((time, i) => ({ time, i }))
    const raw = { hourly: { time: hours.map((h) => h.time), temperature_2m: [8, 8, 9, 9], apparent_temperature: [6, 6, 7, 7], precipitation: [3, 2, 0, 0], wind_speed_10m: [20, 20, 10, 10], weather_code: [95, 95, 2, 2] }, daily: { time: ['2026-11-12', '2026-11-13'], sunrise: ['2026-11-12T08:10', '2026-11-13T08:11'], sunset: ['2026-11-12T17:20', '2026-11-13T17:19'] } }
    const r = await sessionsWeather('2026-11-12', db, { pos: async () => ({ lat: 47.2, lon: -1.5 }), fetch: async () => raw })
    expect(r).toHaveLength(1)
    expect(r[0].level).toBe('decaler')
    expect(r[0].swapWith?.id).toBe('renfo')
  })
})
