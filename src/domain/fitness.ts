import type { ISODate } from '../data/types'
import { daysBetween } from './dates'
import { detrainedVdot, vdotFromPerformance } from './paces'

/**
 * ESTIMATION DE TA FORME ACTUELLE (VDOT) à partir de tes performances.
 *
 * - Performance de moins de 8 semaines (test, course, record) → forme « mesurée ».
 * - Sinon, meilleure performance des 2 dernières années, corrigée du désentraînement
 *   (temps écoulé depuis) → forme « estimée », avec une fourchette large.
 * - Rien → forme « inconnue » : le coach propose le test de calibration.
 */

export interface Performance {
  id: string
  date: ISODate
  distanceM: number
  timeSec: number
  source: 'test' | 'course' | 'record' | 'auto'
  label?: string
}

export interface FitnessEstimate {
  confidence: 'mesuree' | 'estimee' | 'inconnue'
  vdot?: number
  low?: number
  high?: number
  /** Meilleur VDOT connu des 2 dernières années (référence de ce que ton corps sait faire). */
  pastBest?: number
  basis: string
}

export const RECENT_DAYS = 56
const fr = (d: ISODate) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00'))

export function estimateFitness(perfs: Performance[], today: ISODate): FitnessEstimate {
  const valid = perfs.filter((p) => p.date <= today && p.distanceM > 0 && p.timeSec > 0)
  const withVdot = valid.map((p) => ({ ...p, vdot: vdotFromPerformance(p.distanceM, p.timeSec), age: daysBetween(p.date, today) }))
  const twoYears = withVdot.filter((p) => p.age <= 730)
  const pastBest = twoYears.length ? Math.max(...twoYears.map((p) => p.vdot)) : undefined
  const recent = withVdot.filter((p) => p.age <= RECENT_DAYS).sort((a, b) => b.vdot - a.vdot)
  const r1 = (x: number) => Math.round(x * 10) / 10
  if (recent.length) {
    const best = recent[0]
    return {
      confidence: 'mesuree',
      vdot: r1(best.vdot),
      low: r1(best.vdot - 1),
      high: r1(best.vdot + 1),
      pastBest: pastBest != null ? r1(pastBest) : undefined,
      basis: `Mesurée : ${best.label ?? 'performance'} du ${fr(best.date)}.`,
    }
  }
  if (twoYears.length) {
    const best = twoYears.sort((a, b) => b.vdot - a.vdot)[0]
    const weeks = Math.floor(best.age / 7)
    const est = detrainedVdot(best.vdot, weeks)
    return {
      confidence: 'estimee',
      vdot: r1(est),
      low: r1(est - 3),
      high: r1(Math.min(best.vdot, est + 2)),
      pastBest: r1(best.vdot),
      basis: `Estimée à partir de ${best.label ?? 'ta meilleure performance'} (${fr(best.date)}), corrigée de ${weeks} semaines sans performance récente. Un test affinera.`,
    }
  }
  return { confidence: 'inconnue', basis: 'Aucune performance connue : fais le test de calibration (30 min) pour connaître tes allures.' }
}

/**
 * EFFORTS SOUTENUS DÉTECTÉS DANS MES SORTIES (mise à jour des allures sans test).
 *
 * Une sortie compte comme une performance si elle a été courue « à fond régulier » :
 * effort ressenti ≥ 8/10, ou FC moyenne ≥ 90 % de la FC max ; et 3 km minimum, 12 à 150 min.
 * Les sorties faciles ne sont jamais prises (elles sous-estimeraient la forme). Comme seule la
 * meilleure performance récente compte, un fractionné (moyenne avec récupérations) ne fait pas baisser l'estimation.
 */
export interface EffortCandidate {
  id: string
  date: ISODate
  type: string
  durationSec: number
  distanceM?: number
  avgHr?: number
  rpe?: number
}

export const RUN_TYPES_FOR_EFFORT = new Set(['Run', 'TrailRun', 'VirtualRun', 'Treadmill'])

export function detectEfforts(activities: EffortCandidate[], hrMax?: number): Performance[] {
  const out: Performance[] = []
  for (const a of activities) {
    if (!RUN_TYPES_FOR_EFFORT.has(a.type) || a.type === 'TrailRun') continue // le trail (dénivelé) fausse l'allure
    if (!a.distanceM || a.distanceM < 3000) continue
    const min = a.durationSec / 60
    if (min < 12 || min > 150) continue
    const hard = (a.rpe ?? 0) >= 8 || (!!hrMax && !!a.avgHr && a.avgHr >= 0.9 * hrMax)
    if (!hard) continue
    const d = new Date(a.date + 'T12:00:00')
    out.push({ id: `auto-${a.id}`, date: a.date, distanceM: a.distanceM, timeSec: a.durationSec, source: 'auto', label: `Sortie soutenue du ${d.getDate()}/${d.getMonth() + 1}` })
  }
  return out
}

/** FC max : mesurée si connue, sinon estimation de Tanaka (208 − 0,7 × âge), à prendre avec prudence. */
export function hrMaxOf(measured: number | undefined, age: number): number {
  return measured ?? Math.round(208 - 0.7 * age)
}

/** Historique du chrono prédit (à chaque nouvelle performance, puis aujourd'hui) sur une distance. */
export function predictionHistory(perfs: Performance[], today: ISODate, distanceM: number, predict: (vdot: number, d: number) => number): { date: ISODate; sec: number }[] {
  const dates = [...new Set(perfs.map((p) => p.date).filter((d) => d <= today))].sort()
  const out: { date: ISODate; sec: number }[] = []
  for (const d of [...dates, today]) {
    const f = estimateFitness(perfs.filter((p) => p.date <= d), d)
    if (f.vdot != null) {
      const sec = predict(f.vdot, distanceM)
      if (!out.length || out[out.length - 1].date !== d) out.push({ date: d, sec })
    }
  }
  return out
}
