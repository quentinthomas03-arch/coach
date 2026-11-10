import type { ISODate, MorningCheckin, PlannedSession, SessionFeedback } from '../data/types'
import { addDays } from './dates'
import { nextLevel, type LevelDecision, type WeekReview } from './reprise'

/**
 * Bilan d'une semaine terminée → niveaux de la semaine suivante.
 */

export function reviewWeek(
  weekStart: ISODate,
  sessions: PlannedSession[],
  feedback: SessionFeedback[],
  checkins: MorningCheckin[],
  kind: 'course' | 'renfo',
): WeekReview {
  const end = addDays(weekStart, 7)
  const inWeek = (d: ISODate) => d >= weekStart && d < end
  const list = sessions.filter((s) => inWeek(s.date) && s.kind !== 'repos' && (kind === 'renfo' ? s.kind === 'renfo' : s.kind !== 'renfo'))
  const done = list.filter((s) => s.status === 'done')
  const rpes = feedback.filter((f) => done.some((s) => s.id === f.sessionId)).map((f) => f.rpe)
  const pain =
    checkins.some((c) => inWeek(c.date) && !!c.douleur && c.douleur.intensite >= 2) ||
    feedback.some((f) => inWeek(f.date) && !!f.douleur && f.douleur.intensite >= 2)
  return {
    planned: list.length,
    done: done.length,
    avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : undefined,
    pain,
  }
}

/**
 * Renfo : on monte d'un niveau (max 5) après 2 semaines consécutives où
 * toutes les séances prévues ont été faites sans effort excessif ni douleur.
 */
export function nextStrengthLevel(current: number, last: WeekReview, previous?: WeekReview): LevelDecision {
  const ok = (r?: WeekReview) => !!r && r.planned > 0 && r.done >= r.planned && !r.pain && (r.avgRpe == null || r.avgRpe < 8)
  if (last.pain) return { level: Math.max(1, current - 1), change: current > 1 ? 'baisse' : 'stable', reason: 'Douleur signalée : renfo un cran plus doux.' }
  if (current < 5 && ok(last) && ok(previous)) {
    return { level: current + 1, change: 'monte', reason: 'Deux semaines de renfo complètes : niveau suivant.' }
  }
  return { level: current, change: 'stable', reason: 'On consolide ce niveau de renfo.' }
}

export { nextLevel }
