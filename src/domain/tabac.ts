import type { ISODate } from '../data/types'
import { addDays, daysBetween } from './dates'

/**
 * MODULE ARRÊT DU TABAC.
 *
 * Informatif uniquement : l'appli compte, encourage et oriente vers les
 * professionnels (Tabac info service 39 89, médecin, pharmacien). Aucun conseil médical.
 */

export interface TabacSettings {
  quitDate: ISODate
  /** Consommation habituelle avant l'arrêt. */
  cigsPerDayBefore: number
  /** Prix du paquet en euros. */
  packPrice: number
  cigsPerPack: number
  /** Mes raisons d'arrêter, rappelées dans les moments difficiles. */
  reasons: string[]
}

export interface CigaretteLog {
  date: ISODate
  count: number
}

/**
 * Bénéfices de l'arrêt, d'après les repères publiés par Tabac info service
 * (tabac-info-service.fr). Ce sont des moyennes, pas des garanties individuelles.
 */
export const MILESTONES: { afterDays: number; label: string; text: string }[] = [
  { afterDays: 0, label: '20 minutes', text: 'La pression artérielle et le pouls redeviennent normaux.' },
  { afterDays: 1, label: '8 heures', text: 'Le monoxyde de carbone dans le sang diminue de moitié : tes cellules sont mieux oxygénées.' },
  { afterDays: 1, label: '24 heures', text: 'Les poumons commencent à éliminer le mucus et les résidus de fumée.' },
  { afterDays: 2, label: '48 heures', text: 'Le goût et l’odorat s’améliorent.' },
  { afterDays: 3, label: '72 heures', text: 'Respirer devient plus facile : les bronches se relâchent, tu te sens plus énergique.' },
  { afterDays: 14, label: '2 semaines à 3 mois', text: 'La toux et la fatigue diminuent, le souffle revient : ça se sentira en courant.' },
  { afterDays: 30, label: '1 à 9 mois', text: 'Les cils bronchiques repoussent : moins d’essoufflement, moins d’infections.' },
  { afterDays: 365, label: '1 an', text: 'Le risque d’infarctus du myocarde est divisé par deux.' },
  { afterDays: 5 * 365, label: '5 ans', text: 'Le risque de cancer du poumon diminue presque de moitié.' },
]

export const TABAC_HELP = {
  phone: '39 89',
  text: 'Tabac info service : 39 89 (appel gratuit), du lundi au samedi, et l’appli Tabac info service. Ton médecin, ton pharmacien ou une sage-femme peuvent te prescrire des substituts nicotiniques remboursés.',
}

export type TabacPhase = 'preparation' | 'sans-tabac'

export interface TabacStatus {
  phase: TabacPhase
  /** Préparation : jours avant la date d'arrêt. */
  daysUntilQuit?: number
  /** Après l'arrêt : début de la série actuelle sans tabac. */
  smokeFreeSince?: ISODate
  daysSmokeFree?: number
  cigarettesAvoided?: number
  moneySaved?: number
  /** Une rechute a eu lieu après la date d'arrêt (la série a redémarré). */
  relapsed?: boolean
  reached: typeof MILESTONES
  next?: (typeof MILESTONES)[number] & { inDays: number }
}

export function tabacStatus(s: TabacSettings, logs: CigaretteLog[], today: ISODate): TabacStatus {
  if (today < s.quitDate) {
    return { phase: 'preparation', daysUntilQuit: daysBetween(today, s.quitDate), reached: [] }
  }
  const smokedAfterQuit = logs.filter((l) => l.date >= s.quitDate && l.date <= today && l.count > 0).sort((a, b) => (a.date < b.date ? -1 : 1))
  const last = smokedAfterQuit[smokedAfterQuit.length - 1]
  const since = last ? addDays(last.date, 1) : s.quitDate
  const days = Math.max(0, daysBetween(since, today))
  // Les cigarettes évitées et l'argent comptent depuis la date d'arrêt, rechutes déduites.
  const totalDays = daysBetween(s.quitDate, today)
  const smoked = smokedAfterQuit.reduce((n, l) => n + l.count, 0)
  const avoided = Math.max(0, totalDays * s.cigsPerDayBefore - smoked)
  const reached = MILESTONES.filter((m) => days >= m.afterDays)
  const nextM = MILESTONES.find((m) => days < m.afterDays)
  return {
    phase: 'sans-tabac',
    smokeFreeSince: since,
    daysSmokeFree: days,
    cigarettesAvoided: avoided,
    moneySaved: Math.round(((avoided / s.cigsPerPack) * s.packPrice) * 100) / 100,
    relapsed: !!last,
    reached,
    next: nextM ? { ...nextM, inDays: nextM.afterDays - days } : undefined,
  }
}

/** Économies sur un an au rythme d'avant l'arrêt (motivation pendant la préparation). */
export function yearlyCost(s: Pick<TabacSettings, 'cigsPerDayBefore' | 'packPrice' | 'cigsPerPack'>): number {
  return Math.round((365 * s.cigsPerDayBefore * s.packPrice) / s.cigsPerPack)
}
