import type { ISODate, PlannedSession } from '../data/types'
import { addDays, mondayOf } from './dates'

/**
 * Série de semaines régulières (comme les séries de Nike Run Club / Duolingo) :
 * semaines terminées consécutives avec au moins toutes les séances prévues sauf une (et au moins 2).
 * Une semaine en pause ou sans séance prévue ne casse pas la série.
 */
export function regularStreak(sessions: PlannedSession[], today: ISODate, maxWeeks = 52): number {
  let n = 0
  for (let w = addDays(mondayOf(today), -7), i = 0; i < maxWeeks; w = addDays(w, -7), i++) {
    const list = sessions.filter((s) => s.date >= w && s.date < addDays(w, 7) && s.kind !== 'repos' && s.status !== 'skipped')
    if (!list.length) {
      if (n === 0 && i > 0) break
      continue
    }
    const done = list.filter((s) => s.status === 'done').length
    if (done >= Math.max(2, list.length - 1)) n++
    else break
  }
  return n
}
