import type { Workout } from './workout'

/**
 * Programme de REPRISE (marche-course progressive).
 *
 * Repères utilisés (documentés, pas des promesses) :
 * - Après plusieurs mois d'arrêt, on reprend en alternant marche et course,
 *   en augmentant d'abord la durée de course continue, jamais l'intensité.
 * - Intensité : zone 1-2 cardio, « tu dois pouvoir parler en courant ».
 * - On ne monte d'un niveau que si la semaine s'est bien passée
 *   (au moins 2 séances faites, effort ressenti modéré, aucune douleur).
 * - Une semaine sur quatre est allégée.
 */

export interface RepriseLevel {
  level: number
  /** Nombre de répétitions (course + marche). 1 = course continue. */
  reps: number
  runSec: number
  walkSec: number
  label: string
}

export const REPRISE_LEVELS: RepriseLevel[] = [
  { level: 1, reps: 8, runSec: 60, walkSec: 90, label: '8 × (1 min course + 1 min 30 marche)' },
  { level: 2, reps: 6, runSec: 120, walkSec: 90, label: '6 × (2 min course + 1 min 30 marche)' },
  { level: 3, reps: 5, runSec: 180, walkSec: 90, label: '5 × (3 min course + 1 min 30 marche)' },
  { level: 4, reps: 4, runSec: 300, walkSec: 90, label: '4 × (5 min course + 1 min 30 marche)' },
  { level: 5, reps: 3, runSec: 480, walkSec: 90, label: '3 × (8 min course + 1 min 30 marche)' },
  { level: 6, reps: 2, runSec: 720, walkSec: 90, label: '2 × (12 min course + 1 min 30 marche)' },
  { level: 7, reps: 1, runSec: 20 * 60, walkSec: 0, label: '20 min de course continue' },
  { level: 8, reps: 1, runSec: 25 * 60, walkSec: 0, label: '25 min de course continue' },
  { level: 9, reps: 1, runSec: 30 * 60, walkSec: 0, label: '30 min de course continue' },
]
export const MAX_REPRISE_LEVEL = REPRISE_LEVELS.length

export const WARMUP_WALK_SEC = 5 * 60
export const COOLDOWN_WALK_SEC = 5 * 60

export function getLevel(level: number): RepriseLevel {
  const l = Math.min(Math.max(1, Math.round(level)), MAX_REPRISE_LEVEL)
  return REPRISE_LEVELS[l - 1]
}

/** Réponse à « combien de temps peux-tu courir tranquillement sans t'arrêter ? » */
export type CurrentRunAbility = 'moins-5' | '5-10' | '10-20' | '20-30' | 'plus-30'

export function startLevelFor(ability: CurrentRunAbility): number {
  switch (ability) {
    case 'moins-5':
      return 1
    case '5-10':
      return 2
    case '10-20':
      return 4
    case '20-30':
      return 6
    case 'plus-30':
      return 8
  }
}

/**
 * Séance de marche-course du niveau donné.
 * `long` = sortie du week-end : 2 répétitions de plus, ou 10 min de plus en continu.
 */
export function repriseWorkout(level: number, long = false): Workout {
  const l = getLevel(level)
  const reps = long && l.reps > 1 ? l.reps + 2 : l.reps
  const runSec = long && l.reps === 1 ? l.runSec + 10 * 60 : l.runSec
  const main =
    reps > 1
      ? {
          role: 'main' as const,
          repeat: reps,
          steps: [
            { label: 'Course facile', durationSec: l.runSec, target: { kind: 'hrZone' as const, zone: 2 } },
            { label: 'Marche', durationSec: l.walkSec, target: { kind: 'hrZone' as const, zone: 1 } },
          ],
        }
      : {
          role: 'main' as const,
          steps: [{ label: 'Course facile', durationSec: runSec, target: { kind: 'hrZone' as const, zone: 2 } }],
        }
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Marche active', durationSec: WARMUP_WALK_SEC, target: { kind: 'hrZone', zone: 1 } }] },
      main,
      { role: 'cooldown', steps: [{ label: 'Marche', durationSec: COOLDOWN_WALK_SEC, target: { kind: 'hrZone', zone: 1 } }] },
    ],
  }
}

