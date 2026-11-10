import type { ISODate } from '../data/types'
import { daysBetween, mondayOf } from './dates'
import { easyWorkout, fartlekWorkout, type FormeSessionTemplate } from './forme'
import { PEAK_WEEKLY_MIN, TAPER_WEEKS, trailPeakMinutes, trailTaperWeeks, type Goal } from './goals'
import { DISTANCES, formatTime, predictTimeSec, trainingPaces, type TrainingPaces } from './paces'
import type { Target, Workout } from './workout'

/**
 * PLAN OBJECTIF : périodisation à rebours depuis la date de course.
 *
 *   base → développement → spécifique → affûtage → semaine de course
 *
 * - Affûtage : 1 semaine (5-10 km), 2 (semi, trail court), 3 (marathon) ; volume −30 % puis −40 %.
 * - Le reste est partagé : base 40 %, développement 30 %, spécifique 30 %.
 * - Volume : +8 % par semaine jusqu'au pic, 1 semaine allégée sur 4 (hors affûtage).
 * - Une séance clé par semaine en base (légère), deux à partir du développement si 4 sorties.
 * - Allures issues de ta forme (VDOT) ; sinon zones cardio.
 */

export type Phase = 'base' | 'developpement' | 'specifique' | 'affutage' | 'course'
export const PHASE_LABEL: Record<Phase, string> = {
  base: 'Base',
  developpement: 'Développement',
  specifique: 'Spécifique',
  affutage: 'Affûtage',
  course: 'Semaine de course',
}

export function taperWeeksFor(g: Goal) {
  return g.type === 'trail' ? trailTaperWeeks(g.trailKm ?? 20, g.elevationGainM ?? 0) : TAPER_WEEKS[g.distance!]
}
export function peakMinutesFor(g: Goal) {
  return g.type === 'trail' ? trailPeakMinutes(g.trailKm ?? 20, g.elevationGainM ?? 0) : PEAK_WEEKLY_MIN[g.distance!]
}

/** Nombre de semaines du plan (semaine de course incluse) depuis le lundi `planStart`. */
export function totalWeeks(planStart: ISODate, raceDate: ISODate) {
  return Math.floor(daysBetween(mondayOf(planStart), mondayOf(raceDate)) / 7) + 1
}

export function phasesFor(n: number, taper: number): Phase[] {
  if (n <= 0) return []
  const t = Math.min(taper, n - 1)
  const rest = n - 1 - t
  const base = Math.round(rest * 0.4)
  const dev = Math.round(rest * 0.3)
  const spe = rest - base - dev
  return [
    ...Array<Phase>(base).fill('base'),
    ...Array<Phase>(dev).fill('developpement'),
    ...Array<Phase>(spe).fill('specifique'),
    ...Array<Phase>(t).fill('affutage'),
    'course',
  ]
}

/** Semaines allégées du plan (1 sur 4 hors affûtage et semaine de course). */
export function deloadFlags(phases: Phase[]): boolean[] {
  let k = 0
  return phases.map((ph) => {
    if (ph === 'affutage' || ph === 'course') return false
    const d = k > 0 && k % 4 === 3
    k++
    return d
  })
}

/** Volume de course (min) de chaque semaine du plan. */
export function weeklyMinutesPlan(phases: Phase[], startMin: number, peak: number): number[] {
  const out: number[] = []
  let base = Math.max(60, startMin)
  let lastLoad = base
  let k = 0
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i]
    if (ph === 'affutage') {
      const taperIdx = i - phases.indexOf('affutage')
      out.push(Math.round(lastLoad * (taperIdx === 0 ? 0.7 : 0.6)))
      continue
    }
    if (ph === 'course') {
      out.push(Math.round(lastLoad * 0.45))
      continue
    }
    if (k > 0 && k % 4 === 3) {
      out.push(Math.round(base * 0.75)) // semaine allégée
    } else {
      if (k > 0) base = Math.min(peak, Math.floor(base * 1.08))
      out.push(base)
      lastLoad = base
    }
    k++
  }
  return out
}

const pace = (fast: number, slow: number): Target => ({ kind: 'pace', fastSecPerKm: Math.round(fast), slowSecPerKm: Math.round(slow) })

