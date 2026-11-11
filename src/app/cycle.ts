import type { ISODate } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import { addDays, mondayOf } from '../domain/dates'
import { cycleReview, type CycleReview, type EfficiencyPoint } from '../domain/cycle'
import { buildLoadEntries } from '../domain/load'
import { getPlanConfig, KEYS } from './config'
import { weekIndexOf } from './plan'
import { EFFICIENCY_KEY } from './importer'

export const CYCLE_KEY = 'cycle.reviews'
const SNAP_KEY = 'cycle.levelSnapshot'

export const getCycleReviews = async (database: CoachDB = db) => (await getSetting<CycleReview[]>(CYCLE_KEY, database)) ?? []

const levelLabel = (c: { mode?: string; repriseLevel: number; formeBaseMinutes?: number }) =>
  (c.mode ?? 'reprise') === 'reprise' ? `reprise niveau ${c.repriseLevel}/9` : `forme continue, ${c.formeBaseMinutes} min/semaine`

/**
 * Le lundi qui suit la 4e semaine d'un cycle : génère le bilan (une seule fois) et prévient sur l'accueil.
 * Mémorise aussi le niveau en début de cycle pour afficher « avant → après ».
 */
export async function maybeBuildCycleReview(today: ISODate, database: CoachDB = db): Promise<CycleReview | undefined> {
  const cfg = await getPlanConfig(database)
  if (!cfg) return
  const monday = mondayOf(today)
  const idx = weekIndexOf(cfg.startDate, monday)
  const snap = await getSetting<{ start: ISODate; label: string }>(SNAP_KEY, database)
  // Début de cycle : on note le niveau de départ.
  if (idx % 4 === 0 && snap?.start !== monday) await setSetting(SNAP_KEY, { start: monday, label: levelLabel(cfg) }, database)
  if (idx < 4 || idx % 4 !== 0) return
  const start = addDays(monday, -28)
  const reviews = await getCycleReviews(database)
  if (reviews.some((r) => r.start === start)) return
  const end = addDays(start, 28)
  const [sessions, acts, fb, checkins, wellness, metrics] = await Promise.all([
    database.sessions.where('date').between(start, end, true, false).toArray(),
    database.activities.where('date').between(start, end, true, false).toArray(),
    database.feedback.where('date').between(start, end, true, false).toArray(),
    database.checkins.where('date').between(start, end, true, false).toArray(),
    database.wellness.where('date').between(start, end, true, false).toArray(),
    database.bodyMetrics.where('date').between(start, end, true, false).toArray(),
  ])
  const review = cycleReview({
    start,
    sessions,
    entries: buildLoadEntries(acts, sessions, fb),
    checkins,
    wellness,
    weights: metrics.filter((m) => m.weightKg).map((m) => ({ date: m.date, kg: m.weightKg! })),
    controls: (await getSetting<EfficiencyPoint[]>(EFFICIENCY_KEY, database)) ?? [],
    levelStart: snap?.start === start ? snap.label : '—',
    levelEnd: levelLabel(cfg),
  })
  await setSetting(CYCLE_KEY, [...reviews, review], database)
  await setSetting(KEYS.notice, { at: today, messages: ['Ton bilan de cycle (4 semaines) est prêt : ce qui a marché, tes progrès, et ce que je prévois pour la suite. Plan › Bilans de cycle.'] }, database)
  return review
}
