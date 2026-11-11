import type { ISODate } from '../data/types'
import { addDays } from './dates'
import { formatTime } from './paces'
import { formatPace } from './workout'

/**
 * PLAN DE COURSE (jour J) : allures par tronçon, alimentation de la veille au matin,
 * ravitaillement pendant, échauffement, liste de la veille et récupération.
 * Repères des recommandations courantes en nutrition du sport (ex. ISSN, ACSM) : ordres de grandeur.
 */

export interface RaceDayInput {
  distanceKm: number
  /** Chrono visé ou prédit (s). Sans chrono : course à l'effort. */
  timeSec?: number
  elevationGainM?: number
  trail?: boolean
  weightKg: number
  date: ISODate
  startTime?: string
}

export interface Segment {
  fromKm: number
  toKm: number
  paceSec?: number
  cue: string
}

export interface RaceDayPlan {
  targetPace?: number
  segments: Segment[]
  /** Temps de passage tous les 5 km (ou à chaque km sur 5 km). */
  splits: { km: number; time: string }[]
  carbLoad: { days: number; gPerDay?: number; text: string }
  breakfast: string[]
  during: string[]
  warmup: string
  checklist: string[]
  recovery: string
  timeline: { when: string; what: string }[]
}

/** 6000 → « 1:40:00 », 1500 → « 25:00 » */
export function clock(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`
}

const round5 = (g: number) => Math.round(g / 5) * 5

export function raceDayPlan(i: RaceDayInput): RaceDayPlan {
  const d = i.distanceKm
  const dur = i.timeSec ?? d * 360
  const p = i.timeSec && !i.trail ? i.timeSec / d : undefined
  const segments: Segment[] = []
  if (i.trail) {
    segments.push({ fromKm: 0, toKm: Math.round(d * 0.3), cue: 'Départ très prudent : marche dans toutes les montées raides, souffle à peine court.' })
    segments.push({ fromKm: Math.round(d * 0.3), toKm: Math.round(d * 0.8), cue: 'Régulier à l’effort. Mange et bois avant d’avoir faim ou soif. Descentes relâchées, petits pas.' })
    segments.push({ fromKm: Math.round(d * 0.8), toKm: d, cue: 'S’il en reste, c’est maintenant qu’on relance.' })
  } else if (d <= 5) {
    segments.push({ fromKm: 0, toKm: 1, paceSec: p, cue: 'Ne pars pas plus vite que l’allure visée : la foule t’emmène.' })
    segments.push({ fromKm: 1, toKm: 4, paceSec: p, cue: 'Allure tenue, ça doit piquer à partir de 3 km : c’est normal.' })
    segments.push({ fromKm: 4, toKm: 5, paceSec: p ? p - 5 : undefined, cue: 'Tout ce qu’il reste.' })
  } else if (d <= 10) {
    segments.push({ fromKm: 0, toKm: 2, paceSec: p ? p + 5 : undefined, cue: 'Départ 5 s/km plus lent que visé : tu le récupères largement après.' })
    segments.push({ fromKm: 2, toKm: 8, paceSec: p, cue: 'Allure visée, régulière. Relâche les épaules.' })
    segments.push({ fromKm: 8, toKm: d, paceSec: p ? p - 5 : undefined, cue: 'Accélère si tu peux, à fond le dernier kilomètre.' })
  } else if (d <= 25) {
    segments.push({ fromKm: 0, toKm: 3, paceSec: p ? p + 7 : undefined, cue: 'Départ prudent, 5 à 10 s/km plus lent. Laisse partir les autres.' })
    segments.push({ fromKm: 3, toKm: 16, paceSec: p, cue: 'Allure visée, très régulière. Respiration encore aisée.' })
    segments.push({ fromKm: 16, toKm: d, paceSec: p ? p - 3 : undefined, cue: 'Le semi commence ici : garde l’allure, accélère sur les 2 derniers km.' })
  } else {
    segments.push({ fromKm: 0, toKm: 5, paceSec: p ? p + 8 : undefined, cue: 'Départ franchement prudent : chaque seconde gagnée ici coûte une minute au 35e.' })
    segments.push({ fromKm: 5, toKm: 30, paceSec: p, cue: 'Allure visée, on ne regarde pas le chrono du voisin. Gel à chaque ravitaillement prévu.' })
    segments.push({ fromKm: 30, toKm: 38, paceSec: p, cue: 'Tenir l’allure. Coupe en tronçons de 2 km, pense à ta foulée.' })
    segments.push({ fromKm: 38, toKm: d, paceSec: p, cue: 'S’il en reste, tu lâches tout.' })
  }

  const splits: RaceDayPlan['splits'] = []
  if (p) {
    const timeAt = (k: number) => segments.reduce((t, sg) => t + Math.max(0, Math.min(k, sg.toKm) - sg.fromKm) * (sg.paceSec ?? p), 0)
    const step = d <= 5 ? 1 : 5
    for (let km = step; km < d - 0.05; km += step) splits.push({ km, time: clock(timeAt(km)) })
    splits.push({ km: Math.round(d * 10) / 10, time: clock(timeAt(d)) })
  }

  const long = dur >= 90 * 60
  const veryLong = dur >= 150 * 60
  const carbLoad = veryLong
    ? { days: 2, gPerDay: round5(9 * i.weightKg), text: `Les 2 jours avant : environ ${round5(9 * i.weightKg)} g de glucides par jour (féculents à chaque repas, pain, compote, jus). Moins de fibres et de gras, pas d’aliment nouveau.` }
    : long
      ? { days: 1, gPerDay: round5(7 * i.weightKg), text: `La veille : environ ${round5(7 * i.weightKg)} g de glucides (assiette aux deux tiers de féculents à midi et le soir). Peu de fibres, pas d’aliment nouveau, pas d’alcool.` }
      : { days: 0, text: 'La veille : un repas normal avec une bonne part de féculents. Pas d’aliment nouveau, pas d’alcool.' }

  const breakfast = [
    `3 h avant le départ : environ ${round5(1.5 * i.weightKg)} g de glucides, ce que tu as déjà testé à l’entraînement.`,
    'Exemple : pain blanc ou biscottes, confiture ou miel, une compote, un yaourt, thé ou café si tu en as l’habitude.',
    'Un demi-litre d’eau sur la matinée, puis quelques gorgées jusqu’au départ.',
  ]
  const gPerHour = veryLong ? 60 : long ? 40 : 0
  const during = gPerHour
    ? [
        `${gPerHour} g de glucides par heure : un gel (environ 25 g) toutes les ${veryLong ? 25 : 35} min, le premier vers 40 min, toujours avec de l’eau.`,
        'Bois quelques gorgées à chaque ravitaillement, selon la soif. Ne te force pas à boire beaucoup.',
        'Utilise uniquement des gels déjà testés en sortie longue.',
      ]
    : ['Pas besoin de manger pendant. Un verre d’eau au ravitaillement s’il fait chaud.']

  const warmup = i.trail || d > 25
    ? '10 min de marche rapide et trot très léger, mobilité des hanches et chevilles. Garde ton énergie.'
    : d > 10
      ? '10 min de footing très facile, mobilité, puis 2 lignes droites progressives. Fini 10 min avant le départ.'
      : '15 min de footing facile, mobilité, puis 3 à 4 lignes droites à l’allure de course. Fini 10 min avant le départ.'

  const checklist = [
    'Dossard, épingles ou porte-dossard, puce si elle est séparée',
    'Tenue et chaussures déjà portées en sortie longue (rien de neuf le jour J)',
    'Montre chargée, séance « course » sur la montre',
    ...(gPerHour ? ['Gels testés, en nombre suffisant'] : []),
    'Crème anti-frottements (pieds, aisselles, entrejambe)',
    'Vêtement chaud à jeter ou sac de consigne pour l’avant-départ',
    'Réveil réglé, trajet et accès au départ vérifiés',
    'Météo du jour regardée, tenue adaptée',
  ]

  const recovery = `Après la course : boire, manger glucides et protéines dans l’heure. Puis environ ${Math.max(3, Math.round(d / 1.6))} jours de footing facile ou de repos avant de reprendre l’intensité (repère : un jour par mile couru).`

  const start = i.startTime ?? '09:00'
  const [h, m] = start.split(':').map(Number)
  const at = (minBefore: number) => {
    const t = h * 60 + m - minBefore
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }
  const timeline = [
    ...(carbLoad.days === 2 ? [{ when: `${addDays(i.date, -2)}`, what: 'Début de la charge en glucides' }] : []),
    { when: addDays(i.date, -1), what: 'Repas riche en féculents, sac préparé, coucher tôt' },
    { when: at(180), what: 'Petit-déjeuner' },
    { when: at(60), what: 'Arrivée sur place, toilettes' },
    { when: at(30), what: 'Échauffement' },
    { when: at(10), what: 'Dans le sas' },
    { when: start, what: 'Départ' },
  ]

  return { targetPace: p, segments, splits, carbLoad, breakfast, during, warmup, checklist, recovery, timeline }
}

/** Bilan après la course, à partir du chrono réel. */
export function raceDebrief(distanceKm: number, actualSec: number, plannedSec?: number, positiveSplit?: boolean): string[] {
  const out = [`${distanceKm} km en ${formatTime(actualSec)}, soit ${formatPace(actualSec / distanceKm)}/km.`]
  if (plannedSec) {
    const diff = actualSec - plannedSec
    const pct = diff / plannedSec
    if (pct <= -0.01) out.push(`${formatTime(-diff)} plus vite que prévu : tu valais mieux que ce que je pensais. Tes allures sont mises à jour.`)
    else if (pct <= 0.02) out.push('Pile dans l’objectif. Course maîtrisée.')
    else out.push(`${formatTime(diff)} au-dessus de l’objectif. Pas grave : on regarde pourquoi (départ, chaleur, préparation) et on ajuste.`)
  }
  if (positiveSplit) out.push('Deuxième moitié plus lente : la prochaine fois, pars 5 s/km plus lentement.')
  out.push('Ce chrono devient ta nouvelle référence d’allures.')
  return out
}
