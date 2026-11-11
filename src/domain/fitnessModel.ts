import type { ISODate } from '../data/types'
import { addDays, daysBetween } from './dates'
import type { LoadEntry } from './load'

/**
 * CONDITION, FATIGUE, FRAÎCHEUR (modèle impulsion-réponse de Banister, utilisé par
 * TrainingPeaks, Intervals.icu, Garmin…) appliqué à la charge « durée × effort ».
 * - Condition = moyenne exponentielle de la charge sur 42 jours (ce que tu as construit).
 * - Fatigue = moyenne exponentielle sur 7 jours (ce que tu encaisses en ce moment).
 * - Fraîcheur = condition − fatigue (négative en période de charge, positive après repos).
 * Valeurs relatives : à comparer à toi-même dans le temps, pas à d'autres coureurs.
 */
export interface FitnessPoint {
  date: ISODate
  condition: number
  fatigue: number
  fraicheur: number
}

export function fitnessSeries(entries: LoadEntry[], from: ISODate, to: ISODate): FitnessPoint[] {
  const daily = new Map<ISODate, number>()
  for (const e of entries) daily.set(e.date, (daily.get(e.date) ?? 0) + e.load / 10)
  const kC = 1 - Math.exp(-1 / 42)
  const kF = 1 - Math.exp(-1 / 7)
  const out: FitnessPoint[] = []
  // Le calcul commence à la première séance (jamais avant : on partirait d'une condition nulle).
  const start = entries.length ? entries.reduce((m, e) => (e.date < m ? e.date : m), entries[0].date) : from
  // Point de départ : charge quotidienne moyenne des 14 premiers jours (évite une fausse « surcharge »
  // au démarrage, quand la condition partirait de zéro).
  let seed = 0
  for (let d = start, i = 0; i < 14; d = addDays(d, 1), i++) seed += daily.get(d) ?? 0
  seed /= 14
  let c = seed
  let f = seed
  for (let d = start; d <= to; d = addDays(d, 1)) {
    const l = daily.get(d) ?? 0
    c += (l - c) * kC
    f += (l - f) * kF
    if (d >= from) out.push({ date: d, condition: Math.round(c * 10) / 10, fatigue: Math.round(f * 10) / 10, fraicheur: Math.round((c - f) * 10) / 10 })
  }
  return out
}

export type TrainingStatus = 'productif' | 'maintien' | 'surcharge' | 'recuperation' | 'desentrainement' | 'demarrage'

export const STATUS_TEXT: Record<TrainingStatus, string> = {
  demarrage: 'Démarrage : pas encore assez d’historique pour juger.',
  productif: 'Productif : ta condition progresse à un rythme sain.',
  maintien: 'Maintien : ta condition est stable.',
  surcharge: 'Surcharge : la fatigue dépasse nettement ta condition. Allège quelques jours.',
  recuperation: 'Récupération : charge en baisse, tu te régénères.',
  desentrainement: 'Désentraînement : la condition baisse faute d’entraînement.',
}

export function trainingStatus(series: FitnessPoint[], entries: LoadEntry[], today: ISODate): TrainingStatus {
  const first = entries.reduce<ISODate | undefined>((m, e) => (!m || e.date < m ? e.date : m), undefined)
  if (!first || daysBetween(first, today) < 21 || series.length < 15) return 'demarrage'
  const now = series[series.length - 1]
  const ago = series[Math.max(0, series.length - 15)]
  const lastLoad = entries.reduce<ISODate | undefined>((m, e) => (!m || e.date > m ? e.date : m), undefined)!
  if (daysBetween(lastLoad, today) >= 10) return 'desentrainement'
  if (now.condition > 0 && now.fraicheur < -0.3 * now.condition) return 'surcharge'
  const trend = ago.condition > 0 ? (now.condition - ago.condition) / ago.condition : 0
  if (trend > 0.05) return 'productif'
  if (trend < -0.05) return now.fraicheur > 0 ? 'recuperation' : 'desentrainement'
  return 'maintien'
}

/**
 * TEMPS DE RÉCUPÉRATION estimé après une séance (repère) :
 * facile 12 h, modérée 24 h, dure 36 h, très dure 48 h ; +12 h au-delà de 90 min.
 */
export function recoveryHours(minutes: number, rpe: number): number {
  const base = rpe <= 4 ? 12 : rpe <= 6 ? 24 : rpe <= 8 ? 36 : 48
  return base + (minutes > 90 ? 12 : 0)
}

/** Heures de récupération restantes maintenant (la séance la plus exigeante l'emporte). */
export function recoveryLeft(done: { endAt: Date; minutes: number; rpe: number }[], now: Date): number {
  let left = 0
  for (const d of done) {
    const h = recoveryHours(d.minutes, d.rpe) - (now.getTime() - d.endAt.getTime()) / 3600000
    left = Math.max(left, h)
  }
  return Math.max(0, Math.round(left))
}
