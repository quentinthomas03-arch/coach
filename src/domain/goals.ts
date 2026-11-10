import type { ISODate } from '../data/types'
import { addDays, daysBetween } from './dates'
import type { FitnessEstimate } from './fitness'
import { DISTANCE_LABEL, DISTANCES, formatTime, predictTimeSec, vdotFromPerformance, type RoadDistance } from './paces'

/**
 * OBJECTIFS ET BILAN « EST-CE RÉALISTE ? »
 *
 * Repères utilisés (prudents, documentés ; pas des promesses) :
 * - Durée minimale de préparation spécifique, une fois capable de courir 30 min :
 *   5 km 6 sem., 10 km 8, semi 12, marathon 16 ; trail selon la distance.
 * - Volume hebdomadaire visé au pic : 5 km 150 min, 10 km 180, semi 240, marathon 330.
 *   On y monte à +8 % par semaine validée avec 1 semaine allégée sur 4.
 * - Progression du VDOT : ~0,4 point/semaine tant qu'on retrouve un niveau déjà atteint,
 *   ~0,15 point/semaine au-delà (gains plus lents quand on progresse « pour de vrai »).
 * - Reprise inachevée : ~1 niveau de reprise par semaine avant de commencer.
 */

export type GoalType = 'route' | 'chrono' | 'trail'

export interface Goal {
  id: string
  type: GoalType
  /** Route / chrono : distance standard. */
  distance?: RoadDistance
  /** Trail : distance en km et dénivelé positif. */
  trailKm?: number
  elevationGainM?: number
  /** Chrono visé (s). Facultatif pour la route (« finir »), obligatoire pour la progression chrono. */
  targetTimeSec?: number
  date: ISODate
  createdAt: string
  name?: string
}

export const MIN_PREP_WEEKS: Record<RoadDistance, number> = { '5k': 6, '10k': 8, semi: 12, marathon: 16 }
export const PEAK_WEEKLY_MIN: Record<RoadDistance, number> = { '5k': 150, '10k': 180, semi: 240, marathon: 330 }
export const TAPER_WEEKS: Record<RoadDistance, number> = { '5k': 1, '10k': 1, semi: 2, marathon: 3 }
export const REGAIN_RATE = 0.4
export const PROGRESS_RATE = 0.15
/** Volume hebdomadaire typique en fin de reprise (3 sorties de 40-50 min). */
export const REPRISE_END_WEEKLY_MIN = 110

export function trailPrepWeeks(km: number, dPlus: number) {
  const effort = km + dPlus / 100 // « km-effort » : 100 m D+ ≈ 1 km
  return effort < 30 ? 10 : effort < 60 ? 16 : 24
}
export function trailPeakMinutes(km: number, dPlus: number) {
  const effort = km + dPlus / 100
  return Math.round(Math.min(480, 180 + effort * 3))
}
export function trailTaperWeeks(km: number, dPlus: number) {
  return km + dPlus / 100 < 30 ? 1 : 2
}

export function goalLabel(g: Goal): string {
  if (g.type === 'trail') return `Trail ${g.trailKm} km${g.elevationGainM ? ` · ${g.elevationGainM} m D+` : ''}`
  const d = DISTANCE_LABEL[g.distance!]
  const t = g.targetTimeSec ? ` en ${formatTime(g.targetTimeSec)}` : ''
  return g.type === 'chrono' ? `Record sur ${d}${t}` : `${d[0].toUpperCase()}${d.slice(1)}${t}`
}

export interface AssessmentInput {
  goal: Goal
  today: ISODate
  fitness: FitnessEstimate
  /** Minutes de course par semaine, moyenne des 4 dernières semaines. */
  recentWeeklyMin: number
  /** Capable de courir 30 min sans s'arrêter (reprise terminée). */
  canRun30: boolean
  repriseLevel: number
}

export type Verdict = 'realiste' | 'ambitieux' | 'deconseille'

