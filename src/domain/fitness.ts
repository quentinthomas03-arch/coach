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
  source: 'test' | 'course' | 'record'
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
