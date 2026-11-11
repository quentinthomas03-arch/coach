import type { Activity, ISODate, PlannedSession, Wellness } from '../data/types'
import { addDays } from './dates'

/**
 * Lecture des données Intervals.icu (activités faites, bien-être) et
 * rapprochement avec les séances prévues.
 * Les champs sont lus de façon défensive : une valeur absente est ignorée.
 */

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun', 'Treadmill'])
export const STRENGTH_TYPES = new Set(['WeightTraining', 'Workout', 'Strength'])

export function mapActivity(raw: Record<string, unknown>): Activity | undefined {
  const id = raw.id != null ? String(raw.id) : undefined
  const start = str(raw.start_date_local)
  if (!id || !start) return undefined
  const durationSec = num(raw.moving_time) ?? num(raw.elapsed_time) ?? 0
  const rpe = num(raw.icu_rpe) ?? num(raw.perceived_exertion)
  return {
    id,
    date: start.slice(0, 10),
    type: str(raw.type) ?? 'Other',
    durationSec,
    distanceM: num(raw.distance),
    elevationGainM: num(raw.total_elevation_gain),
    avgHr: num(raw.average_heartrate),
    load: num(raw.icu_training_load),
    rpe: rpe != null && rpe >= 1 && rpe <= 10 ? rpe : undefined,
    name: str(raw.name),
    calories: num(raw.calories),
    cadence: cadenceSpm(num(raw.average_cadence)),
  }
}

/** Cadence en pas par minute (certaines sources la donnent par jambe : on double). */
function cadenceSpm(v?: number): number | undefined {
  if (v == null || v <= 0) return undefined
  return Math.round(v < 120 ? v * 2 : v)
}

/** Intervals.icu peut donner l'eau en litres ou en ml selon la source : on normalise en ml. */
function hydrationMl(v?: number): number | undefined {
  if (v == null || v <= 0) return undefined
  return Math.round(v < 20 ? v * 1000 : v)
}

export function mapWellness(raw: Record<string, unknown>): Wellness | undefined {
  const date = str(raw.id)
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined
  const sleepSecs = num(raw.sleepSecs)
  return {
    date,
    sleepHours: sleepSecs != null ? Math.round((sleepSecs / 3600) * 10) / 10 : undefined,
    sleepScore: num(raw.sleepScore),
    restingHr: num(raw.restingHR),
    hrv: num(raw.hrv),
    weightKg: num(raw.weight),
    bodyBattery: num(raw.bodyBattery),
    hydrationMl: hydrationMl(num(raw.hydrationVolume)),
    vo2max: num(raw.vo2max),
  }
}

export interface MatchResult {
  /** activité → séance prévue rapprochée */
  matches: { activityId: string; sessionId: string }[]
  /** activités sans séance correspondante (sorties en plus) */
  extras: string[]
}

/**
 * Rapproche chaque activité d'une séance prévue :
 * course → séance de course du même jour, sinon de la veille ou du lendemain non faite ;
 * renfo → séance de renfo du même jour (± 1 jour).
 * Une séance n'est rapprochée qu'une fois. Les activités déjà rapprochées sont gardées.
 */
export function matchActivities(activities: Activity[], sessions: PlannedSession[]): MatchResult {
  const matches: MatchResult['matches'] = []
  const extras: string[] = []
  const used = new Set(sessions.filter((s) => activities.some((a) => a.matchedSessionId === s.id)).map((s) => s.id))
  const sorted = [...activities].sort((a, b) => (a.date < b.date ? -1 : 1))
  for (const a of sorted) {
    if (a.matchedSessionId) continue
    const isRun = RUN_TYPES.has(a.type)
    const isStrength = STRENGTH_TYPES.has(a.type)
    if (!isRun && !isStrength) {
      extras.push(a.id)
      continue
    }
    const fits = (s: PlannedSession) =>
      !used.has(s.id) && s.status !== 'skipped' && (isRun ? s.kind !== 'renfo' && s.kind !== 'repos' : s.kind === 'renfo')
    const candidates = [a.date, addDays(a.date, -1), addDays(a.date, 1)]
    let found: PlannedSession | undefined
    for (const d of candidates) {
      found = sessions.find((s) => s.date === d && fits(s) && (d === a.date || s.status !== 'done'))
      if (found) break
    }
    if (found) {
      used.add(found.id)
      matches.push({ activityId: a.id, sessionId: found.id })
    } else extras.push(a.id)
  }
  return { matches, extras }
}

/** Résumé lisible d'une activité. */
export function activityLabel(a: Activity): string {
  const min = Math.round(a.durationSec / 60)
  const km = a.distanceM ? ` · ${(a.distanceM / 1000).toFixed(1).replace('.', ',')} km` : ''
  return `${a.name ?? a.type} · ${min} min${km}`
}

export { type ISODate }
