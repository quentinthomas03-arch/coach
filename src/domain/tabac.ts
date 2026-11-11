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
  /** Mes moments à cigarette (identifiants de TRIGGERS). */
  triggers?: string[]
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
  /** Préparation : étape de la semaine et cible de cigarettes du jour. */
  prep?: PrepStep
  target?: number
  cravings?: CravingStats
  next?: (typeof MILESTONES)[number] & { inDays: number }
}

export function tabacStatus(s: TabacSettings, logs: CigaretteLog[], today: ISODate, cravingLogs: CravingLog[] = []): TabacStatus {
  const cravings = cravingLogs.length ? cravingStats(cravingLogs, today) : undefined
  if (today < s.quitDate) {
    const n = daysBetween(today, s.quitDate)
    return { phase: 'preparation', daysUntilQuit: n, reached: [], prep: prepStep(n), target: reductionTarget(s.cigsPerDayBefore, n), cravings }
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
    cravings,
    next: nextM ? { ...nextM, inDays: nextM.afterDays - days } : undefined,
  }
}

/** Économies sur un an au rythme d'avant l'arrêt (motivation pendant la préparation). */
export function yearlyCost(s: Pick<TabacSettings, 'cigsPerDayBefore' | 'packPrice' | 'cigsPerPack'>): number {
  return Math.round((365 * s.cigsPerDayBefore * s.packPrice) / s.cigsPerPack)
}

/**
 * Tabac × course : évolution de la FC de repos autour de l'arrêt.
 * Référence = moyenne des 14 jours avant l'arrêt ; actuel = moyenne des 7 derniers jours.
 * La baisse de la FC de repos après l'arrêt est un repère de récupération cardio (avec l'entraînement).
 */
export interface RhrPoint {
  date: ISODate
  restingHr?: number
}

export interface RhrTrend {
  baseline?: number
  current?: number
  delta?: number
  weekly: { weekStart: ISODate; avg: number }[]
}

export function rhrTrend(points: RhrPoint[], quitDate: ISODate, today: ISODate): RhrTrend {
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : undefined)
  const val = (from: ISODate, to: ISODate) => points.filter((p) => p.date >= from && p.date < to && p.restingHr != null).map((p) => p.restingHr!)
  const b = val(addDays(quitDate, -14), quitDate)
  const baseline = b.length >= 4 ? avg(b) : undefined
  const c = val(addDays(today, -6), addDays(today, 1))
  const current = today >= quitDate && c.length >= 3 ? avg(c) : undefined
  const weekly: RhrTrend['weekly'] = []
  for (let ws = addDays(quitDate, -14); ws <= today; ws = addDays(ws, 7)) {
    const v = val(ws, addDays(ws, 7))
    if (v.length >= 3) weekly.push({ weekStart: ws, avg: avg(v)! })
  }
  return { baseline, current, delta: baseline != null && current != null ? Math.round((current - baseline) * 10) / 10 : undefined, weekly }
}

/**
 * PRÉPARATION À L'ARRÊT (7 dernières semaines).
 * Inspiré des étapes proposées par Tabac info service : observer, réduire, préparer l'entourage
 * et les substituts, puis le jour J. La réduction est un repère, pas une obligation.
 */
export interface PrepStep {
  weeksBefore: number
  title: string
  todo: string[]
}

export const PREP_STEPS: PrepStep[] = [
  { weeksBefore: 7, title: 'Observer', todo: ['Note chaque cigarette dans le check du matin, sans rien changer.', 'Repère tes moments à cigarette : coche-les plus bas.', 'Écris tes raisons d’arrêter (Modifier mes réglages tabac).'] },
  { weeksBefore: 6, title: 'Se faire accompagner', todo: ['Prends rendez-vous chez ton médecin ou ton pharmacien pour les substituts (patchs, gommes) : ils sont remboursés.', 'Ou appelle le 39 89 : un tabacologue gratuit te suit.'] },
  { weeksBefore: 5, title: 'Supprimer les cigarettes faciles', todo: ['Supprime la cigarette qui te manquerait le moins.', 'Plus de cigarette à l’intérieur ni en voiture.'] },
  { weeksBefore: 4, title: 'Réduire', todo: ['Vise la cible du jour indiquée plus haut.', 'Pour chaque moment coché, choisis un plan B.'] },
  { weeksBefore: 3, title: 'Tester sans', todo: ['Passe une demi-journée sans fumer, avec les substituts si tu les as.', 'Utilise le bouton « Envie de fumer » à chaque envie : tu t’entraînes.'] },
  { weeksBefore: 2, title: 'Prévenir', todo: ['Préviens ton entourage et demande-leur de ne pas te proposer de cigarette.', 'Prévois les soirées de fin d’année : où, avec qui, quel plan B.'] },
  { weeksBefore: 1, title: 'Préparer le jour J', todo: ['Aie tes substituts à la maison.', 'La veille au soir : jette paquets, briquets et cendriers.', 'Choisis ta récompense pour la première semaine sans tabac.'] },
]

