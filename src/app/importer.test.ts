import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CoachDB } from '../data/db'
import { IntervalsClient } from '../integrations/intervals'
import { savePlanConfig } from './config'
import { regenerate } from './plan'
import { activitiesAwaitingRpe, importFromIntervals, saveActivityRpe } from './importer'

const MONDAY = '2026-11-16'
let n = 0
let database: CoachDB
beforeEach(async () => {
  database = new CoachDB(`imp-${n++}`)
  await database.open()
  await savePlanConfig({ startDate: MONDAY, runsPerWeek: 3, strengthPerWeek: 2, longRunWeekday: 6, repriseLevel: 2, strengthLevel: 1, recalcMode: 'auto', tone: 'direct' }, database)
  await regenerate('Création', MONDAY, database)
})
afterEach(() => database.delete())

function client(acts: unknown[], well: unknown[], laps: unknown = []) {
  const f = async (url: string) =>
    new Response(JSON.stringify(url.endsWith('/intervals') || url.includes('intervals=true') ? laps : url.includes('/activities') ? acts : url.includes('/wellness') ? well : []), { status: 200, headers: { 'content-type': 'application/json' } })
  return new IntervalsClient({ athleteId: 'i1', apiKey: 'abcdefghijkl' }, f as unknown as typeof fetch)
}

describe('import Intervals.icu', () => {
  it('reconnaît la sortie du jour, stocke le bien-être, demande l’effort', async () => {
    const run = (await database.sessions.toArray()).find((s) => s.kind === 'marche-course')!
    const res = await importFromIntervals(run.date, database, client(
      [{ id: 'a1', start_date_local: `${run.date}T18:30:00`, type: 'Run', moving_time: 1900, distance: 4300 }],
      [{ id: run.date, sleepSecs: 26000, restingHR: 54 }],
    ))
    expect(res).toMatchObject({ ok: true, activities: 1, wellnessDays: 1, matched: 1 })
    expect((await database.sessions.get(run.id))!.status).toBe('done')
    expect((await database.wellness.get(run.date))!.restingHr).toBe(54)
    expect((await activitiesAwaitingRpe(run.date, database)).map((a) => a.id)).toEqual(['a1'])
    await saveActivityRpe('a1', 4, database)
    expect(await activitiesAwaitingRpe(run.date, database)).toEqual([])
    // Ré-import idempotent.
    const again = await importFromIntervals(run.date, database, client([{ id: 'a1', start_date_local: `${run.date}T18:30:00`, type: 'Run', moving_time: 1900 }], []))
    expect(again.matched).toBe(0)
    expect((await database.activities.get('a1'))!.matchedSessionId).toBe(run.id)
  })
  it('récupère les tours de la sortie rapprochée', async () => {
    const run = (await database.sessions.toArray()).find((s) => s.kind === 'marche-course')!
    await importFromIntervals(run.date, database, client([{ id: 'a1', start_date_local: `${run.date}T18:30:00`, type: 'Run', moving_time: 1900 }], [], { icu_intervals: [{ moving_time: 300, distance: 600 }, { moving_time: 120, distance: 300 }] }))
    expect((await database.activities.get('a1'))!.laps).toHaveLength(2)
  })
  it('reprend l’effort saisi sur Intervals.icu', async () => {
    const run = (await database.sessions.toArray()).find((s) => s.kind === 'marche-course')!
    await importFromIntervals(run.date, database, client([{ id: 'a1', start_date_local: `${run.date}T07:00:00`, type: 'Run', moving_time: 1800, icu_rpe: 6 }], []))
    expect((await database.feedback.get(`fb-${run.id}`))!.rpe).toBe(6)
  })
})
