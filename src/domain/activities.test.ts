import { describe, expect, it } from 'vitest'
import type { Activity, PlannedSession } from '../data/types'
import { mapActivity, mapWellness, matchActivities } from './activities'

const sess = (id: string, date: string, kind: PlannedSession['kind'], status: PlannedSession['status'] = 'planned'): PlannedSession => ({
  id, date, kind, title: kind, durationMin: 30, reasons: [], status, externalId: id, sync: { status: 'sent' },
})
const act = (id: string, date: string, type = 'Run', over: Partial<Activity> = {}): Activity => ({ id, date, type, durationSec: 1800, ...over })

describe('lecture Intervals.icu', () => {
  it('activité', () => {
    const a = mapActivity({ id: 'i123', start_date_local: '2026-11-17T18:32:00', type: 'Run', moving_time: 1920, distance: 4800, average_heartrate: 142, icu_training_load: 38, icu_rpe: 5, name: 'Course du soir', calories: 420 })
    expect(a).toMatchObject({ id: 'i123', date: '2026-11-17', durationSec: 1920, distanceM: 4800, avgHr: 142, load: 38, rpe: 5, calories: 420 })
  })
  it('ignore les données incomplètes ou absurdes', () => {
    expect(mapActivity({ type: 'Run' })).toBeUndefined()
    expect(mapActivity({ id: 1, start_date_local: '2026-11-17T08:00:00', icu_rpe: 0 })!.rpe).toBeUndefined()
  })
  it('bien-être', () => {
    expect(mapWellness({ id: '2026-11-17', sleepSecs: 25200, restingHR: 52, hrv: null })).toEqual({
      date: '2026-11-17', sleepHours: 7, sleepScore: undefined, restingHr: 52, hrv: undefined, weightKg: undefined, bodyBattery: undefined, hydrationMl: undefined,
    })
    expect(mapWellness({ id: '2026-11-17', hydrationVolume: 1.8 })!.hydrationMl).toBe(1800)
    expect(mapWellness({ id: '2026-11-17', hydrationVolume: 1500 })!.hydrationMl).toBe(1500)
    expect(mapWellness({ id: 'x' })).toBeUndefined()
  })
})

describe('rapprochement', () => {
  const plan = [sess('c17', '2026-11-17', 'marche-course'), sess('r18', '2026-11-18', 'renfo'), sess('c19', '2026-11-19', 'marche-course'), sess('l22', '2026-11-22', 'sortie-longue')]
  it('même jour', () => {
    expect(matchActivities([act('a', '2026-11-17')], plan).matches).toEqual([{ activityId: 'a', sessionId: 'c17' }])
  })
  it('décalée d’un jour (faite le lendemain)', () => {
    expect(matchActivities([act('a', '2026-11-20')], plan).matches).toEqual([{ activityId: 'a', sessionId: 'c19' }])
  })
  it('renfo enregistré sur la montre', () => {
    expect(matchActivities([act('w', '2026-11-18', 'WeightTraining')], plan).matches[0].sessionId).toBe('r18')
  })
  it('sortie en plus et vélo : pas de rapprochement', () => {
    const r = matchActivities([act('a', '2026-11-25'), act('v', '2026-11-17', 'Ride')], plan)
    expect(r.extras.sort()).toEqual(['a', 'v'])
    expect(r.matches).toEqual([])
  })
  it('une séance n’est rapprochée qu’une fois ; une activité déjà rapprochée est gardée', () => {
    const r = matchActivities([act('a', '2026-11-17', 'Run', { matchedSessionId: 'c17' }), act('b', '2026-11-17')], plan)
    expect(r.matches).toEqual([])
    expect(r.extras).toEqual(['b'])
  })
})