export interface GoalAssessment {
  verdict: Verdict
  weeksAvailable: number
  weeksNeeded: number
  earliestDate: ISODate
  /** Chrono prédit aujourd'hui (si forme connue) : [optimiste, prudent]. */
  predictionNow?: [number, number]
  /** Chrono raisonnablement atteignable à la date (si forme connue). */
  predictionAtDate?: number
  targetVdot?: number
  /** Le bilan, phrase par phrase, comme un coach. */
  lines: string[]
  alternatives: string[]
}

const fmtDate = (d: ISODate) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00'))

/** Semaines pour monter de `from` à `to` minutes/semaine à +8 %, semaines allégées comprises. */
export function volumeWeeks(from: number, to: number): number {
  const start = Math.max(60, from)
  if (start >= to) return 0
  return Math.ceil((Math.log(to / start) / Math.log(1.08)) * (4 / 3))
}

/** Semaines pour passer d'un VDOT à un autre (récupération plus rapide jusqu'au meilleur passé). */
export function vdotWeeks(from: number, to: number, pastBest?: number): number {
  if (to <= from) return 0
  const ceiling = pastBest ?? from
  const regain = Math.max(0, Math.min(to, ceiling) - from)
  const beyond = Math.max(0, to - Math.max(from, ceiling))
  return Math.ceil(regain / REGAIN_RATE + beyond / PROGRESS_RATE)
}

/** VDOT atteignable en `weeks` semaines. */
export function vdotAfter(from: number, weeks: number, pastBest?: number): number {
  const ceiling = pastBest ?? from
  const regainWeeks = Math.max(0, (ceiling - from) / REGAIN_RATE)
  if (weeks <= regainWeeks) return from + weeks * REGAIN_RATE
  return Math.max(from, ceiling) + (weeks - regainWeeks) * PROGRESS_RATE
}

