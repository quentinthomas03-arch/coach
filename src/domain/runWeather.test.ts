import { describe, expect, it } from 'vitest'
import type { PlannedSession } from '../data/types'
import { assessSessionWeather, parseForecast, swapCandidate, type Forecast, type HourWeather } from './runWeather'

const hour = (time: string, o: Partial<HourWeather> = {}): HourWeather => ({ time, tempC: 10, feelsC: 9, precipMm: 0, windKmh: 10, code: 2, ...o })
const ses = (id: string, date: string, kind = 'endurance', durationMin = 45): PlannedSession => ({ id, date, kind, durationMin, title: id, reasons: [], status: 'planned', externalId: id, sync: { status: 'pending' } }) as unknown as PlannedSession
const f = (hours: HourWeather[]): Forecast => ({ hours, sun: { '2026-11-12': { rise: '08:10', set: '17:20' }, '2026-11-14': { rise: '08:12', set: '17:18' } } })

describe('météo des séances', () => {
  it('beau temps de jour : rien à signaler', () => {
    const r = assessSessionWeather(ses('a', '2026-11-14'), '10:00', f([hour('2026-11-14T10:00')]))
    expect(r?.level).toBe('ok')
  })
  it('soir d’hiver : nuit et froid', () => {
    const r = assessSessionWeather(ses('a', '2026-11-12'), '18:30', f([hour('2026-11-12T18:00', { feelsC: -2 }), hour('2026-11-12T19:00', { feelsC: -3 })]))
    expect(r?.level).toBe('conseil')
    expect(r?.tips.join(' ')).toMatch(/frontale/)
    expect(r?.tips.join(' ')).toMatch(/3 couches/)
  })
  it('orage ou forte pluie : décaler', () => {
    expect(assessSessionWeather(ses('a', '2026-11-12'), '18:30', f([hour('2026-11-12T18:00', { code: 95 }), hour('2026-11-12T19:00')]))?.level).toBe('decaler')
    const r = assessSessionWeather(ses('a', '2026-11-12'), '18:30', f([hour('2026-11-12T18:00', { precipMm: 6, code: 63 }), hour('2026-11-12T19:00', { precipMm: 5, code: 63 })]))
    expect(r?.level).toBe('decaler')
    expect(r?.summary).toMatch(/forte pluie/)
  })
  it('verglas : pluie sous zéro', () => {
    expect(assessSessionWeather(ses('a', '2026-11-12'), '18:30', f([hour('2026-11-12T18:00', { tempC: -1, precipMm: 0.5 })]))?.level).toBe('decaler')
  })
  it('échange : le jour le plus proche au beau temps, renfo accepté', () => {
    const fc = f([hour('2026-11-12T18:00', { code: 95 }), hour('2026-11-13T18:00'), hour('2026-11-14T10:00')])
    const bad = ses('a', '2026-11-12')
    const renfo = ses('r', '2026-11-13', 'renfo', 20)
    const w = (s: PlannedSession) => assessSessionWeather(s, s.date === '2026-11-14' ? '10:00' : '18:00', fc)
    expect(swapCandidate(bad, [bad, renfo, ses('b', '2026-11-14')], w)?.id).toBe('r')
    expect(swapCandidate(bad, [bad, { ...renfo, locked: true }], w)).toBeUndefined()
  })
  it('lecture Open-Meteo', () => {
    const p = parseForecast({ hourly: { time: ['2026-11-12T18:00'], temperature_2m: [4], apparent_temperature: [1], precipitation: [0], wind_speed_10m: [12], weather_code: [3] }, daily: { time: ['2026-11-12'], sunrise: ['2026-11-12T08:10'], sunset: ['2026-11-12T17:20'] } })
    expect(p?.hours[0]).toMatchObject({ tempC: 4, feelsC: 1 })
    expect(p?.sun['2026-11-12']).toEqual({ rise: '08:10', set: '17:20' })
    expect(parseForecast({})).toBeUndefined()
  })
})
