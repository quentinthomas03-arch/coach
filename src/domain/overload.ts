import type { ISODate, MorningCheckin } from '../data/types'
import { addDays } from './dates'

/**
 * SURCHARGE PROLONGÉE (vie, travail, moral).
 *
 * Sur les 21 derniers jours (au moins 8 check-ins), si la moyenne de la charge de travail,
 * du moral ou de la forme physique est ≤ 2,2/5, le stress global est durablement élevé :
 * le coach allège l'entraînement (une sortie de moins en reprise, volume −15 % sinon)
 * jusqu'à ce que les moyennes remontent. L'entraînement doit rester une ressource, pas une charge de plus.
 */
export const OVERLOAD_THRESHOLD = 2.2
export const OVERLOAD_DAYS = 21
export const OVERLOAD_MIN_CHECKINS = 8
export const OVERLOAD_VOLUME_FACTOR = 0.85

export interface Overload {
  active: boolean
  reasons: string[]
}

export function detectOverload(checkins: MorningCheckin[], today: ISODate): Overload {
  const from = addDays(today, -OVERLOAD_DAYS)
  const c = checkins.filter((x) => x.date > from && x.date <= today)
  if (c.length < OVERLOAD_MIN_CHECKINS) return { active: false, reasons: [] }
  const avg = (k: 'travail' | 'moral' | 'physique') => c.reduce((a, x) => a + x[k], 0) / c.length
  const reasons: string[] = []
  const f = (n: number) => n.toFixed(1).replace('.', ',')
  if (avg('travail') <= OVERLOAD_THRESHOLD) reasons.push(`charge de travail très élevée (${f(avg('travail'))}/5 en moyenne)`)
  if (avg('moral') <= OVERLOAD_THRESHOLD) reasons.push(`moral bas (${f(avg('moral'))}/5)`)
  if (avg('physique') <= OVERLOAD_THRESHOLD) reasons.push(`fatigue physique (${f(avg('physique'))}/5)`)
  return { active: reasons.length > 0, reasons }
}
