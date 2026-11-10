import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CoachDB } from '../data/db'
import { addDays } from '../domain/dates'
import { estimateFitness } from '../domain/fitness'
import { savePlanConfig } from './config'
import { regenerate, markDone } from './plan'
import { abandonGoal, addPerformance, assess, getGoal, getPerformances, resultsAwaited, saveTestResult, scheduleCalibrationTest, setGoal } from './goals'

const MONDAY = '2026-11-16'
let n = 0
let database: CoachDB
beforeEach(async () => {
  database = new CoachDB(`goal-${n++}`)
  await database.open()
  await savePlanConfig({ startDate: MONDAY, runsPerWeek: 3, strengthPerWeek: 2, longRunWeekday: 6, repriseLevel: 9, strengthLevel: 2, recalcMode: 'auto', tone: 'direct', mode: 'forme', formeBaseMinutes: 130 }, database)
  await regenerate('Création', MONDAY, database)
})
afterEach(() => database.delete())

describe('objectif dans l’appli', () => {
  it('bilan, lancement, séances avec allures, abandon propre', async () => {
    await addPerformance({ date: '2026-03-15', distanceM: 21097.5, timeSec: 6000, source: 'record', label: 'Semi' }, database)
    const goal = { id: 'g1', type: 'route' as const, distance: '10k' as const, targetTimeSec: 50 * 60, date: '2027-03-14', createdAt: '' }
    const a = await assess(goal, MONDAY, database)
    expect(a.verdict).toBe('realiste')
    await setGoal(goal, MONDAY, database)
    const g = await getGoal(database)
    expect(g!.planStart).toBe(MONDAY)
    const runs = (await database.sessions.toArray()).filter((s) => s.kind !== 'renfo')
    expect(runs.every((s) => s.reasons[0].includes('plan objectif'))).toBe(true)
    expect(runs.some((s) => s.workoutText?.includes('/km Pace'))).toBe(true)

    await abandonGoal(MONDAY, database)
    expect(await getGoal(database)).toBeUndefined()
    const after = (await database.sessions.toArray()).filter((s) => s.kind !== 'renfo')
    expect(after.every((s) => s.reasons[0].includes('forme continue'))).toBe(true)
  })

  it('pendant la reprise, l’objectif attend la fin de la reprise', async () => {
    await savePlanConfig({ startDate: MONDAY, runsPerWeek: 3, strengthPerWeek: 2, longRunWeekday: 6, repriseLevel: 3, strengthLevel: 1, recalcMode: 'auto', tone: 'direct' }, database)
    await setGoal({ id: 'g', type: 'route', distance: '10k', date: '2027-05-16', createdAt: '' }, MONDAY, database)
    const runs = (await database.sessions.toArray()).filter((s) => s.kind !== 'renfo')
    expect(runs.every((s) => s.reasons[0].includes('reprise'))).toBe(true)
    expect((await getGoal(database))!.planStart).toBeUndefined()
  })

  it('test de calibration : programmé, fait, résultat saisi → forme mesurée', async () => {
    const date = addDays(MONDAY, 2)
    const s = await scheduleCalibrationTest(date, MONDAY, database)
    expect((await database.sessions.get(s.id))!.workoutText).toMatch(/Test 30 min/)
    await markDone(s.id, 8, database)
    expect((await resultsAwaited(date, database)).map((x) => x.id)).toEqual([s.id])
    await saveTestResult((await database.sessions.get(s.id))!, { distanceM: 6000, timeSec: 1800 }, date, database)
    expect(await resultsAwaited(date, database)).toEqual([])
    const f = estimateFitness(await getPerformances(database), date)
    expect(f.confidence).toBe('mesuree')
    expect(f.vdot).toBeCloseTo(38.7, 0) // 6 km en 30 min ≈ VDOT 39 (tables de Daniels)
  })
})
