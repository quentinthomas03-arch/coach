import type { ISODate, PlannedSession } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import { addDays } from '../domain/dates'
import { explainError, IntervalsClient, toStartDateLocal, type IntervalsEventInput } from '../integrations/intervals'
import { loadCredentials, logSync } from '../integrations/intervalsStore'
import { KEYS } from './config'
import { isRunSession } from './plan'

/**
 * Envoi sur la montre (via Intervals.icu) des séances de COURSE des 7 prochains jours.
 * Le renfo n'est pas envoyé (décision Phase 0 : il se fait dans l'appli).
 */
export const SYNC_HORIZON_DAYS = 7

export function toEvent(s: PlannedSession): IntervalsEventInput {
  return {
    external_id: s.externalId,
    category: 'WORKOUT',
    start_date_local: toStartDateLocal(s.date),
    type: 'Run',
    name: `Coach · ${s.title}`,
    description: s.workoutText,
    moving_time: s.durationMin * 60,
  }
}

export function sessionsToSend(all: PlannedSession[], today: ISODate): PlannedSession[] {
  const end = addDays(today, SYNC_HORIZON_DAYS)
  return all.filter((s) => isRunSession(s) && s.status === 'planned' && s.date >= today && s.date < end && !!s.workoutText && s.sync.status !== 'sent')
}

export interface SyncResult {
  ok: boolean
  sent: number
  deleted: number
  message: string
}

export async function syncToWatch(today: ISODate, database: CoachDB = db, client?: IntervalsClient): Promise<SyncResult> {
  if (!client) {
    const creds = await loadCredentials()
    if (!creds) return { ok: false, sent: 0, deleted: 0, message: 'Intervals.icu non connecté.' }
    client = new IntervalsClient(creds)
  }
  const pending = (await getSetting<string[]>(KEYS.pendingDeletes, database)) ?? []
  const toSend = sessionsToSend(await database.sessions.where('date').aboveOrEqual(today).toArray(), today)
  let deleted = 0
  try {
    if (pending.length) {
      await client.deleteEventsByExternalId(pending)
      deleted = pending.length
      await setSetting(KEYS.pendingDeletes, [], database)
    }
    if (toSend.length) {
      const res = await client.upsertEvents(toSend.map(toEvent))
      const at = new Date().toISOString()
      await database.transaction('rw', database.sessions, async () => {
        for (const s of toSend) {
          const ev = res.find((r) => r.external_id === s.externalId)
          await database.sessions.update(s.id, { sync: { status: 'sent', at, intervalsEventId: ev?.id } })
        }
      })
    }
    const message = toSend.length || deleted ? `${toSend.length} séance(s) envoyée(s), ${deleted} retirée(s).` : 'Montre à jour.'
    if (toSend.length || deleted) await logSync('sync-montre', true, message)
    return { ok: true, sent: toSend.length, deleted, message }
  } catch (e) {
    const message = explainError(e)
    await database.transaction('rw', database.sessions, async () => {
      for (const s of toSend) await database.sessions.update(s.id, { sync: { ...s.sync, status: 'error', error: message } })
    })
    await logSync('sync-montre', false, message)
    return { ok: false, sent: 0, deleted: 0, message }
  }
}
