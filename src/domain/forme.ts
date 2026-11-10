import type { Workout } from './workout'

/**
 * MODE FORME CONTINUE (après la reprise, sans objectif).
 *
 * Repères utilisés (documentés, pas des promesses) :
 * - Cycles de 4 semaines : 3 semaines de charge progressive, puis 1 semaine allégée (−25 %).
 * - Progression du volume hebdomadaire limitée à +8 % par semaine validée
 *   (repère classique : ne pas dépasser ~10 %).
 * - Environ 80 % du temps en endurance facile (zone 2), une séance plus soutenue
 *   courte en semaines 2 et 3 du cycle (fartlek léger), une sortie longue ≈ 35 % du volume.
 * - Intensités en zones cardio tant que le test de calibration n'a pas été fait.
 */

export const WEEKLY_INCREASE = 0.08
export const DELOAD_FACTOR = 0.75
export const LONG_SHARE = 0.35
export const QUALITY_SHARE = 0.25
export const MIN_EASY_MIN = 25
export const MAX_LONG_MIN = 120

export type FormeKind = 'sortie-longue' | 'fractionne' | 'endurance'

export interface FormeSessionTemplate {
  kind: FormeKind
  title: string
  minutes: number
  workout: Workout
  key: boolean
  reason: string
}

/** 0, 1, 2 = semaines de charge ; 3 = semaine allégée. */
export function cycleWeekOf(weekIndex: number) {
  return weekIndex % 4
}

export function easyWorkout(minutes: number): Workout {
  const main = Math.max(5, minutes - 10)
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Footing très facile', durationSec: 5 * 60, target: { kind: 'hrZone', zone: 1 } }] },
      { role: 'main', steps: [{ label: 'Endurance facile', durationSec: main * 60, target: { kind: 'hrZone', zone: 2 } }] },
      { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 5 * 60, target: { kind: 'hrZone', zone: 1 } }] },
    ],
  }
}

/** Fartlek léger : k × (1 min soutenue en zone 4 + 2 min facile). */
export function fartlekWorkout(minutes: number): { workout: Workout; reps: number } {
  const reps = Math.max(4, Math.min(10, Math.floor((minutes - 25) / 3)))
  return {
    reps,
    workout: {
      blocks: [
        { role: 'warmup', steps: [{ label: 'Échauffement facile', durationSec: 15 * 60, target: { kind: 'hrZone', zone: 2 } }] },
        {
          role: 'main',
          repeat: reps,
          steps: [
            { label: 'Soutenu', durationSec: 60, target: { kind: 'hrZone', zone: 4 } },
            { label: 'Récup en trottinant', durationSec: 120, target: { kind: 'hrZone', zone: 2 } },
          ],
        },
        { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 10 * 60, target: { kind: 'hrZone', zone: 1 } }] },
      ],
    },
  }
}

/** Volume de la semaine selon la position dans le cycle (le volume de base est celui d'une semaine de charge). */
export function weekMinutes(baseMinutes: number, weekIndex: number): number {
  return Math.round(cycleWeekOf(weekIndex) === 3 ? baseMinutes * DELOAD_FACTOR : baseMinutes)
}

/**
 * Répartit le volume de la semaine en séances : sortie longue, éventuelle séance soutenue, endurance.
 * Ordre du résultat : longue, soutenue (si présente), puis faciles.
 */
export function formeWeek(totalMinutes: number, runs: number, weekIndex: number): FormeSessionTemplate[] {
  const cw = cycleWeekOf(weekIndex)
  const deload = cw === 3
  const out: FormeSessionTemplate[] = []
  if (runs <= 0) return out
  const long = Math.min(MAX_LONG_MIN, Math.max(40, Math.round(totalMinutes * LONG_SHARE)))
  out.push({
    kind: 'sortie-longue',
    title: 'Sortie longue',
    minutes: long,
    workout: easyWorkout(long),
    key: true,
    reason: `Sortie longue : ${long} min en endurance facile (≈ 35 % du volume de la semaine).`,
  })
  let rest = totalMinutes - long
  let remainingRuns = runs - 1
  const withQuality = runs >= 3 && (cw === 1 || cw === 2)
  if (withQuality && remainingRuns > 0) {
    const q = Math.max(40, Math.round(totalMinutes * QUALITY_SHARE))
    const { workout, reps } = fartlekWorkout(q)
    out.push({
      kind: 'fractionne',
      title: 'Fartlek léger',
      minutes: q,
      workout,
      key: true,
      reason: `Séance un peu plus soutenue : ${reps} × 1 min en zone 4, pour réveiller la vitesse sans fatigue excessive.`,
    })
    rest -= q
    remainingRuns -= 1
  }
  for (let i = 0; i < remainingRuns; i++) {
    const m = Math.max(MIN_EASY_MIN, Math.round(rest / (remainingRuns - i)))
    rest -= m
    out.push({
      kind: 'endurance',
      title: 'Endurance facile',
      minutes: m,
      workout: easyWorkout(m),
      key: false,
      reason: deload ? 'Semaine allégée : endurance facile pour assimiler.' : 'Endurance facile (zone 2) : la base de la forme.',
    })
  }
  return out
}

export interface FormeReview {
  planned: number
  done: number
  avgRpe?: number
  pain: boolean
}

/**
 * Volume de base de la semaine suivante.
 * Douleur → −20 % ; semaine incomplète ou trop dure → maintien ; semaine allégée → maintien ;
 * sinon +8 %, plafonné par le temps disponible.
 */
export function nextBaseMinutes(base: number, review: FormeReview, weekIndexReviewed: number, maxAvailable: number): { minutes: number; reason: string } {
  if (review.pain) return { minutes: Math.round(base * 0.8), reason: 'Douleur signalée : volume réduit de 20 %.' }
  if (cycleWeekOf(weekIndexReviewed) === 3) return { minutes: base, reason: 'Fin de semaine allégée : on repart du même volume.' }
  if (review.done < Math.max(1, review.planned - 1)) return { minutes: base, reason: 'Semaine incomplète : volume maintenu.' }
  if (review.avgRpe != null && review.avgRpe >= 7) return { minutes: base, reason: 'Semaine ressentie dure : volume maintenu.' }
  const next = Math.min(Math.round(base * (1 + WEEKLY_INCREASE)), maxAvailable)
  return { minutes: next, reason: next > base ? `Semaine validée : volume +${Math.round(((next - base) / base) * 100)} % (${next} min).` : 'Volume au maximum de tes disponibilités.' }
}
