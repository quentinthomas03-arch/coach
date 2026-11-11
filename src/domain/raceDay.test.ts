import { describe, expect, it } from 'vitest'
import { raceDayPlan, raceDebrief } from './raceDay'

describe('plan de course', () => {
  it('semi en 1h40 : départ prudent, passages cohérents, chrono final proche', () => {
    const r = raceDayPlan({ distanceKm: 21.0975, timeSec: 6000, weightKg: 75, date: '2027-04-11', startTime: '09:30' })
    expect(r.segments[0].paceSec!).toBeGreaterThan(r.targetPace!)
    expect(r.splits.map((s) => s.km)).toEqual([5, 10, 15, 20, 21.1])
    const [h, m, sec] = r.splits.at(-1)!.time.split(':').map(Number)
    expect(Math.abs(h * 3600 + m * 60 + sec - 6000)).toBeLessThan(60)
    expect(r.carbLoad.days).toBe(1)
    expect(r.carbLoad.gPerDay).toBe(525)
    expect(r.during[0]).toMatch(/40 g/)
    expect(r.timeline.find((t) => t.what === 'Petit-déjeuner')?.when).toBe('06:30')
  })
  it('marathon : charge sur 2 jours, 60 g/h', () => {
    const r = raceDayPlan({ distanceKm: 42.195, timeSec: 12840, weightKg: 75, date: '2027-10-10' })
    expect(r.carbLoad.days).toBe(2)
    expect(r.during[0]).toMatch(/60 g/)
    expect(r.timeline[0].when).toBe('2027-10-08')
  })
  it('10 km sans chrono connu : à l’effort, pas de passages, rien à manger pendant', () => {
    const r = raceDayPlan({ distanceKm: 10, weightKg: 75, date: '2027-03-01' })
    expect(r.splits).toEqual([])
    expect(r.carbLoad.days).toBe(0)
    expect(r.during[0]).toMatch(/Pas besoin/)
  })
  it('bilan après course', () => {
    expect(raceDebrief(10, 2900, 3000).join(' ')).toMatch(/plus vite que prévu/)
    expect(raceDebrief(10, 3020, 3000).join(' ')).toMatch(/Pile/)
    expect(raceDebrief(10, 3200, 3000, true).join(' ')).toMatch(/pars 5 s\/km/)
  })
})