interface Ctx {
  goal: Goal
  paces?: TrainingPaces
  /** Allure cible de course (s/km), si chrono visé ou forme connue. */
  racePace?: number
}

function tEasy(c: Ctx): Target {
  return c.paces ? pace(c.paces.facile[0], c.paces.facile[1]) : { kind: 'hrZone', zone: 2 }
}

function steady(label: string, minutes: number, c: Ctx): Workout {
  const w = easyWorkout(minutes)
  w.blocks[1].steps[0] = { label, durationSec: Math.max(5, minutes - 10) * 60, target: tEasy(c) }
  return w
}

function seuilWorkout(reps: number, blockMin: number, c: Ctx): Workout {
  const t: Target = c.paces ? pace(c.paces.seuil[0], c.paces.seuil[1]) : { kind: 'hrZone', zone: 4 }
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Échauffement', durationSec: 15 * 60, target: tEasy(c) }] },
      { role: 'main', repeat: reps, steps: [{ label: 'Seuil', durationSec: blockMin * 60, target: t }, { label: 'Trot', durationSec: 120, target: { kind: 'hrZone', zone: 1 } }] },
      { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 10 * 60, target: tEasy(c) }] },
    ],
  }
}

function intervalWorkout(reps: number, distanceM: number, c: Ctx, recoverSec = 120): Workout {
  const t: Target = c.paces ? pace(c.paces.intervalles[0], c.paces.intervalles[1]) : { kind: 'hrZone', zone: 5 }
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Échauffement', durationSec: 15 * 60, target: tEasy(c) }] },
      { role: 'main', repeat: reps, steps: [{ label: 'Rapide', distanceM, target: t }, { label: 'Récup trot', durationSec: recoverSec, target: { kind: 'hrZone', zone: 1 } }] },
      { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 10 * 60, target: tEasy(c) }] },
    ],
  }
}

function racePaceWorkout(reps: number, blockMin: number, c: Ctx): Workout {
  const t: Target = c.racePace ? pace(c.racePace - 4, c.racePace + 4) : { kind: 'hrZone', zone: 3 }
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Échauffement', durationSec: 15 * 60, target: tEasy(c) }] },
      { role: 'main', repeat: reps, steps: [{ label: 'Allure course', durationSec: blockMin * 60, target: t }, { label: 'Trot', durationSec: 180, target: { kind: 'hrZone', zone: 1 } }] },
      { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 10 * 60, target: tEasy(c) }] },
    ],
  }
}

function longWithFinish(minutes: number, finishMin: number, c: Ctx): Workout {
  const t: Target = c.racePace ? pace(c.racePace - 4, c.racePace + 6) : { kind: 'hrZone', zone: 3 }
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Footing facile', durationSec: 10 * 60, target: tEasy(c) }] },
      { role: 'main', steps: [{ label: 'Endurance', durationSec: Math.max(10, minutes - 15 - finishMin) * 60, target: tEasy(c) }, { label: 'Fin à allure course', durationSec: finishMin * 60, target: t }] },
      { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 5 * 60, target: { kind: 'hrZone', zone: 1 } }] },
    ],
  }
}

function hillsWorkout(reps: number, upSec: number): Workout {
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Échauffement vers la côte', durationSec: 15 * 60, target: { kind: 'hrZone', zone: 2 } }] },
      { role: 'main', repeat: reps, steps: [{ label: 'Montée dynamique', durationSec: upSec, target: { kind: 'hrZone', zone: 4 } }, { label: 'Descente en trottinant', durationSec: upSec + 30, target: { kind: 'hrZone', zone: 1 } }] },
      { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 10 * 60, target: { kind: 'hrZone', zone: 1 } }] },
    ],
  }
}

function raceWorkout(g: Goal, c: Ctx): Workout {
  const distanceM = g.type === 'trail' ? (g.trailKm ?? 20) * 1000 : DISTANCES[g.distance!]
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Échauffement léger', durationSec: 10 * 60, target: { kind: 'hrZone', zone: 1 } }] },
      { role: 'main', steps: [{ label: 'Course objectif', distanceM, target: c.racePace ? pace(c.racePace - 3, c.racePace + 3) : undefined }] },
    ],
  }
}

