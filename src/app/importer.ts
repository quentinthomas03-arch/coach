import type { ISODate } from '../data/types'
import { db, type CoachDB } from '../data/db'
import { addDays } from '../domain/dates'
import { mapActivity, mapWellness, matchActivities } from '../domain/activities'
import { explainError, IntervalsClient } from '../integrations/intervals'
import { loadCredentials, logSync } from '../integrations/intervalsStore'
import { getSetting, setSetting } from '../data/db'
import { detectEfforts, estimateFitness, hrMaxOf, RECENT_DAYS, type Performance } from '../domain/fitness'
import { KEYS } from './config'

/**
 * Import depuis Intervals.icu (sens Garmin → appli) :
 * activités faites et bien-être (sommeil, FC de repos, HRV…) des 35 derniers jours.
 * Les séances prévues correspondantes passent automatiquement en « faite ».
 */
export const IMPORT_DAYS = 35

export interface ImportResult {
  ok: boolean
  activities: number
  wellnessDays: number
  matched: number
  message: string
}

export async function importFromIntervals(today: ISODate, database: CoachDB = db, client?: IntervalsClient): Promise<ImportResult> {
  if (!client) {
    const creds = await loadCredentials()
    if (!creds) return { ok: false, activities: 0, wellnessDays: 0, matched: 0, message: 'Intervals.icu non connecté.' }
    client = new IntervalsClient(creds)
  }
  const oldest = addDays(today, -IMPORT_DAYS)
  try {
    const [rawActs, rawWell] = await Promise.all([client.listActivities(oldest, today), client.listWellness(oldest, today)])
    const fresh = rawActs.map(mapActivity).filter((a): a is NonNullable<typeof a> => !!a)
    const wellness = rawWell.map(mapWellness).filter((w): w is NonNullable<typeof w> => !!w)
    let matchedCount = 0
    await database.transaction('rw', [database.activities, database.wellness, database.sessions, database.feedback], async () => {
      // On garde le rapprochement déjà fait pour les activités connues.
      const known = await database.activities.bulkGet(fresh.map((a) => a.id))
      const acts = fresh.map((a, i) => ({ ...a, matchedSessionId: known[i]?.matchedSessionId }))
      const sessions = await database.sessions.where('date').between(addDays(oldest, -1), addDays(today, 1), true, true).toArray()
      const { matches } = matchActivities(acts, sessions)
      for (const m of matches) {
        const a = acts.find((x) => x.id === m.activityId)!
        a.matchedSessionId = m.sessionId
        await database.sessions.update(m.sessionId, { status: 'done' })
        if (a.rpe != null && !(await database.feedback.get(`fb-${m.sessionId}`))) {
          await database.feedback.put({ id: `fb-${m.sessionId}`, sessionId: m.sessionId, activityId: a.id, date: a.date, rpe: a.rpe, at: new Date().toISOString() })
        }
      }
      matchedCount = matches.length
      await database.activities.bulkPut(acts)
      await database.wellness.bulkPut(wellness)
    })
    await updateAutoPerformances(today, database)
    const message = `${fresh.length} activité(s), ${wellness.length} jour(s) de bien-être, ${matchedCount} séance(s) reconnue(s).`
    if (matchedCount) await logSync('import', true, message)
    return { ok: true, activities: fresh.length, wellnessDays: wellness.length, matched: matchedCount, message }
  } catch (e) {
    const message = explainError(e)
    await logSync('import', false, message)
    return { ok: false, activities: 0, wellnessDays: 0, matched: 0, message }
  }
}

/** Activités récentes sans effort ressenti : l'appli me demande « c'était dur comment ? ». */
export async function activitiesAwaitingRpe(today: ISODate, database: CoachDB = db) {
  const acts = await database.activities.where('date').between(addDays(today, -3), today, true, true).toArray()
  const fb = await database.feedback.where('date').between(addDays(today, -3), today, true, true).toArray()
  return acts.filter((a) => a.rpe == null && !fb.some((f) => f.activityId === a.id || (a.matchedSessionId && f.sessionId === a.matchedSessionId)))
}

export async function saveActivityRpe(activityId: string, rpe: number, database: CoachDB = db) {
  const a = await database.activities.get(activityId)
  if (!a) return
  const id = a.matchedSessionId ? `fb-${a.matchedSessionId}` : `fb-act-${a.id}`
  await database.feedback.put({ id, sessionId: a.matchedSessionId, activityId: a.id, date: a.date, rpe, at: new Date().toISOString() })
}

/** Met à jour les performances détectées dans mes sorties ; prévient si la forme progresse. */
export async function updateAutoPerformances(today: ISODate, database: CoachDB = db) {
  const [acts, fb, profile, perfsRaw] = await Promise.all([
    database.activities.where('date').between(addDays(today, -RECENT_DAYS), today, true, true).toArray(),
    database.feedback.toArray(),
    database.profile.get('me'),
    getSetting<Performance[]>(KEYS.perfs, database),
  ])
  const perfs = perfsRaw ?? []
  const before = estimateFitness(perfs, today)
  const withRpe = acts.map((a) => ({ ...a, rpe: a.rpe ?? fb.find((f) => f.activityId === a.id || (a.matchedSessionId && f.sessionId === a.matchedSessionId))?.rpe }))
  const age = profile ? new Date(today).getFullYear() - profile.birthYear : 35
  const found = detectEfforts(withRpe, hrMaxOf(profile?.hrMax, age))
  const fresh = found.filter((p) => !perfs.some((x) => x.id === p.id))
  if (!fresh.length) return
  const next = [...perfs, ...fresh]
  await setSetting(KEYS.perfs, next, database)
  const after = estimateFitness(next, today)
  if (after.vdot != null && (before.vdot == null || after.vdot >= before.vdot + 0.5)) {
    await setSetting(
      KEYS.notice,
      { at: today, messages: [`Nouvelle référence détectée (${fresh[fresh.length - 1].label?.toLowerCase()}) : tes allures sont mises à jour${before.vdot != null ? ` (VDOT ${before.vdot} → ${after.vdot})` : ''}. Bien joué !`] },
      database,
    )
  }
}