export function prepStep(daysUntilQuit: number): PrepStep | undefined {
  if (daysUntilQuit <= 0 || daysUntilQuit > 49) return undefined
  const w = Math.ceil(daysUntilQuit / 7)
  return PREP_STEPS.find((s) => s.weeksBefore === w)
}

/** Repère de réduction : de 100 % à 5 semaines de l'arrêt jusqu'à 50 % à 1 semaine, puis stable. */
export function reductionTarget(cigsPerDayBefore: number, daysUntilQuit: number): number | undefined {
  if (daysUntilQuit <= 0 || daysUntilQuit > 35) return undefined
  const ratio = daysUntilQuit <= 7 ? 0.5 : 0.5 + 0.5 * ((daysUntilQuit - 7) / 28)
  return Math.max(1, Math.round(cigsPerDayBefore * ratio))
}

/** Moments à cigarette et plan B suggéré. */
export const TRIGGERS: { id: string; label: string; planB: string }[] = [
  { id: 'reveil', label: 'Au réveil', planB: 'Grand verre d’eau, douche tout de suite, petit-déjeuner ailleurs que d’habitude.' },
  { id: 'cafe', label: 'Avec le café', planB: 'Change de lieu ou de boisson quelques semaines (thé, chicorée), ou bois-le en marchant.' },
  { id: 'repas', label: 'Après le repas', planB: 'Lève-toi de table, brosse-toi les dents, 10 min de marche.' },
  { id: 'pause', label: 'Pause au travail', planB: 'Garde la pause, sans la cigarette : marche, eau, gomme ou chewing-gum.' },
  { id: 'stress', label: 'Stress', planB: 'Respiration 2 min (bouton « Envie de fumer »), puis une tâche courte.' },
  { id: 'alcool', label: 'Alcool, soirées', planB: 'Moins d’alcool les premières semaines, reste avec les non-fumeurs, gommes dans la poche.' },
  { id: 'voiture', label: 'En voiture', planB: 'Musique ou podcast, eau, gommes, cendrier retiré.' },
  { id: 'ennui', label: 'Ennui', planB: 'Mains occupées : téléphone, balle anti-stress, un étirement.' },
  { id: 'apres-sport', label: 'Après le sport', planB: 'Note ta FC de repos qui baisse : c’est la meilleure récompense.' },
]

/** Envie de fumer notée avec le bouton « Envie de fumer ». */
export interface CravingLog {
  at: string
  resisted: boolean
  trigger?: string
}

export interface CravingStats {
  last7: number
  resisted7: number
  prev7: number
  /** Heure où les envies sont les plus fréquentes (sur 4 semaines). */
  peakHour?: number
  topTrigger?: string
  total: number
  totalResisted: number
}

export function cravingStats(logs: CravingLog[], today: ISODate): CravingStats {
  const d = (l: CravingLog) => l.at.slice(0, 10)
  const in7 = logs.filter((l) => d(l) > addDays(today, -7) && d(l) <= today)
  const prev = logs.filter((l) => d(l) > addDays(today, -14) && d(l) <= addDays(today, -7))
  const recent = logs.filter((l) => d(l) > addDays(today, -28))
  const top = <K,>(xs: K[]) => {
    const c = new Map<K, number>()
    xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1))
    let best: K | undefined
    let n = 0
    c.forEach((v, k) => {
      if (v > n) [best, n] = [k, v]
    })
    return n >= 2 ? best : undefined
  }
  return {
    last7: in7.length,
    resisted7: in7.filter((l) => l.resisted).length,
    prev7: prev.length,
    peakHour: top(recent.map((l) => new Date(l.at).getHours())),
    topTrigger: top(recent.map((l) => l.trigger).filter((x): x is string => !!x)),
    total: logs.length,
    totalResisted: logs.filter((l) => l.resisted).length,
  }
}