const mins = (w: Workout, fallbackPace = 390) => {
  let total = 0
  for (const b of w.blocks) {
    const reps = b.repeat ?? 1
    for (const s of b.steps) total += (s.durationSec ?? ((s.distanceM ?? 0) / 1000) * (s.target?.kind === 'pace' ? (s.target.fastSecPerKm + s.target.slowSecPerKm) / 2 : fallbackPace)) * reps
  }
  return Math.round(total / 60)
}

export interface GoalWeekInput {
  goal: Goal
  phase: Phase
  /** Rang de la semaine dans sa phase (0 = première). */
  weekInPhase: number
  minutes: number
  runs: number
  /** Forme actuelle (VDOT) si connue. */
  vdot?: number
  /** Semaine allégée (hors affûtage). */
  deload: boolean
}

/** Allure de course visée : chrono visé, sinon prédiction de la forme actuelle. */
export function racePaceFor(goal: Goal, vdot?: number): number | undefined {
  if (goal.type === 'trail') return undefined
  const d = DISTANCES[goal.distance!]
  if (goal.targetTimeSec) return goal.targetTimeSec / (d / 1000)
  return vdot ? predictTimeSec(vdot, d) / (d / 1000) : undefined
}

export function goalWeekTemplates(i: GoalWeekInput): FormeSessionTemplate[] {
  const g = i.goal
  const c: Ctx = { goal: g, paces: i.vdot ? trainingPaces(i.vdot) : undefined, racePace: racePaceFor(g, i.vdot) }
  const trail = g.type === 'trail'
  const dist = g.distance
  const out: FormeSessionTemplate[] = []
  const tpl = (kind: FormeSessionTemplate['kind'], title: string, workout: Workout, key: boolean, reason: string): FormeSessionTemplate => ({
    kind, title, workout, key, reason, minutes: mins(workout),
  })
  const phaseTxt = `${PHASE_LABEL[i.phase]}${i.deload ? ' (semaine allégée)' : ''}`

  if (i.phase === 'course') {
    out.push(tpl('test', 'Course objectif', raceWorkout(g, c), true, `Jour J ! ${c.racePace ? `Allure visée ≈ ${formatTime(c.racePace)}/km : pars prudemment, accélère seulement après la mi-course.` : 'Pars prudemment, gère ton effort.'}`))
    const easyCount = Math.min(2, i.runs - 1)
    for (let k = 0; k < easyCount; k++) {
      const w = k === 0 ? racePaceWorkout(3, 2, c) : steady('Footing très facile', 25, c)
      out.push(tpl(k === 0 ? 'fractionne' : 'endurance', k === 0 ? 'Rappel d’allure' : 'Footing léger', w, false, k === 0 ? 'Semaine de course : quelques minutes à allure course pour garder les sensations, sans fatigue.' : 'Délier les jambes, sans fatigue.'))
    }
    return out
  }

  const longShare = dist === 'marathon' ? 0.38 : trail ? 0.4 : 0.32
  const longMin = Math.min(dist === 'marathon' ? 165 : trail ? 240 : dist === 'semi' ? 120 : 90, Math.max(40, Math.round(i.minutes * longShare)))
  let longW = steady('Endurance', longMin, c)
  let longReason = `Sortie longue en endurance facile (${phaseTxt}).`
  if (i.phase === 'specifique' && (dist === 'marathon' || dist === 'semi') && !i.deload) {
    const finish = dist === 'marathon' ? Math.min(45, 15 + i.weekInPhase * 10) : Math.min(25, 10 + i.weekInPhase * 5)
    longW = longWithFinish(longMin, finish, c)
    longReason = `Sortie longue avec les ${finish} dernières minutes à allure course : apprendre à la tenir fatigué.`
  }
  if (trail) longReason += ` Sur terrain vallonné : vise ≈ ${Math.round(((g.elevationGainM ?? 0) * longMin) / Math.max(60, (g.trailKm ?? 20) * 7))} m D+, marche dans les côtes raides comme en course.`
  out.push(tpl('sortie-longue', trail ? 'Sortie longue nature' : 'Sortie longue', longW, true, longReason))

  // Séances de qualité
  const qualities: FormeSessionTemplate[] = []
  if (!i.deload || i.phase === 'affutage') {
    if (i.phase === 'base') {
      if (trail && i.weekInPhase % 2 === 1) qualities.push(tpl('cotes', 'Côtes courtes', hillsWorkout(6 + i.weekInPhase, 45), true, 'Côtes courtes : force et foulée en montée, sans s’épuiser.'))
      else if (i.weekInPhase % 2 === 1) qualities.push(tpl('fractionne', 'Fartlek léger', fartlekWorkout(40).workout, true, 'Fartlek léger : réveiller la vitesse en base, sans fatigue.'))
    } else if (i.phase === 'developpement') {
      if (trail && i.weekInPhase % 2 === 0) qualities.push(tpl('cotes', 'Côtes', hillsWorkout(6 + i.weekInPhase, 90), true, 'Côtes de 1 min 30 : puissance en montée, base du trail.'))
      else qualities.push(tpl('seuil', 'Seuil', seuilWorkout(Math.min(4, 2 + Math.floor(i.weekInPhase / 2)), 8, c), true, `Seuil : ${c.paces ? `${formatTime(c.paces.seuil[0])}-${formatTime(c.paces.seuil[1])}/km` : 'zone 4'}, effort « confortablement difficile ». Repousse ton endurance à allure soutenue.`))
    } else if (i.phase === 'specifique') {
      if (trail) {
        qualities.push(tpl('cotes', 'Côtes longues', hillsWorkout(4 + Math.min(2, i.weekInPhase), 240), true, 'Côtes longues de 4 min : l’effort spécifique du trail. Redescends prudemment (travail excentrique).'))
      } else if (dist === '5k' || dist === '10k') {
        const reps = dist === '5k' ? Math.min(6, 4 + i.weekInPhase) : Math.min(5, 3 + i.weekInPhase)
        const d = dist === '5k' ? 1000 : 1600
        qualities.push(tpl('fractionne', 'Fractionné', intervalWorkout(reps, d, c, dist === '5k' ? 120 : 150), true, `${reps} × ${d >= 1000 ? `${d / 1000} km`.replace('.', ',') : `${d} m`} ${c.paces ? `à ${formatTime(c.paces.intervalles[0])}-${formatTime(c.paces.intervalles[1])}/km` : 'en zone 5'} : la vitesse spécifique ${dist === '5k' ? 'du 5 km' : 'du 10 km'}.`))
      } else {
        const reps = dist === 'marathon' ? Math.min(3, 2 + Math.floor(i.weekInPhase / 2)) : 3
        const block = dist === 'marathon' ? 15 : 10
        qualities.push(tpl('seuil', 'Allure course', racePaceWorkout(reps, block, c), true, `${reps} × ${block} min à allure course${c.racePace ? ` (${formatTime(c.racePace)}/km)` : ''} : t’approprier ton rythme du jour J.`))
      }
      if (i.runs >= 4 && !trail) qualities.push(tpl('seuil', 'Seuil', seuilWorkout(2, 10, c), true, 'Seuil : entretenir l’endurance à allure soutenue.'))
    } else if (i.phase === 'affutage') {
      qualities.push(tpl('fractionne', 'Rappel d’allure', trail ? hillsWorkout(4, 60) : racePaceWorkout(4, 3, c), true, 'Affûtage : on garde l’intensité, on baisse le volume. Tu dois finir frais.'))
    }
  }
  if (i.runs >= 2) out.push(...qualities.slice(0, Math.max(0, i.runs - 2 >= 1 ? qualities.length : 1)))

  // Endurance pour compléter le volume
  const used = out.reduce((a, s) => a + s.minutes, 0)
  const remainingRuns = Math.max(0, i.runs - out.length)
  let rest = Math.max(0, i.minutes - used)
  for (let k = 0; k < remainingRuns; k++) {
    const m = Math.max(25, Math.round(rest / (remainingRuns - k)))
    rest -= m
    out.push(tpl('endurance', 'Endurance facile', steady('Endurance facile', m, c), false, `Endurance facile${c.paces ? ` (${formatTime(c.paces.facile[0])}-${formatTime(c.paces.facile[1])}/km)` : ' (zone 2)'} : l’essentiel du travail se fait là.`))
  }
  return out
}