export function assessGoal(input: AssessmentInput): GoalAssessment {
  const { goal, today, fitness } = input
  const lines: string[] = []
  const alternatives: string[] = []
  const weeksAvailable = Math.floor(daysBetween(today, goal.date) / 7)
  const isTrail = goal.type === 'trail'
  const dist = goal.distance
  const minPrep = isTrail ? trailPrepWeeks(goal.trailKm ?? 20, goal.elevationGainM ?? 0) : MIN_PREP_WEEKS[dist!]
  const peak = isTrail ? trailPeakMinutes(goal.trailKm ?? 20, goal.elevationGainM ?? 0) : PEAK_WEEKLY_MIN[dist!]
  const repriseLeft = input.canRun30 ? 0 : Math.max(0, 9 - input.repriseLevel + 1)

  // 1. Où tu en es.
  if (!input.canRun30) lines.push(`Aujourd’hui, tu es en reprise (niveau ${input.repriseLevel}/9) : il faut d’abord tenir 30 min de course continue, soit environ ${repriseLeft} semaine(s).`)
  lines.push(`Ton volume actuel : ${Math.round(input.recentWeeklyMin)} min de course par semaine en moyenne sur 4 semaines.`)
  let predictionNow: [number, number] | undefined
  if (!isTrail && fitness.vdot != null) {
    const dm = DISTANCES[dist!]
    predictionNow = [predictTimeSec(fitness.high!, dm), predictTimeSec(fitness.low!, dm)]
    lines.push(
      `Ta forme ${fitness.confidence === 'mesuree' ? 'mesurée' : 'estimée'} (VDOT ${fitness.vdot}) correspond aujourd’hui à ${formatTime(predictionNow[0])} – ${formatTime(predictionNow[1])} sur ${DISTANCE_LABEL[dist!]}, si tu étais préparé pour cette distance.`,
    )
  } else if (!isTrail) lines.push('Ta forme n’est pas encore connue : le test de calibration permettra de chiffrer un chrono.')

  // 2. Ce qu'il faut.
  // La reprise fait elle-même remonter le volume (~110 min/semaine à la fin).
  const volumeAtStart = input.canRun30 ? input.recentWeeklyMin : Math.max(input.recentWeeklyMin, REPRISE_END_WEEKLY_MIN)
  const volW = volumeWeeks(volumeAtStart, peak * 0.8)
  let needed = repriseLeft + Math.max(minPrep, volW)
  lines.push(`Il faut environ ${minPrep} semaines de préparation spécifique et un volume qui monte vers ${peak} min/semaine au pic (${volW} semaine(s) de montée progressive${input.canRun30 ? ' depuis ton volume actuel' : ' après la reprise'}).`)

  let targetVdot: number | undefined
  let predictionAtDate: number | undefined
  if (!isTrail && goal.targetTimeSec) {
    const dm = DISTANCES[dist!]
    targetVdot = Math.round(vdotFromPerformance(dm, goal.targetTimeSec) * 10) / 10
    if (fitness.vdot != null) {
      const vw = vdotWeeks(fitness.vdot, targetVdot, fitness.pastBest)
      needed = Math.max(needed, repriseLeft + vw)
      const reachable = vdotAfter(fitness.vdot, Math.max(0, weeksAvailable - repriseLeft), fitness.pastBest)
      predictionAtDate = predictTimeSec(reachable, dm)
      lines.push(
        targetVdot <= fitness.vdot
          ? `Ton chrono visé (${formatTime(goal.targetTimeSec)}) est déjà dans tes cordes en forme actuelle : la préparation sert surtout à tenir la distance.`
          : `Ton chrono visé (${formatTime(goal.targetTimeSec)}) demande un VDOT de ${targetVdot} : environ ${vw} semaine(s) de progression${fitness.pastBest && targetVdot <= fitness.pastBest ? ' (tu as déjà eu ce niveau, ça revient plus vite)' : ''}.`,
      )
    } else lines.push('Sans forme mesurée, je ne peux pas encore juger le chrono : seulement la faisabilité de la distance.')
  }

  // 3. Verdict.
  const earliestDate = addDays(today, needed * 7)
  const verdict: Verdict = weeksAvailable >= needed ? 'realiste' : weeksAvailable >= needed * 0.75 ? 'ambitieux' : 'deconseille'
  lines.push(`Tu as ${weeksAvailable} semaine(s) devant toi pour environ ${needed} nécessaire(s).`)
  if (verdict === 'realiste') lines.push('Verdict : réaliste. On y va, avec de la marge pour les imprévus.')
  if (verdict === 'ambitieux') lines.push('Verdict : ambitieux. Faisable si tout se passe bien, mais peu de marge : la moindre blessure ou semaine ratée compromet l’objectif.')
  if (verdict === 'deconseille') lines.push('Verdict : déconseillé à cette date. Le risque de blessure ou de grosse désillusion est élevé.')

  if (verdict !== 'realiste') {
    alternatives.push(`Décaler la date au ${fmtDate(earliestDate)} ou plus tard.`)
    if (predictionAtDate && goal.targetTimeSec && predictionAtDate > goal.targetTimeSec) alternatives.push(`Garder la date mais viser environ ${formatTime(predictionAtDate)}.`)
    if (dist === 'marathon') alternatives.push('Passer d’abord par un semi-marathon comme objectif d’étape.')
    if (dist === 'semi') alternatives.push('Passer d’abord par un 10 km comme objectif d’étape.')
    if (isTrail) alternatives.push('Choisir un trail plus court ou moins dénivelé comme étape.')
  }
  if (dist === 'marathon' || (isTrail && (goal.trailKm ?? 0) >= 40) || verdict !== 'realiste') {
    lines.push('Avant un objectif exigeant, un avis médical (certificat, et idéalement un bilan cardio après 6 mois d’arrêt) est recommandé.')
  }
  return { verdict, weeksAvailable, weeksNeeded: needed, earliestDate, predictionNow, predictionAtDate, targetVdot, lines, alternatives }
}