export function repriseLabel(level: number, long = false): string {
  const l = getLevel(level)
  if (!long) return l.label
  if (l.reps > 1) return l.label.replace(/^\d+/, String(l.reps + 2))
  return `${Math.round((l.runSec + 600) / 60)} min de course continue`
}

/** Bilan d'une semaine passée, servant à décider du niveau suivant. */
export interface WeekReview {
  planned: number
  done: number
  /** Au moins une séance faite depuis le début du plan (avant la fin de cette semaine). */
  started?: boolean
  /** Semaines déjà passées à ce niveau avant celle-ci (0 = première semaine au niveau). */
  weeksAtLevel?: number
  /** Effort ressenti moyen (1-10) des séances faites, si saisi. */
  avgRpe?: number
  pain: boolean
}

export interface LevelDecision {
  level: number
  change: 'monte' | 'stable' | 'baisse'
  reason: string
  /** Vrai quand la reprise est terminée (dernier niveau validé) : passage en Forme continue. */
  completed?: boolean
}

/**
 * Décide du niveau de la semaine suivante.
 * Règles, dans l'ordre :
 * 1. Douleur signalée → on redescend d'un niveau.
 * 2. Moins de 2 séances faites → on reste (sauf 0 séance faite : on redescend).
 * 3. Effort ressenti moyen ≥ 7/10 → on reste.
 * 4. Sinon → on monte d'un niveau.
 */
export function nextLevel(current: number, review: WeekReview): LevelDecision {
  const cur = getLevel(current).level
  if (review.pain) {
    return { level: Math.max(1, cur - 1), change: cur > 1 ? 'baisse' : 'stable', reason: 'Douleur signalée : on redescend d’un cran, la priorité est de ne pas se blesser.' }
  }
  if (review.planned > 0 && review.done === 0 && review.started === false) {
    return { level: cur, change: 'stable', reason: 'Pas encore de séance faite : on garde ton niveau de départ, rien ne bouge tant que tu n’as pas commencé.' }
  }
  if (review.planned > 0 && review.done === 0) {
    return { level: Math.max(1, cur - 1), change: cur > 1 ? 'baisse' : 'stable', reason: 'Aucune séance faite la semaine dernière : on reprend un cran plus bas.' }
  }
  if (review.done < 2) {
    return { level: cur, change: 'stable', reason: `Seulement ${review.done} séance faite : on consolide ce niveau avant de monter.` }
  }
  if (review.avgRpe != null && review.avgRpe >= 7) {
    return { level: cur, change: 'stable', reason: `Effort ressenti élevé (${review.avgRpe.toFixed(1).replace('.', ',')}/10) : on reste au même niveau.` }
  }
  // Semaine incomplète (une séance manquée) : on monte seulement après 2 semaines à ce niveau.
  if (review.done < review.planned && (review.weeksAtLevel ?? 0) < 1) {
    return { level: cur, change: 'stable', reason: `${review.done}/${review.planned} séances faites : on consolide ce niveau une semaine de plus.` }
  }
  if (cur >= MAX_REPRISE_LEVEL) {
    return { level: cur, change: 'stable', reason: 'Reprise terminée : 30 min de course continue validées. Place à la Forme continue !', completed: true }
  }
  return {
    level: cur + 1,
    change: 'monte',
    reason: review.done >= review.planned ? `Semaine validée (${review.done}/${review.planned} séances, effort maîtrisé) : on monte d’un niveau.` : `Deuxième semaine solide à ce niveau (${review.done}/${review.planned}) : on monte d’un niveau.`,
  }
}

/** Semaine allégée toutes les 4 semaines (4e, 8e…), index 0 = 1re semaine du plan. */
export function isDeloadWeek(weekIndex: number): boolean {
  return weekIndex % 4 === 3
}
