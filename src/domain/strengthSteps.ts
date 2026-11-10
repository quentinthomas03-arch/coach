import type { StrengthItem } from './strength'

/**
 * Déroulé pas à pas d'une séance de renfo (pour le lecteur avec chrono).
 * Chaque étape est un effort (en répétitions ou en secondes) ou un repos.
 */
export type PlayerStep =
  | { type: 'work'; itemIndex: number; set: number; sets: number; side?: 'droit' | 'gauche'; reps?: number; sec?: number }
  | { type: 'rest'; itemIndex: number; sec: number; next: string }

export function buildSteps(items: StrengthItem[], transitionSec = 30): PlayerStep[] {
  const steps: PlayerStep[] = []
  items.forEach((it, idx) => {
    for (let set = 1; set <= it.sets; set++) {
      const sides: ('droit' | 'gauche' | undefined)[] = it.unilateral ? ['droit', 'gauche'] : [undefined]
      for (const side of sides) {
        steps.push({ type: 'work', itemIndex: idx, set, sets: it.sets, side, reps: it.reps, sec: it.sec })
      }
      const last = set === it.sets
      if (!last) steps.push({ type: 'rest', itemIndex: idx, sec: it.restSec, next: `${it.name}, série ${set + 1}` })
      else if (idx < items.length - 1) steps.push({ type: 'rest', itemIndex: idx + 1, sec: transitionSec, next: items[idx + 1].name })
    }
  })
  return steps
}
